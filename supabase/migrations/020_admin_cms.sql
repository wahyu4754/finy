-- 020: Admin CMS — moderator flags, append-only audit log, management RPCs
--
-- Adds the pieces the /admin CMS needs to manage users and subscriptions.
-- Safe to re-run: every statement is idempotent.

-- ── 1. Moderator + suspension flags on public.users ──────────
-- is_admin  : grants access to /admin. Verified server-side per request in
--             src/lib/admin-auth.ts, never read from a client claim.
-- is_banned : suspends the account. Enforced in src/middleware.ts.
alter table public.users
  add column if not exists is_admin  boolean not null default false;

alter table public.users
  add column if not exists is_banned boolean not null default false;

-- ── 2. Protect the privileged columns from self-escalation ───
-- Migration 009 already ran:
--     revoke update on users from authenticated;
--     grant update (name, avatar_url) on users to authenticated;
-- Column-level grants are an exhaustive allowlist, so is_admin and is_banned —
-- added above — are NOT updatable by a signed-in user. A user cannot promote
-- themselves, and no extra trigger is needed to stop them.
--
-- Only service_role (the CMS route handlers and Edge Functions) and the postgres
-- role (SQL editor / migrations) can write these columns.
--
-- anon is closed off too. RLS would already return no rows for an anonymous
-- UPDATE (auth.uid() is null, so `auth.uid() = id` never matches), but 009 only
-- revoked from authenticated — removing the grant here means the protection does
-- not depend on RLS being enabled.
revoke update on public.users from anon;

-- Verify after applying (run in the SQL editor):
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'users'
--     and privilege_type = 'UPDATE'
--   order by grantee, column_name;
-- Expected: authenticated may UPDATE only name and avatar_url.

