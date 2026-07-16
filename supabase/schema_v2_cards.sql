-- ============================================================
-- MyFinance — Schema v2: Cartões de Crédito e Faturas
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- Cartões de Crédito
create table if not exists credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  bank text not null default '',
  brand text check (brand in ('visa', 'mastercard', 'elo', 'amex', 'other')) not null default 'other',
  limit_amount numeric not null default 0,
  closing_day integer check (closing_day between 1 and 31) not null default 10,
  due_day integer check (due_day between 1 and 31) not null default 5,
  color text not null default '#3b82f6',
  created_at timestamptz default now()
);

-- Faturas
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  card_id uuid references credit_cards(id) on delete cascade not null,
  reference_month text not null, -- 'YYYY-MM'
  closing_date date not null,
  due_date date not null,
  total_amount numeric not null default 0,
  status text check (status in ('open', 'closed', 'paid', 'overdue')) not null default 'open',
  paid_transaction_id uuid,
  created_at timestamptz default now(),
  unique(card_id, reference_month)
);

-- Adiciona card_id e reference_month à tabela de transações
alter table transactions add column if not exists card_id uuid references credit_cards(id) on delete set null;
alter table transactions add column if not exists reference_month text; -- 'YYYY-MM' para compras no cartão

-- ============================================================
-- Row Level Security
-- ============================================================

alter table credit_cards enable row level security;
alter table invoices enable row level security;

drop policy if exists "Users manage own cards" on credit_cards;
create policy "Users manage own cards"
  on credit_cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own invoices" on invoices;
create policy "Users manage own invoices"
  on invoices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
