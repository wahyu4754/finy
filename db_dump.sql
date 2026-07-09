-- Finy Database Schema
-- Run this in Supabase SQL editor

-- Users table
create table if not exists users (
  id uuid primary key references auth.users(id),
  email text not null,
  name text not null,
  is_vip boolean default false,
  trial_ends_at timestamptz default (now() + interval '7 days'),
  vip_until timestamptz,
  revenuecat_user_id text,
  created_at timestamptz default now()
);

-- Wallets table
create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  type text check (type in ('cash','bank','ewallet')) not null,
  balance bigint default 0,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Categories table
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade, -- null = default system category
  name text not null,
  icon text not null,
  color text not null,
  type text check (type in ('expense','income')) not null,
  is_default boolean default false
);

-- Transactions table
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  wallet_id uuid references wallets(id),
  category_id uuid references categories(id),
  amount bigint not null,
  type text check (type in ('expense','income')) not null,
  note text,
  receipt_image_url text,
  transaction_date date not null,
  is_recurring boolean default false,
  recurring_period text check (recurring_period in ('monthly','weekly')),
  created_by_ai boolean default false,
  created_at timestamptz default now()
);

-- Budgets table
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  category_id uuid references categories(id), -- null = total budget
  amount bigint not null,
  month text not null, -- 'YYYY-MM'
  unique (user_id, category_id, month)
);

-- AI Conclusions table
create table if not exists ai_conclusions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  month text not null,
  summary text not null,
  insights jsonb not null, -- array of {title, description, type}
  generated_at timestamptz default now(),
  unique (user_id, month)
);

-- =====================================================
-- Row Level Security (CRITICAL â€” prevents data leaks)
-- =====================================================
alter table users enable row level security;
alter table wallets enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table ai_conclusions enable row level security;

-- Users
drop policy if exists "Users access own data" on users;
create policy "Users access own data" on users for all using (auth.uid() = id);

-- Wallets
drop policy if exists "Users own wallets" on wallets;
create policy "Users own wallets" on wallets for all using (auth.uid() = user_id);

-- Categories (read system defaults + own)
drop policy if exists "Users own categories or defaults" on categories;
create policy "Users own categories or defaults" on categories for select using (user_id is null or auth.uid() = user_id);

drop policy if exists "Users mutate own categories" on categories;
create policy "Users mutate own categories" on categories for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own categories" on categories;
create policy "Users update own categories" on categories for update using (auth.uid() = user_id);

drop policy if exists "Users delete own categories" on categories;
create policy "Users delete own categories" on categories for delete using (auth.uid() = user_id);

-- Transactions
drop policy if exists "Users own transactions" on transactions;
create policy "Users own transactions" on transactions for all using (auth.uid() = user_id);

-- Budgets
drop policy if exists "Users own budgets" on budgets;
create policy "Users own budgets" on budgets for all using (auth.uid() = user_id);

-- AI Conclusions
drop policy if exists "Users own conclusions" on ai_conclusions;
create policy "Users own conclusions" on ai_conclusions for all using (auth.uid() = user_id);

-- =====================================================
-- Default Categories Seed (user_id = null = system)
-- =====================================================
insert into categories (name, icon, color, type, is_default) values
  ('Makan', 'UtensilsCrossed', '#F59E0B', 'expense', true),
  ('Jajan', 'Cookie', '#EC4899', 'expense', true),
  ('Transport', 'Car', '#3B82F6', 'expense', true),
  ('Belanja', 'ShoppingBag', '#8B5CF6', 'expense', true),
  ('Hiburan', 'Film', '#EF4444', 'expense', true),
  ('Tagihan', 'Receipt', '#06B6D4', 'expense', true),
  ('Kesehatan', 'Heart', '#10B981', 'expense', true),
  ('Lainnya', 'Package', '#6B7280', 'expense', true),
  ('Gaji', 'Briefcase', '#10B981', 'income', true),
  ('Bonus', 'Gift', '#C5F23C', 'income', true)
