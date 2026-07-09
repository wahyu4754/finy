-- 013 — Prevent referral abuse after account deletion & re-registration
--
-- Problem: User A signs up, uses referral code (gets +5 credits), deletes
-- account, re-registers with same email, uses referral code again → infinite credits.
--
-- Solution: A permanent log table keyed on email that is NOT cascade-deleted
-- when the user account is removed. The apply_referral_code() function checks
-- this log before granting any bonus.

-- ── Permanent referral claims log (survives account deletion) ────────
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

-- No direct client access — only via RPC (security definer)
create policy "No direct access" on referral_claims_log for all using (false);

-- ── Updated apply_referral_code: checks permanent log ───────────────
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

  -- 5. ★ ANTI-CHEAT: Check permanent log — has this email EVER claimed a referral?
  select exists(
    select 1 from referral_claims_log where lower(email) = lower(caller_email)
  ) into already_claimed;

  if already_claimed then
    raise exception 'Email ini sudah pernah menggunakan kode referral sebelumnya';
  end if;

  -- 6. All checks passed — apply the referral
  update users set referred_by_code = upper(p_code) where id = auth.uid();

  insert into referral_uses (referrer_id, referred_user_id, rewarded)
  values (referrer, auth.uid(), false)
  on conflict (referred_user_id) do nothing;

  -- Welcome bonus: +5 AI credits for the new user
  update users set ai_credits = ai_credits + 5 where id = auth.uid();

  -- 7. ★ Write to permanent log (survives account deletion)
  insert into referral_claims_log (email, code_used, referrer_id, bonus_given)
  values (caller_email, upper(p_code), referrer, 5);

  return true;
end;
$$ language plpgsql security definer;

revoke all on function apply_referral_code(text) from public;
grant execute on function apply_referral_code(text) to authenticated;
