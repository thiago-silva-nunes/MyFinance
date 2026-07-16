-- ─── Budgets ──────────────────────────────────────────────────────────────────
-- Run this in your Supabase project's SQL Editor (after schema.sql and schema_v2_cards.sql).

create table if not exists budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  category_id    uuid references categories(id) on delete cascade not null,
  name           text not null,
  amount         numeric not null check (amount > 0),
  recurrence     text check (recurrence in ('mensal', 'pontual')) not null default 'mensal',
  reference_month text,  -- 'YYYY-MM', required only when recurrence = 'pontual'
  active         boolean not null default true,
  created_at     timestamptz default now()
);

alter table budgets enable row level security;

drop policy if exists "Users manage own budgets" on budgets;
create policy "Users manage own budgets"
  on budgets for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