on conflict do nothing;

-- =====================================================
-- Trigger: auto-create user record on auth signup
-- =====================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  
  -- Create default wallet
  insert into public.wallets (user_id, name, type, is_default)
  values (new.id, 'Dompet', 'cash', true);
  
  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if any
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- Avatar column + Storage bucket for user avatars
alter table users add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatars publicly readable" on storage.objects;
create policy "Avatars publicly readable" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
-- Add ai_credits column to users table
alter table public.users add column if not exists ai_credits integer default 10;

-- Optional: Update the trigger to explicitly set it to 10 for new users,
-- though the default value handles this automatically.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, ai_credits)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 10);
  
  -- Create default wallet
  insert into public.wallets (user_id, name, type, is_default)
  values (new.id, 'Dompet', 'cash', true);
  
  return new;
end;
$$ language plpgsql security definer;
-- Already handled in 003_wallet_budget.sql
-- This file is intentionally empty.
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
-- Subscriptions table for tracking Midtrans payments (Web/PWA)
-- Android payments are managed by RevenueCat + Google Play Billing

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  order_id text unique not null,
  plan text check (plan in ('monthly','annual')) not null,
  amount bigint not null,
  status text check (status in ('pending','active','expired','cancelled','failed')) default 'pending',
  payment_type text,                       -- 'qris', 'gopay', 'bank_transfer', etc.
  midtrans_transaction_id text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table subscriptions enable row level security;

-- Users can read their own subscriptions
drop policy if exists "Users read own subs" on subscriptions;
create policy "Users read own subs" on subscriptions for select using (auth.uid() = user_id);

-- Only service_role (Edge Functions) can insert/update subscriptions
-- This prevents users from faking subscription status
drop policy if exists "Service role manages subs" on subscriptions;
create policy "Service role manages subs" on subscriptions for all using (true) with check (true);
-- Note: The above policy is permissive but Edge Functions use service_role key
-- which bypasses RLS anyway. The select policy above restricts user reads.

-- Index for quick lookups
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_subscriptions_order_id on subscriptions(order_id);
create index if not exists idx_subscriptions_status on subscriptions(user_id, status);
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
alter table users
  add column if not exists current_streak integer default 0,
  add column if not exists last_transaction_date date;
-- =====================================================
-- 009 â€” Security Hardening Migration
-- Fixes: C-1, C-2, C-3, H-1, H-3 from SECURITY_REVIEW.md
-- =====================================================

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- C-1: Lock down users table â€” prevent self-granting VIP / credits
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Drop the overly permissive "for all" policy
drop policy if exists "Users access own data" on users;

-- Read: allow users to read all their own columns (safe)
create policy "Users read own profile"
  on users for select
  using (auth.uid() = id);

-- Update: users can only update safe columns (name, avatar_url)
-- Privileged columns (is_vip, ai_credits, trial_ends_at, vip_until)
-- can only be modified via service_role (Edge Functions / webhooks).
create policy "Users update own profile"
  on users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Column-level grants: restrict which columns authenticated users can UPDATE
revoke update on users from authenticated;
grant update (name, avatar_url) on users to authenticated;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- C-2: Lock down subscriptions table â€” remove dangerous permissive policy
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Remove the wildcard policy that lets any user insert/update subscriptions
drop policy if exists "Service role manages subs" on subscriptions;

-- Keep the read-only policy (already exists in 006_subscriptions.sql):
-- Users can only SELECT their own subscriptions.
-- Edge Functions use service_role key which bypasses RLS anyway,
-- so they don't need a permissive insert/update policy.

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- C-3: Server-side claim_trial() â€” one-time only
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create or replace function claim_trial()
returns timestamptz as $$
declare
  new_trial_end timestamptz;
