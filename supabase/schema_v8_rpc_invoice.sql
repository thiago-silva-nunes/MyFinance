-- ============================================================
-- schema_v8_rpc_invoice.sql
-- RPC: ensure_invoice_and_recalc
-- Consolidates ensureInvoice + recalcInvoiceTotal into a single
-- round-trip, eliminating the N+1 pattern in addTransaction /
-- addInstallments.
--
-- SECURITY: SECURITY INVOKER — runs as the calling authenticated
-- user. Supabase RLS on the invoices and transactions tables
-- applies automatically. auth.uid() is used for the INSERT so
-- p_user_id is never accepted from the client, preventing any
-- cross-tenant write.
--
-- Run in the Supabase SQL Editor AFTER schema.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_invoice_and_recalc(
  p_card_id         uuid,
  p_reference_month text,   -- 'YYYY-MM'
  p_closing_day     int,
  p_due_day         int
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER   -- runs as the calling user; RLS on invoices/transactions applies
AS $$
DECLARE
  v_user_id      uuid := auth.uid();  -- always from session, never trusted from caller
  v_year         int  := split_part(p_reference_month, '-', 1)::int;
  v_month        int  := split_part(p_reference_month, '-', 2)::int;
  v_due_year     int;
  v_due_month    int;
  v_max_cd       int;
  v_max_dd       int;
  v_closing_date date;
  v_due_date     date;
  v_today        date := current_date;
  v_status       text;
  v_exist_id     uuid;
  v_exist_status text;
  v_total        numeric;
BEGIN
  -- Reject unauthenticated callers
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Clamp closing_day to last day of reference month
  v_max_cd       := extract(day from
                      (date_trunc('month', make_date(v_year, v_month, 1))
                       + interval '1 month - 1 day'))::int;
  v_closing_date := make_date(v_year, v_month, least(p_closing_day, v_max_cd));

  -- Due date is in the following month
  v_due_month := v_month + 1;
  v_due_year  := v_year;
  IF v_due_month > 12 THEN
    v_due_month := 1;
    v_due_year  := v_due_year + 1;
  END IF;
  v_max_dd   := extract(day from
                  (date_trunc('month', make_date(v_due_year, v_due_month, 1))
                   + interval '1 month - 1 day'))::int;
  v_due_date := make_date(v_due_year, v_due_month, least(p_due_day, v_max_dd));

  -- Compute current status (never downgrade 'paid')
  IF    v_today > v_due_date      THEN v_status := 'overdue';
  ELSIF v_today >= v_closing_date THEN v_status := 'closed';
  ELSE                                 v_status := 'open';
  END IF;

  -- Find or create the invoice row (RLS ensures only the user's own rows are visible)
  SELECT id, status
    INTO v_exist_id, v_exist_status
    FROM invoices
   WHERE card_id         = p_card_id
     AND reference_month = p_reference_month;

  IF v_exist_id IS NULL THEN
    INSERT INTO invoices
      (user_id, card_id, reference_month, closing_date, due_date, status, total_amount)
    VALUES
      (v_user_id, p_card_id, p_reference_month,
       v_closing_date, v_due_date, v_status, 0);
  ELSIF v_exist_status <> 'paid' AND v_exist_status <> v_status THEN
    UPDATE invoices
       SET status = v_status
     WHERE id = v_exist_id;
  END IF;

  -- Recalculate total_amount from all transactions in this card/month (RLS-filtered)
  SELECT COALESCE(sum(amount), 0)
    INTO v_total
    FROM transactions
   WHERE card_id         = p_card_id
     AND reference_month = p_reference_month;

  UPDATE invoices
     SET total_amount = v_total
   WHERE card_id         = p_card_id
     AND reference_month = p_reference_month;
END;
$$;
