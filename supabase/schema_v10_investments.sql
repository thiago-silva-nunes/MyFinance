-- Schema v10: Investments
-- Run after schema.sql in the Supabase SQL Editor.
-- Idempotent: uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.

create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in (
    'renda_fixa','acoes','fundos_imobiliarios','fundos',
    'criptomoedas','previdencia','tesouro_direto','outros'
  )),
  institution text,
  initial_value numeric not null default 0,
  current_value numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists investment_transactions (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references investments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('aporte','resgate','atualizacao_valor')),
  amount numeric not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_investment_tx_investment
  on investment_transactions(investment_id, date desc);

alter table investments enable row level security;
alter table investment_transactions enable row level security;

-- RLS Policies for investments
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'investments' and policyname = 'investments_select_own'
  ) then
    create policy investments_select_own on investments
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'investments' and policyname = 'investments_insert_own'
  ) then
    create policy investments_insert_own on investments
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'investments' and policyname = 'investments_update_own'
  ) then
    create policy investments_update_own on investments
      for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'investments' and policyname = 'investments_delete_own'
  ) then
    create policy investments_delete_own on investments
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- RLS Policies for investment_transactions
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'investment_transactions' and policyname = 'inv_tx_select_own'
  ) then
    create policy inv_tx_select_own on investment_transactions
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'investment_transactions' and policyname = 'inv_tx_insert_own'
  ) then
    create policy inv_tx_insert_own on investment_transactions
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'investment_transactions' and policyname = 'inv_tx_update_own'
  ) then
    create policy inv_tx_update_own on investment_transactions
      for update using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where tablename = 'investment_transactions' and policyname = 'inv_tx_delete_own'
  ) then
    create policy inv_tx_delete_own on investment_transactions
      for delete using (auth.uid() = user_id);
  end if;
end $$;
