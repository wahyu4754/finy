-- 005_category_simplification.sql
-- Tier policy: Free + VIP both get 5 expense + 5 income SYSTEM defaults.
-- VIP can ADD custom categories on top (already enforced via existing RLS).
--
-- Strategy: archive (don't delete) the 3 less-common expense defaults so any
-- existing transactions referencing them remain valid. Then seed 3 new income
-- defaults to bring income system count up to 5.

-- 1. Add archive flag (categories archived = not shown in pickers, but still
--    referenceable so old transactions display correctly).
alter table categories
  add column if not exists is_archived boolean default false;

-- 2. Archive the 3 expense defaults that aren't part of the core 5.
update categories
set is_archived = true
where user_id is null
  and type = 'expense'
  and name in ('Jajan', 'Hiburan', 'Kesehatan');

-- 3. Add 3 new income defaults to reach 5 total income system categories.
do $$
begin
  if not exists (select 1 from categories where user_id is null and name = 'Freelance' and type = 'income') then
    insert into categories (name, icon, color, type, is_default)
    values ('Freelance', 'Briefcase', '#3B82F6', 'income', true);
  end if;

  if not exists (select 1 from categories where user_id is null and name = 'Investasi' and type = 'income') then
    insert into categories (name, icon, color, type, is_default)
    values ('Investasi', 'TrendingUp', '#8B5CF6', 'income', true);
  end if;

  if not exists (select 1 from categories where user_id is null and name = 'Hadiah' and type = 'income') then
    insert into categories (name, icon, color, type, is_default)
    values ('Hadiah', 'Sparkles', '#EC4899', 'income', true);
  end if;
end $$;
