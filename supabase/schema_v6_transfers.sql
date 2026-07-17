-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v6 — Transfers (Transferências entre contas)
-- Run after schema_v4_banks.sql in the Supabase SQL Editor.
-- All statements are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.transfers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  from_bank_id uuid references public.banks(id) on delete cascade not null,
  to_bank_id   uuid references public.banks(id) on delete cascade not null,
  amount       numeric not null check (amount > 0),
  date         date not null,
  notes        text,
  created_at   timestamptz default now(),
  -- ensure origin and destination are always different
  constraint transfers_different_accounts check (from_bank_id <> to_bank_id)
);

alter table public.transfers enable row level security;

drop policy if exists "Users manage own transfers" on public.transfers;
create policy "Users manage own transfers" on public.transfers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists transfers_user_id_idx   on public.transfers (user_id);
create index if not exists transfers_from_bank_idx on public.transfers (from_bank_id);
create index if not exists transfers_to_bank_idx   on public.transfers (to_bank_id);
create index if not exists transfers_date_idx      on public.transfers (date desc);
