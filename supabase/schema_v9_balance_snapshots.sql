-- ── Balance Snapshots (marcos de saldo) ─────────────────────────────────────
-- Idempotent migration: run safely multiple times.
-- Purpose: replace "is_balance_adjustment" transactions with point-in-time
--          balance anchors per bank account, without polluting the transaction list.

-- ── 1. Create table ───────────────────────────────────────────────────────────

create table if not exists balance_snapshots (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  bank_id       uuid        not null references banks(id) on delete cascade,
  snapshot_date date        not null,
  balance       numeric     not null,
  created_at    timestamptz not null default now()
);

-- Enforce at most one snapshot per user+bank+date (enables safe ON CONFLICT upserts)
create unique index if not exists idx_balance_snapshots_user_bank_date
  on balance_snapshots(user_id, bank_id, snapshot_date);

create index if not exists idx_balance_snapshots_bank
  on balance_snapshots(bank_id, snapshot_date desc);

create index if not exists idx_balance_snapshots_user
  on balance_snapshots(user_id);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────

alter table balance_snapshots enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'balance_snapshots' and policyname = 'Users can select own balance_snapshots'
  ) then
    create policy "Users can select own balance_snapshots"
      on balance_snapshots for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'balance_snapshots' and policyname = 'Users can insert own balance_snapshots'
  ) then
    create policy "Users can insert own balance_snapshots"
      on balance_snapshots for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'balance_snapshots' and policyname = 'Users can update own balance_snapshots'
  ) then
    create policy "Users can update own balance_snapshots"
      on balance_snapshots for update
      using (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'balance_snapshots' and policyname = 'Users can delete own balance_snapshots'
  ) then
    create policy "Users can delete own balance_snapshots"
      on balance_snapshots for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- ── 3. Migrate old is_balance_adjustment transactions ─────────────────────────
-- For each old adjustment transaction (type = income means the balance was higher
-- than expected, type = expense means it was lower), calculate the running balance
-- of that bank account up to and including the adjustment date, then store it as a
-- snapshot. Finally delete the original adjustment transaction.
--
-- This block is idempotent: it only touches rows with is_balance_adjustment = true
-- that have a bank_id, and uses ON CONFLICT DO UPDATE so re-running is safe.

do $$
declare
  migrated_count int := 0;
  deleted_count  int := 0;
begin
  -- Insert snapshots for every is_balance_adjustment transaction that has a bank_id
  insert into balance_snapshots (user_id, bank_id, snapshot_date, balance)
  select
    t.user_id,
    t.bank_id,
    t.date::date                         as snapshot_date,
    -- Running balance of the bank account at end of the adjustment date:
    -- initial_balance + net of ALL transactions (including the adjustment itself)
    -- up to and including that date, plus net of transfers up to that date.
    b.initial_balance
      + coalesce((
          select sum(case when t2.type = 'income' then t2.amount else -t2.amount end)
          from   transactions t2
          where  t2.bank_id  = t.bank_id
            and  t2.user_id  = t.user_id
            and  t2.date    <= t.date
        ), 0)
      + coalesce((
          select sum(-tr.amount)
          from   transfers tr
          where  tr.from_bank_id = t.bank_id
            and  tr.user_id      = t.user_id
            and  tr.date        <= t.date::date
        ), 0)
      + coalesce((
          select sum(tr.amount)
          from   transfers tr
          where  tr.to_bank_id = t.bank_id
            and  tr.user_id    = t.user_id
            and  tr.date      <= t.date::date
        ), 0)                             as balance
  from  transactions t
  join  banks        b on b.id = t.bank_id
  where t.is_balance_adjustment = true
    and t.bank_id is not null
  on conflict (user_id, bank_id, snapshot_date)
    do update set
      balance    = excluded.balance,
      created_at = now();

  get diagnostics migrated_count = row_count;

  -- Delete the old adjustment transactions (only those with a bank_id that we just migrated)
  delete from transactions
  where is_balance_adjustment = true
    and bank_id is not null;

  get diagnostics deleted_count = row_count;

  raise notice 'balance_snapshots migration: % snapshot(s) created/updated, % old adjustment transaction(s) removed.',
    migrated_count, deleted_count;
end $$;
