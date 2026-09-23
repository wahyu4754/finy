-- 018: Server-side VIP expiry, activate_subscription RPC, AI daily quota (C-07, M-10, C-16)

-- ── C-07: pg_cron job to expire VIP ──────────────────────────
-- Expires VIP status when vip_until has passed.
-- Runs every hour. Requires pg_cron extension.
create extension if not exists pg_cron;

select cron.schedule(
  'expire-vip-hourly',
  '0 * * * *',
  $$ update users set is_vip = false where is_vip = true and vip_until is not null and vip_until < now() $$
);

-- ── M-10: activate_subscription RPC ──────────────────────────
-- Extends vip_until from the greater of (current vip_until, now()) so
-- early renewals don't destroy paid time. Called from both verify-payment
-- and midtrans-webhook to ensure they can't diverge.
create or replace function activate_subscription(
  p_order_id text,
  p_duration_days int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_updated int;
begin
  -- Atomically flip the subscription from pending → active
  update public.subscriptions
  set status = 'active',
      expires_at = now() + (p_duration_days || ' days')::interval
  where order_id = p_order_id
    and status = 'pending';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return false;
  end if;

  -- Get the user_id from the now-active subscription
  select user_id into v_user_id
  from public.subscriptions
  where order_id = p_order_id and status = 'active';

  -- Extend VIP (never destroy existing paid time)
  update public.users
  set is_vip = true,
      vip_until = greatest(coalesce(vip_until, now()), now()) + (p_duration_days || ' days')::interval
  where id = v_user_id;

  return true;
end;
$$;

revoke all on function activate_subscription(text, int) from public;
revoke all on function activate_subscription(text, int) from anon;
revoke all on function activate_subscription(text, int) from authenticated;
grant execute on function activate_subscription(text, int) to service_role;

-- ── C-16: Server-side AI daily quota check ───────────────────
-- Returns the user's current daily usage and whether they are VIP.
-- Edge functions call this instead of trusting client-side counters.
create or replace function check_ai_daily_quota()
returns table (is_vip boolean, used_today int, max_allowed int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_vip boolean;
  v_used int;
begin
  select coalesce(u.is_vip, false) into v_is_vip
  from public.users u where u.id = v_user_id;

  -- Count today's AI function invocations from rate_limits
  select coalesce(count(*), 0)::int into v_used
  from public.rate_limits
  where user_id = v_user_id
    and action = 'ai_call'
    and window_start >= current_date;

  return query select
    v_is_vip,
    v_used,
    case when v_is_vip then 50 else 1 end;
end;
$$;

revoke all on function check_ai_daily_quota() from public;
revoke all on function check_ai_daily_quota() from anon;
revoke all on function check_ai_daily_quota() from authenticated;
grant execute on function check_ai_daily_quota() to service_role;

-- ── Record an AI call in rate_limits ─────────────────────────
create or replace function consume_ai_daily_quota()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
begin
  insert into public.rate_limits (user_id, action, window_start, count)
  values (v_user_id, 'ai_call', v_today, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.rate_limits.count + 1;
end;
$$;

revoke all on function consume_ai_daily_quota() from public;
revoke all on function consume_ai_daily_quota() from anon;
revoke all on function consume_ai_daily_quota() from authenticated;
grant execute on function consume_ai_daily_quota() to service_role;