begin
  -- Only set trial if user has NEVER claimed (trial_ends_at is the default from signup)
  -- We check if trial_ends_at is within 1 minute of created_at (i.e., never manually claimed)
  update users
    set trial_ends_at = now() + interval '7 days'
    where id = auth.uid()
      and (
        trial_ends_at is null
        or trial_ends_at <= now()  -- expired trial can be re-claimed? No â€” only NULL
      )
    returning trial_ends_at into new_trial_end;

  if new_trial_end is null then
    raise exception 'Trial sudah pernah diklaim atau tidak tersedia';
  end if;

  return new_trial_end;
end;
$$ language plpgsql security definer;

-- Actually, stricter: only allow if trial_ends_at IS NULL (never claimed)
create or replace function claim_trial()
returns timestamptz as $$
declare
  new_trial_end timestamptz;
begin
  update users
    set trial_ends_at = now() + interval '7 days'
    where id = auth.uid()
      and trial_ends_at is null
    returning trial_ends_at into new_trial_end;

  if new_trial_end is null then
    raise exception 'Trial sudah pernah diklaim';
  end if;

  return new_trial_end;
end;
$$ language plpgsql security definer;

revoke all on function claim_trial() from public;
grant execute on function claim_trial() to authenticated;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- H-1: Atomic AI credit consumption (no race condition)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Pre-deduct 1 credit atomically. Returns true if successful.
create or replace function consume_ai_credit()
returns boolean as $$
declare
  rows_updated int;
begin
  update users
    set ai_credits = ai_credits - 1
    where id = auth.uid()
      and ai_credits > 0;
  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$ language plpgsql security definer;

revoke all on function consume_ai_credit() from public;
grant execute on function consume_ai_credit() to authenticated;

-- Refund 1 credit (used when AI call fails after pre-deduction)
create or replace function refund_ai_credit()
returns void as $$
begin
  update users
    set ai_credits = ai_credits + 1
    where id = auth.uid();
end;
$$ language plpgsql security definer;

revoke all on function refund_ai_credit() from public;
grant execute on function refund_ai_credit() to authenticated;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- H-3: Rate limiting system
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create table if not exists rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (user_id, action, window_start)
);

alter table rate_limits enable row level security;

-- No direct user access â€” only via RPC
create policy "No direct access" on rate_limits for all using (false);

create or replace function check_rate_limit(
  p_action text,
  p_max int,
  p_window_minutes int
)
returns boolean as $$
declare
  bucket timestamptz := date_trunc('minute', now()) -
    (extract(minute from now())::int % p_window_minutes) * interval '1 minute';
  current_count int;
begin
  insert into rate_limits (user_id, action, window_start, count)
  values (auth.uid(), p_action, bucket, 1)
  on conflict (user_id, action, window_start)
    do update set count = rate_limits.count + 1
  returning count into current_count;

  return current_count <= p_max;
end;
$$ language plpgsql security definer;

revoke all on function check_rate_limit(text, int, int) from public;
grant execute on function check_rate_limit(text, int, int) to authenticated;

-- Cleanup old rate limit entries (optional, run periodically)
create or replace function cleanup_rate_limits()
returns void as $$
begin
  delete from rate_limits where window_start < now() - interval '1 hour';
end;
$$ language plpgsql security definer;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- M-7: Safe profile update function (alternative to direct UPDATE)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

create or replace function update_my_profile(p_name text, p_avatar_url text default null)
returns void as $$
begin
  update users
    set
      name = coalesce(p_name, name),
      avatar_url = coalesce(p_avatar_url, avatar_url)
    where id = auth.uid();
end;
$$ language plpgsql security definer;

revoke all on function update_my_profile(text, text) from public;
grant execute on function update_my_profile(text, text) to authenticated;
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
-- Referral system
-- User invites friends; when a referred user subscribes, the referrer earns credits.
-- After 3 subscribed referrals the referrer gets a free 1-month VIP voucher.

-- â”€â”€ Extend users table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- ai_credits already exists from migration 003; only add new columns here
alter table users
  add column if not exists referred_by_code  text,
  add column if not exists has_vip_voucher   boolean not null default false;

