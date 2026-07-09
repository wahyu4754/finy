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
-- Row Level Security (CRITICAL — prevents data leaks)
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
