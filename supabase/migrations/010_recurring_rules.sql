-- Recurring transaction rules
-- Users define rules that auto-fire transactions on a schedule.

create table if not exists recurring_rules (
  id           uuid     primary key default gen_random_uuid(),
  user_id      uuid     not null references users(id) on delete cascade,
  amount       bigint   not null check (amount > 0),
  type         text     not null check (type in ('expense', 'income')),
  category_id  uuid     references categories(id) on delete set null,
  wallet_id    uuid     references wallets(id)    on delete set null,
  note         text,
  frequency    text     not null check (frequency in ('daily', 'weekly', 'monthly')) default 'monthly',
  day_of_month smallint check (day_of_month between 1 and 28), -- used when frequency = 'monthly'
  next_due_date date    not null,
  is_active    boolean  not null default true,
  created_at   timestamptz not null default now()
);

alter table recurring_rules enable row level security;

drop policy if exists "Users own recurring rules" on recurring_rules;
create policy "Users own recurring rules"
  on recurring_rules for all
  using (auth.uid() = user_id);

-- Fast lookup: active rules due for a user
create index if not exists idx_recurring_rules_due
  on recurring_rules (user_id, next_due_date)
  where is_active = true;