-- ── 3. Audit log ─────────────────────────────────────────────
-- Every CMS mutation writes one row here: who did it, to whom, and the exact
-- before → after values. This is what makes an admin mistake reversible and a
-- compromised admin account detectable.
create table if not exists public.admin_audit_log (
  id                bigint generated always as identity primary key,
  admin_id          uuid references public.users(id) on delete set null,
  admin_email       text,
  target_user_id    uuid,
  target_user_email text,
  action            text not null,
  changes           jsonb not null default '{}'::jsonb,
  reason            text,
  ip_address        text,
  user_agent        text,
  created_at        timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

-- No policies are created, so anon and authenticated see nothing. The CMS reads
-- and writes this table with the service-role key, which bypasses RLS.
-- Deliberately no UPDATE or DELETE path: an audit log an admin can edit is not
-- an audit log.
drop policy if exists "Deny all admin_audit_log" on public.admin_audit_log;
create policy "Deny all admin_audit_log" on public.admin_audit_log
  for select using (false);

create index if not exists idx_audit_created_at on public.admin_audit_log (created_at desc);
create index if not exists idx_audit_target_user on public.admin_audit_log (target_user_id, created_at desc);
create index if not exists idx_audit_admin on public.admin_audit_log (admin_id, created_at desc);
create index if not exists idx_audit_action on public.admin_audit_log (action);

-- ── 4. List + sort indexes on users ──────────────────────────
-- These serve the CMS user table: ordering by signup date, and filtering by VIP
-- state with the same ordering.
create index if not exists idx_users_created_at_desc
  on public.users (created_at desc);

create index if not exists idx_users_is_vip_created_at
  on public.users (is_vip, created_at desc);

create index if not exists idx_users_email
  on public.users (email);

-- Search uses ILIKE '%term%' on name and email, which a B-tree cannot serve.
-- At the current table size a sequential scan is fast enough, so no trigram
-- index is created here — enabling pg_trgm would add a migration failure mode
-- for no measurable gain. If users grows past roughly 100k rows, add:
--   create extension if not exists pg_trgm with schema extensions;
--   create index on public.users using gin (email gin_trgm_ops);
--   create index on public.users using gin (name  gin_trgm_ops);

-- ── 5. Atomic user management RPC ────────────────────────────
-- PostgREST cannot wrap several calls in one transaction, so a CMS that updated
-- users, then subscriptions, then the audit log could fail halfway and leave an
-- unaudited or half-applied change. This function does all three atomically.
--
-- It also whitelists every mutable column: fields are applied through explicit
-- branches, never through dynamic SQL, so a crafted request body cannot reach
-- is_admin or any other column.
create or replace function public.admin_manage_user(
  p_admin_id  uuid,
  p_target_id uuid,
  p_updates   jsonb default '{}'::jsonb,
  p_vip       jsonb default null,
  p_action    text  default 'user.update',
  p_reason    text  default null,
  p_ip        text  default null,
  p_ua        text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before   jsonb;
  v_after    jsonb;
  v_changes  jsonb := '{}'::jsonb;
  v_admin_email  text;
  v_target_email text;
  v_key      text;
  v_mode     text;
  v_days     int;
  v_until    timestamptz;
  v_subs_cancelled int := 0;
begin
  -- Access is controlled by the GRANT at the end of this section: only
  -- service_role can execute the function. This follows activate_subscription()
  -- and grant_referral_reward() instead of re-checking the JWT role at runtime,
  -- which would add a failure mode without adding any real protection.
  select email into v_admin_email from public.users where id = p_admin_id;
  if v_admin_email is null then
    raise exception 'admin_manage_user: unknown admin %', p_admin_id;
  end if;

  -- Lock the target row so two concurrent admins cannot interleave, and
  -- snapshot it for the audit diff.
  select row_to_json(u)::jsonb into v_before
  from public.users u
  where u.id = p_target_id
  for update;

  if v_before is null then
    raise exception 'admin_manage_user: target user % not found', p_target_id;
  end if;

  v_target_email := v_before->>'email';

  -- Whitelisted profile fields.
  update public.users set
    name = case when jsonb_exists(p_updates, 'name')
      then nullif(trim(p_updates->>'name'), '')::text else name end,
    ai_credits = case when jsonb_exists(p_updates, 'ai_credits')
      then greatest(0, (p_updates->>'ai_credits')::int) else ai_credits end,
    trial_ends_at = case when jsonb_exists(p_updates, 'trial_ends_at')
      then nullif(p_updates->>'trial_ends_at', '')::timestamptz else trial_ends_at end,
    has_vip_voucher = case when jsonb_exists(p_updates, 'has_vip_voucher')
      then (p_updates->>'has_vip_voucher')::boolean else has_vip_voucher end,
    referral_credits_earned = case when jsonb_exists(p_updates, 'referral_credits_earned')
      then greatest(0, (p_updates->>'referral_credits_earned')::int) else referral_credits_earned end,
    current_streak = case when jsonb_exists(p_updates, 'current_streak')
      then greatest(0, (p_updates->>'current_streak')::int) else current_streak end,
    is_banned = case when jsonb_exists(p_updates, 'is_banned')
      then (p_updates->>'is_banned')::boolean else is_banned end
  where id = p_target_id;

  -- VIP. Both sources of truth must move together: users.is_vip AND the
  -- subscriptions rows. usePurchasesStore.checkVipStatus() treats an active,
  -- unexpired subscription as VIP even when users.is_vip is false, so revoking
  -- only the flag would silently fail.
  if p_vip is not null then
    v_mode := p_vip->>'mode';

    if v_mode = 'grant' then
      v_days := coalesce((p_vip->>'days')::int, 30);
      if v_days <= 0 then
        raise exception 'admin_manage_user: grant days must be positive';
      end if;

      -- Extend from the later of (current expiry, now) so early renewals do not
      -- destroy paid time. Same semantics as activate_subscription() in 018.
      update public.users
      set is_vip = true,
          vip_until = greatest(coalesce(vip_until, now()), now()) + make_interval(days => v_days)
      where id = p_target_id;

    elsif v_mode = 'set_until' then
      v_until := nullif(p_vip->>'until', '')::timestamptz;
      if v_until is null then
        raise exception 'admin_manage_user: set_until requires a timestamp';
      end if;

      update public.users
      set is_vip = v_until > now(),
          vip_until = v_until
      where id = p_target_id;

      -- An expiry in the past must also clear the subscription rows, otherwise
      -- checkVipStatus() re-grants VIP from them.
      if v_until <= now() then
        update public.subscriptions
        set status = 'cancelled'
        where user_id = p_target_id and status in ('pending', 'active');
        get diagnostics v_subs_cancelled = row_count;
      end if;

    elsif v_mode = 'revoke' then
      update public.users
      set is_vip = false, vip_until = null
      where id = p_target_id;

      update public.subscriptions
      set status = 'cancelled'
      where user_id = p_target_id and status in ('pending', 'active');
      get diagnostics v_subs_cancelled = row_count;

    else
      raise exception 'admin_manage_user: unknown vip mode %', coalesce(v_mode, 'null');
    end if;
  end if;

  select row_to_json(u)::jsonb into v_after
  from public.users u where u.id = p_target_id;

  for v_key in select jsonb_object_keys(v_before)
  loop
    if (v_before->v_key) is distinct from (v_after->v_key) then
      v_changes := v_changes || jsonb_build_object(
        v_key,
        jsonb_build_object('from', v_before->v_key, 'to', v_after->v_key)
      );
    end if;
  end loop;

  if v_subs_cancelled > 0 then
    v_changes := v_changes || jsonb_build_object(
      'subscriptions_cancelled',
      jsonb_build_object('from', 0, 'to', v_subs_cancelled)
    );
  end if;

  insert into public.admin_audit_log
    (admin_id, admin_email, target_user_id, target_user_email, action, changes, reason, ip_address, user_agent)
  values
    (p_admin_id, v_admin_email, p_target_id, v_target_email, p_action, v_changes, p_reason, p_ip, p_ua);

  return jsonb_build_object('before', v_before, 'after', v_after, 'changes', v_changes);
end;
$$;

revoke all on function public.admin_manage_user(uuid, uuid, jsonb, jsonb, text, text, text, text) from public;
revoke all on function public.admin_manage_user(uuid, uuid, jsonb, jsonb, text, text, text, text) from anon;
revoke all on function public.admin_manage_user(uuid, uuid, jsonb, jsonb, text, text, text, text) from authenticated;
grant execute on function public.admin_manage_user(uuid, uuid, jsonb, jsonb, text, text, text, text) to service_role;

-- ── 6. Standalone audit writer ───────────────────────────────
-- For operations that cannot go through admin_manage_user, e.g. account
-- deletion, where the target row no longer exists afterwards.
create or replace function public.admin_write_audit(
  p_admin_id   uuid,
  p_action     text,
  p_target_id  uuid   default null,
  p_target_email text default null,
  p_changes    jsonb  default '{}'::jsonb,
  p_reason     text   default null,
  p_ip         text   default null,
  p_ua         text   default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_email text;
  v_id bigint;
begin
  -- service_role only, enforced by the GRANT at the end of this section.
  select email into v_admin_email from public.users where id = p_admin_id;
  if v_admin_email is null then
    raise exception 'admin_write_audit: unknown admin %', p_admin_id;
  end if;

  insert into public.admin_audit_log
    (admin_id, admin_email, target_user_id, target_user_email, action, changes, reason, ip_address, user_agent)
  values
    (p_admin_id, v_admin_email, p_target_id, p_target_email, p_action, p_changes, p_reason, p_ip, p_ua)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_write_audit(uuid, text, uuid, text, jsonb, text, text, text) from public;
revoke all on function public.admin_write_audit(uuid, text, uuid, text, jsonb, text, text, text) from anon;
revoke all on function public.admin_write_audit(uuid, text, uuid, text, jsonb, text, text, text) from authenticated;
grant execute on function public.admin_write_audit(uuid, text, uuid, text, jsonb, text, text, text) to service_role;

-- ── 7. Dashboard aggregates ──────────────────────────────────
-- config.toml sets [api] max_rows = 1000, so summing revenue by selecting the
-- amount column from the client would silently cap at 1000 payments and
-- under-report. Aggregating inside the database avoids the cap entirely and
-- replaces nine round trips with one.
create or replace function public.admin_dashboard_stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'totalUsers',           (select count(*) from public.users),
    'vipUsers',             (select count(*) from public.users where is_vip),
    'bannedUsers',          (select count(*) from public.users where is_banned),
    'admins',               (select count(*) from public.users where is_admin),
    'newUsers7d',           (select count(*) from public.users
                             where created_at >= now() - interval '7 days'),
    'newUsers30d',          (select count(*) from public.users
                             where created_at >= now() - interval '30 days'),
    'activeSubscriptions',  (select count(*) from public.subscriptions where status = 'active'),
    'pendingSubscriptions', (select count(*) from public.subscriptions where status = 'pending'),
    'revenue',              (select coalesce(sum(amount), 0)::bigint from public.subscriptions
                             where status in ('active', 'expired'))
  );
$$;

revoke all on function public.admin_dashboard_stats() from public;
revoke all on function public.admin_dashboard_stats() from anon;
revoke all on function public.admin_dashboard_stats() from authenticated;
grant execute on function public.admin_dashboard_stats() to service_role;

-- ── 8. Promote yourself ──────────────────────────────────────
-- Run this in the Supabase SQL editor. It connects as postgres, which holds
-- table-level UPDATE and so is not restricted by the column grants from 009.
-- Replace the address with the account you sign in to /admin with.
--
--   update public.users set is_admin = true where email = 'you@example.com';
--
-- Verify:
--   select id, email, name, is_admin from public.users where is_admin = true;
