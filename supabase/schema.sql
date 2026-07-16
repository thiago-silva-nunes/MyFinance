-- ============================================================
-- MyFinance — Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- Categorias
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text check (type in ('income', 'expense')) not null,
  color text not null,
  icon text not null,
  dre_group text check (dre_group in ('receita', 'despesa_fixa', 'despesa_variavel', 'despesa_financeira', 'deducao')) not null default 'despesa_variavel',
  created_at timestamptz default now()
);

-- Lançamentos
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  amount numeric not null,
  type text check (type in ('income', 'expense')) not null,
  category_id uuid references categories(id) on delete set null,
  date date not null,
  status text check (status in ('paid', 'pending')) default 'pending',
  payment_method text,
  notes text,
  scheduled_id uuid,
  created_at timestamptz default now()
);

-- Lançamentos programados/recorrentes
create table if not exists scheduled_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  amount numeric not null,
  type text check (type in ('income', 'expense')) not null,
  category_id uuid references categories(id) on delete set null,
  start_date date not null,
  end_date date,
  frequency text check (frequency in ('once', 'daily', 'weekly', 'monthly', 'yearly')) not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security — each user sees only their own data
-- ============================================================

alter table categories enable row level security;
alter table transactions enable row level security;
alter table scheduled_transactions enable row level security;

-- Categories
drop policy if exists "Users manage own categories" on categories;
create policy "Users manage own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Transactions
drop policy if exists "Users manage own transactions" on transactions;
create policy "Users manage own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Scheduled transactions
drop policy if exists "Users manage own scheduled" on scheduled_transactions;
create policy "Users manage own scheduled"
  on scheduled_transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
