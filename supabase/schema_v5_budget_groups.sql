-- ─────────────────────────────────────────────────────────────────────────────
-- Schema v5 — Budget Groups (Grupos de Orçamento)
-- Run after schema_v3_budgets.sql in the Supabase SQL Editor.
-- All statements are idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- Budget Groups
create table if not exists public.budget_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  total_limit numeric,          -- optional aggregate limit; null = sum of individual limits
  created_at  timestamptz default now()
);

alter table public.budget_groups enable row level security;

drop policy if exists "Users manage own budget groups" on public.budget_groups;
create policy "Users manage own budget groups" on public.budget_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists budget_groups_user_id_idx on public.budget_groups (user_id);

-- Add optional group_id to existing budgets (retrocompatible — null means ungrouped)
alter table public.budgets add column if not exists group_id uuid references public.budget_groups(id) on delete set null;
