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

drop policy if exists "Users manage own budgets" on public.budgets;
create policy "Users manage own budgets"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
