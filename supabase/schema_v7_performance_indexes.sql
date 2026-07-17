-- ============================================================
-- schema_v7_performance_indexes.sql
-- Performance indexes — safe to run in production.
-- Uses CREATE INDEX IF NOT EXISTS, so it's idempotent.
-- Run this in the Supabase SQL Editor AFTER schema.sql.
-- ============================================================

-- transactions: composite index used by getTransactions (date-range filter + ordering)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions (user_id, date DESC);

-- transactions: individual FK/filter columns
CREATE INDEX IF NOT EXISTS idx_transactions_card_id
  ON transactions (card_id)
  WHERE card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_category_id
  ON transactions (category_id);

CREATE INDEX IF NOT EXISTS idx_transactions_scheduled_id
  ON transactions (scheduled_id)
  WHERE scheduled_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_installment_group_id
  ON transactions (installment_group_id)
  WHERE installment_group_id IS NOT NULL;

-- categories
CREATE INDEX IF NOT EXISTS idx_categories_user_id
  ON categories (user_id);

-- subcategories
CREATE INDEX IF NOT EXISTS idx_subcategories_user_id
  ON subcategories (user_id);

-- scheduled_transactions
CREATE INDEX IF NOT EXISTS idx_scheduled_transactions_user_id
  ON scheduled_transactions (user_id);

-- credit_cards
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id
  ON credit_cards (user_id);

-- invoices: single-column
CREATE INDEX IF NOT EXISTS idx_invoices_user_id
  ON invoices (user_id);

-- invoices: composite used by ensure_invoice_and_recalc lookup
CREATE INDEX IF NOT EXISTS idx_invoices_card_month
  ON invoices (card_id, reference_month);

-- budgets
CREATE INDEX IF NOT EXISTS idx_budgets_user_id
  ON budgets (user_id);

-- budget_groups
CREATE INDEX IF NOT EXISTS idx_budget_groups_user_id
  ON budget_groups (user_id);

-- banks
CREATE INDEX IF NOT EXISTS idx_banks_user_id
  ON banks (user_id);

-- transfers
CREATE INDEX IF NOT EXISTS idx_transfers_user_id
  ON transfers (user_id);
