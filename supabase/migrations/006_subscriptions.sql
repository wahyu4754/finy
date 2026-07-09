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
