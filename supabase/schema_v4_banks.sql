-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v4 — Banks (Contas Bancárias)
-- Run after schema.sql in the Supabase SQL Editor.
-- All statements are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- Banks / Contas Bancárias
create table if not exists public.banks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  type            text not null default 'corrente', -- corrente | poupança | investimento
  initial_balance numeric not null default 0,
  color           text not null default '#6366f1',
  icon            text not null default 'building-2',
  created_at      timestamptz default now()
);

alter table public.banks enable row level security;

drop policy if exists "Users manage own banks" on public.banks;
create policy "Users manage own banks" on public.banks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists banks_user_id_idx on public.banks (user_id);

-- Add optional bank_id to transactions (tracks which account the money came from/went to)
alter table public.transactions add column if not exists bank_id uuid references public.banks(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Performance indexes (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists transactions_user_ref_month_idx  on public.transactions (user_id, reference_month);
create index if not exists transactions_user_card_idx        on public.transactions (user_id, card_id);
create index if not exists transactions_user_category_idx    on public.transactions (user_id, category_id);
create index if not exists transactions_date_desc_idx        on public.transactions (date desc);
create index if not exists invoices_card_ref_idx             on public.invoices (card_id, reference_month);
create index if not exists budgets_user_id_idx               on public.budgets (user_id);
create index if not exists scheduled_user_idx                on public.scheduled_transactions (user_id);
