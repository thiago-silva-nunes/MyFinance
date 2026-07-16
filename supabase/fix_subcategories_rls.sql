-- ============================================================
-- Targeted fix: subcategories table + RLS
-- Run this in Supabase SQL Editor if the subcategories table
-- is missing or the RLS policy is blocking inserts (code 42501).
-- ============================================================

-- Diagnostic: check current state before running the fix
-- (run this block separately first to understand what exists)
/*
select
  t.table_name,
  r.rowsecurity as rls_enabled,
  p.policyname,
  p.cmd,
  p.qual,
  p.with_check
from information_schema.tables t
left join pg_class c on c.relname = t.table_name and c.relkind = 'r'
left join pg_namespace ns on ns.oid = c.relnamespace and ns.nspname = t.table_schema
left join pg_tables r on r.tablename = t.table_name and r.schemaname = t.table_schema
left join pg_policies p on p.tablename = t.table_name and p.schemaname = t.table_schema
where t.table_schema = 'public'
  and t.table_name = 'subcategories'
order by p.policyname;
*/

-- Step 1: create the table if it doesn't exist yet
create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references categories(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

-- Step 2: enable RLS (safe to re-run)
alter table subcategories enable row level security;

-- Step 3: recreate the policy (idempotent)
drop policy if exists "Users manage their own subcategories" on subcategories;
create policy "Users manage their own subcategories"
  on subcategories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Step 4: add subcategory_id to transactions if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'transactions' and column_name = 'subcategory_id'
  ) then
    alter table transactions
      add column subcategory_id uuid references subcategories(id) on delete set null;
  end if;
end $$;
