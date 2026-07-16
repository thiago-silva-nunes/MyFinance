-- ─── Budgets ──────────────────────────────────────────────────────────────────
-- Execute este arquivo no SQL Editor do Supabase APÓS schema.sql.
-- Cria a tabela `budgets` com RLS por user_id.

create table if not exists public.budgets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  category_id    uuid not null references public.categories(id) on delete cascade,
  name           text not null,
  amount         numeric(14, 2) not null check (amount > 0),
  recurrence     text not null check (recurrence in ('mensal', 'pontual')),
  reference_month text,          -- 'YYYY-MM', obrigatório quando recurrence = 'pontual'
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Índice para buscas por usuário
create index if not exists budgets_user_id_idx on public.budgets (user_id);

-- Row Level Security
alter table public.budgets enable row level security;

create policy if not exists "Users can view their own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert their own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update their own budgets"
  on public.budgets for update
  using (auth.uid() = user_id);

create policy if not exists "Users can delete their own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);