-- â”€â”€ Referral codes (one per user, generated on demand) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists referral_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references users(id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

alter table referral_codes enable row level security;

-- Anyone can look up a code to verify it exists
drop policy if exists "Public read referral codes" on referral_codes;
create policy "Public read referral codes"
  on referral_codes for select using (true);

-- Users can only insert their own code row
drop policy if exists "Users insert own code" on referral_codes;
create policy "Users insert own code"
  on referral_codes for insert with check (auth.uid() = user_id);

-- â”€â”€ Referral uses (tracks who used whose code) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists referral_uses (
  id                uuid primary key default gen_random_uuid(),
  referrer_id       uuid not null references users(id),
  referred_user_id  uuid not null unique references users(id),
  rewarded          boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table referral_uses enable row level security;

drop policy if exists "Referrers read own uses" on referral_uses;
create policy "Referrers read own uses"
  on referral_uses for select using (auth.uid() = referrer_id);

-- â”€â”€ RPC: get_or_create_referral_code() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function get_or_create_referral_code()
returns text as $$
declare
  existing_code text;
  new_code      text;
  attempts      int := 0;
begin
  select code into existing_code from referral_codes where user_id = auth.uid();
  if existing_code is not null then return existing_code; end if;

  loop
    new_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into referral_codes (user_id, code) values (auth.uid(), new_code);
      return new_code;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then raise exception 'Could not generate unique referral code'; end if;
    end;
  end loop;
end;
$$ language plpgsql security definer;

revoke all on function get_or_create_referral_code() from public;
grant execute on function get_or_create_referral_code() to authenticated;

-- â”€â”€ RPC: get_referral_stats() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function get_referral_stats()
returns json as $$
declare
  user_code          text;
  total_referrals    int;
  subscribed_count   int;
  voucher_available  boolean;
  referral_creds     int;
begin
  select code               into user_code         from referral_codes where user_id = auth.uid();
  select count(*)           into total_referrals   from referral_uses where referrer_id = auth.uid();
  select count(*)           into subscribed_count  from referral_uses where referrer_id = auth.uid() and rewarded = true;
  select has_vip_voucher,
         ai_credits         into voucher_available, referral_creds
                            from users where id = auth.uid();

  return json_build_object(
    'code',        user_code,
    'total',       coalesce(total_referrals, 0),
    'subscribed',  coalesce(subscribed_count, 0),
    'has_voucher', coalesce(voucher_available, false),
    'credits',     coalesce(referral_creds, 0)
  );
end;
$$ language plpgsql security definer;

revoke all on function get_referral_stats() from public;
grant execute on function get_referral_stats() to authenticated;

-- â”€â”€ RPC: apply_referral_code(code) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function apply_referral_code(p_code text)
returns boolean as $$
declare
  referrer uuid;
begin
  select user_id into referrer from referral_codes where code = upper(p_code);
  if referrer is null then
    raise exception 'Kode referral tidak valid';
  end if;
  if referrer = auth.uid() then
    raise exception 'Tidak bisa menggunakan kode referral sendiri';
  end if;
  if (select referred_by_code from users where id = auth.uid()) is not null then
    raise exception 'Kamu sudah pernah menggunakan kode referral';
  end if;

  update users set referred_by_code = upper(p_code) where id = auth.uid();

  insert into referral_uses (referrer_id, referred_user_id, rewarded)
  values (referrer, auth.uid(), false)
  on conflict (referred_user_id) do nothing;

  return true;
end;
$$ language plpgsql security definer;

revoke all on function apply_referral_code(text) from public;
grant execute on function apply_referral_code(text) to authenticated;

-- â”€â”€ RPC: redeem_vip_voucher() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function redeem_vip_voucher()
returns timestamptz as $$
declare
  new_vip_until timestamptz;
  has_voucher   boolean;
begin
  select has_vip_voucher into has_voucher from users where id = auth.uid();
  if not coalesce(has_voucher, false) then
    raise exception 'Tidak ada voucher yang tersedia';
  end if;

  update users
    set
      is_vip        = true,
      vip_until     = greatest(coalesce(vip_until, now()), now()) + interval '1 month',
      has_vip_voucher = false
    where id = auth.uid()
  returning vip_until into new_vip_until;

  return new_vip_until;
end;
$$ language plpgsql security definer;

revoke all on function redeem_vip_voucher() from public;
grant execute on function redeem_vip_voucher() to authenticated;

-- â”€â”€ RPC: increment_ai_credits(user_id, amount) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Called by the midtrans-webhook edge function (service role) to award
-- AI credits when a referred user subscribes.
create or replace function increment_ai_credits(p_user_id uuid, p_amount integer)
returns void as $$
begin
  update users
    set ai_credits = ai_credits + p_amount
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- Service role only â€” not callable by clients directly
revoke all on function increment_ai_credits(uuid, integer) from public;
revoke all on function increment_ai_credits(uuid, integer) from authenticated;
-- 012 â€” Referral system fixes
-- 1. Separate referral-earned credits from spendable ai_credits (fixes 999 display bug)
-- 2. +5 AI credits reward for the new user who applies a referral code

alter table users
  add column if not exists referral_credits_earned integer not null default 0;

-- get_referral_stats: show referral-earned credits, not total spendable ai_credits
create or replace function get_referral_stats()
returns json as $$
declare
  user_code         text;
  total_referrals   int;
  subscribed_count  int;
  voucher_available boolean;
  referral_creds    int;
begin
  select code  into user_code        from referral_codes where user_id = auth.uid();
  select count(*) into total_referrals  from referral_uses where referrer_id = auth.uid();
  select count(*) into subscribed_count from referral_uses where referrer_id = auth.uid() and rewarded = true;
  select has_vip_voucher, referral_credits_earned
    into voucher_available, referral_creds
    from users where id = auth.uid();

  return json_build_object(
    'code',        user_code,
    'total',       coalesce(total_referrals, 0),
    'subscribed',  coalesce(subscribed_count, 0),
    'has_voucher', coalesce(voucher_available, false),
    'credits',     coalesce(referral_creds, 0)
  );
end;
$$ language plpgsql security definer;

revoke all on function get_referral_stats() from public;
grant execute on function get_referral_stats() to authenticated;

-- increment_ai_credits: also track referral_credits_earned alongside spendable credits
create or replace function increment_ai_credits(p_user_id uuid, p_amount integer)
returns void as $$
begin
  update users
    set ai_credits              = ai_credits + p_amount,
        referral_credits_earned = referral_credits_earned + p_amount
  where id = p_user_id;
end;
$$ language plpgsql security definer;

revoke all on function increment_ai_credits(uuid, integer) from public;
revoke all on function increment_ai_credits(uuid, integer) from authenticated;

-- apply_referral_code: reward the new user with +5 AI credits as a welcome bonus
create or replace function apply_referral_code(p_code text)
returns boolean as $$
declare
  referrer uuid;
begin
  select user_id into referrer from referral_codes where code = upper(p_code);
  if referrer is null then
    raise exception 'Kode referral tidak valid';
  end if;
  if referrer = auth.uid() then
    raise exception 'Tidak bisa menggunakan kode referral sendiri';
  end if;
  if (select referred_by_code from users where id = auth.uid()) is not null then
    raise exception 'Kamu sudah pernah menggunakan kode referral';
  end if;

  update users set referred_by_code = upper(p_code) where id = auth.uid();

  insert into referral_uses (referrer_id, referred_user_id, rewarded)
  values (referrer, auth.uid(), false)
  on conflict (referred_user_id) do nothing;

  -- Welcome bonus: +5 AI credits for the new user
  update users set ai_credits = ai_credits + 5 where id = auth.uid();

  return true;
end;
$$ language plpgsql security definer;

revoke all on function apply_referral_code(text) from public;
grant execute on function apply_referral_code(text) to authenticated;
-- 013 â€” Prevent referral abuse after account deletion & re-registration
--
-- Problem: User A signs up, uses referral code (gets +5 credits), deletes
-- account, re-registers with same email, uses referral code again â†’ infinite credits.
--
-- Solution: A permanent log table keyed on email that is NOT cascade-deleted
-- when the user account is removed. The apply_referral_code() function checks
-- this log before granting any bonus.

-- â”€â”€ Permanent referral claims log (survives account deletion) â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists referral_claims_log (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_used   text not null,
  referrer_id uuid,              -- may become dangling after referrer deletes; that's OK
  bonus_given int  not null default 5,
  claimed_at  timestamptz not null default now()
);

-- One referral claim per email, ever
create unique index if not exists idx_referral_claims_email
  on referral_claims_log (lower(email));

alter table referral_claims_log enable row level security;

-- No direct client access â€” only via RPC (security definer)
create policy "No direct access" on referral_claims_log for all using (false);

-- â”€â”€ Updated apply_referral_code: checks permanent log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create or replace function apply_referral_code(p_code text)
returns boolean as $$
declare
  referrer       uuid;
  caller_email   text;
  already_claimed boolean;
begin
  -- 1. Validate the referral code
  select user_id into referrer from referral_codes where code = upper(p_code);
  if referrer is null then
    raise exception 'Kode referral tidak valid';
  end if;

  -- 2. Can't use your own code
  if referrer = auth.uid() then
    raise exception 'Tidak bisa menggunakan kode referral sendiri';
  end if;

  -- 3. Check if this user profile already used a code (current session)
  if (select referred_by_code from users where id = auth.uid()) is not null then
    raise exception 'Kamu sudah pernah menggunakan kode referral';
  end if;

  -- 4. Get the caller's email from auth.users
  select email into caller_email from auth.users where id = auth.uid();

  -- 5. â˜… ANTI-CHEAT: Check permanent log â€” has this email EVER claimed a referral?
  select exists(
    select 1 from referral_claims_log where lower(email) = lower(caller_email)
  ) into already_claimed;

  if already_claimed then
    raise exception 'Email ini sudah pernah menggunakan kode referral sebelumnya';
  end if;

  -- 6. All checks passed â€” apply the referral
  update users set referred_by_code = upper(p_code) where id = auth.uid();

  insert into referral_uses (referrer_id, referred_user_id, rewarded)
  values (referrer, auth.uid(), false)
  on conflict (referred_user_id) do nothing;

  -- Welcome bonus: +5 AI credits for the new user
  update users set ai_credits = ai_credits + 5 where id = auth.uid();

  -- 7. â˜… Write to permanent log (survives account deletion)
  insert into referral_claims_log (email, code_used, referrer_id, bonus_given)
  values (caller_email, upper(p_code), referrer, 5);

  return true;
end;
$$ language plpgsql security definer;

revoke all on function apply_referral_code(text) from public;
grant execute on function apply_referral_code(text) to authenticated;
-- 014 â€” Referral detail views
-- Adds an RPC that returns the list of referred users with their names,
-- subscription status, and reward info for the referral dashboard.

create or replace function get_referral_details()
returns json as $$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(r)), '[]'::json) into result
  from (
    select
      ru.referred_user_id   as user_id,
      coalesce(u.name, u.email, 'Pengguna')  as name,
      ru.rewarded           as subscribed,
      ru.created_at         as joined_at,
      case when ru.rewarded then 5 else 0 end as credits_earned
    from referral_uses ru
    left join users u on u.id = ru.referred_user_id
    where ru.referrer_id = auth.uid()
    order by ru.created_at desc
  ) r;

  return result;
end;
$$ language plpgsql security definer;

revoke all on function get_referral_details() from public;
grant execute on function get_referral_details() to authenticated;
