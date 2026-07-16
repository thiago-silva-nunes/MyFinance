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

-- Subcategorias
create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references categories(id) on delete cascade not null,
  name text not null,
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
  subcategory_id uuid references subcategories(id) on delete set null,
  date date not null,
  status text check (status in ('paid', 'pending')) default 'pending',
  payment_method text,
  notes text,
  scheduled_id uuid,
  card_id uuid,
  reference_month text,
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

-- Cartões de crédito
create table if not exists credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  bank text not null,
  brand text check (brand in ('visa', 'mastercard', 'elo', 'amex', 'other')) not null default 'other',
  limit_amount numeric not null default 0,
  closing_day integer not null default 10,
  due_day integer not null default 5,
  color text not null default '#1e40af',
  created_at timestamptz default now()
);

-- Faturas
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references credit_cards(id) on delete cascade not null,
  reference_month text not null,        -- 'YYYY-MM'
  closing_date date not null,
  due_date date not null,
  total_amount numeric not null default 0,
  status text check (status in ('open', 'closed', 'paid', 'overdue')) not null default 'open',
  paid_transaction_id uuid,
  created_at timestamptz default now(),
  unique (card_id, reference_month)
);

-- ============================================================
-- Row Level Security — each user sees only their own data
-- ============================================================

alter table categories enable row level security;
alter table subcategories enable row level security;
alter table transactions enable row level security;
alter table scheduled_transactions enable row level security;
alter table credit_cards enable row level security;
alter table invoices enable row level security;

-- Categories
drop policy if exists "Users manage own categories" on categories;
create policy "Users manage own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Subcategories
drop policy if exists "Users manage their own subcategories" on subcategories;
create policy "Users manage their own subcategories"
  on subcategories for all
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

-- Credit cards
drop policy if exists "Users manage own credit_cards" on credit_cards;
create policy "Users manage own credit_cards"
  on credit_cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Invoices
drop policy if exists "Users manage own invoices" on invoices;
create policy "Users manage own invoices"
  on invoices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- Migration guards: safe to run on any existing DB
-- Adds columns that may not exist in older schema versions
-- ============================================================

do $$
begin
  -- v2: card_id and reference_month (credit card support)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'transactions' and column_name = 'card_id'
  ) then
    alter table transactions add column card_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'transactions' and column_name = 'reference_month'
  ) then
    alter table transactions add column reference_month text;
  end if;

  -- v3: subcategory_id (subcategory support)
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'transactions' and column_name = 'subcategory_id'
  ) then
    alter table transactions
      add column subcategory_id uuid references subcategories(id) on delete set null;
  end if;
end $$;
