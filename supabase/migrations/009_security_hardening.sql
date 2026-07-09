-- =====================================================
-- 009 — Security Hardening Migration
-- Fixes: C-1, C-2, C-3, H-1, H-3 from SECURITY_REVIEW.md
-- =====================================================

-- ─────────────────────────────────────────────────────
-- C-1: Lock down users table — prevent self-granting VIP / credits
-- ─────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────
-- C-2: Lock down subscriptions table — remove dangerous permissive policy
-- ─────────────────────────────────────────────────────

-- Remove the wildcard policy that lets any user insert/update subscriptions
drop policy if exists "Service role manages subs" on subscriptions;

-- Keep the read-only policy (already exists in 006_subscriptions.sql):
-- Users can only SELECT their own subscriptions.
-- Edge Functions use service_role key which bypasses RLS anyway,
-- so they don't need a permissive insert/update policy.

-- ─────────────────────────────────────────────────────
-- C-3: Server-side claim_trial() — one-time only
-- ─────────────────────────────────────────────────────

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
        or trial_ends_at <= now()  -- expired trial can be re-claimed? No — only NULL
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

-- ─────────────────────────────────────────────────────
-- H-1: Atomic AI credit consumption (no race condition)
-- ─────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────
-- H-3: Rate limiting system
-- ─────────────────────────────────────────────────────

create table if not exists rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (user_id, action, window_start)
);

alter table rate_limits enable row level security;

-- No direct user access — only via RPC
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

-- ─────────────────────────────────────────────────────
-- M-7: Safe profile update function (alternative to direct UPDATE)
-- ─────────────────────────────────────────────────────

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
