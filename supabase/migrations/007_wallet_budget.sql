-- Per-wallet budget support
-- Adds wallet_id to budgets so a single table handles 3 budget kinds:
--   wallet_id NULL + category_id NULL = total monthly budget (existing)
--   wallet_id NULL + category_id X    = per-category budget (future)
--   wallet_id X    + category_id NULL = per-wallet budget   (this migration)

alter table budgets
  add column if not exists wallet_id uuid references wallets(id) on delete cascade;

-- Drop old uniqueness (auto-named by PG)
alter table budgets drop constraint if exists budgets_user_id_category_id_month_key;

-- Clean up duplicate rows BEFORE creating the new constraint
delete from budgets
where id not in (
  select distinct on (
    user_id,
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'),
    coalesce(wallet_id, '00000000-0000-0000-0000-000000000000'),
    month
  ) id
  from budgets
  order by
    user_id,
    coalesce(category_id, '00000000-0000-0000-0000-000000000000'),
    coalesce(wallet_id, '00000000-0000-0000-0000-000000000000'),
    month,
    amount desc
);

-- Now safely create unique index using COALESCE to handle NULLs
drop index if exists budgets_unique_idx;
create unique index budgets_unique_idx
  on budgets (user_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'), coalesce(wallet_id, '00000000-0000-0000-0000-000000000000'), month);
