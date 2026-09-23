-- 021: Fix grant_referral_reward() — wrong column name from 019
--
-- 019 created grant_referral_reward() referencing `referrer_user_id`, but the
-- column created in 011 (and used consistently by 011, 012, 013 and 014) is
-- `referrer_id`. There is no rename migration.
--
-- plpgsql resolves column names when a statement first executes, not at CREATE
-- FUNCTION time, and the SELECT INTO target is a `record`, so the function was
-- created successfully and only throws at runtime:
--   column ru.referrer_user_id does not exist
--
-- Both callers — verify-payment and midtrans-webhook — invoke it without
-- checking the RPC error, so referral rewards have been failing silently:
-- referrers never received their +5 AI credits and never earned the VIP voucher
-- at every third referral.
--
-- 019 is left untouched because it has already been applied; replacing the
-- function here keeps the migration history honest and is what actually repairs
-- the deployed database.

create or replace function public.grant_referral_reward(
  p_referred_user_id uuid
)
returns table (referrer_id uuid, credits_awarded int, voucher_granted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral_use record;
  v_referrer uuid;
  v_total_referrals int;
begin
  -- Atomically claim the referral reward (check-then-act in one statement)
  select ru.id, ru.referrer_id
  into v_referral_use
  from public.referral_uses ru
  where ru.referred_user_id = p_referred_user_id
    and ru.rewarded = false
  for update;

  if v_referral_use is null then
    -- Already rewarded or no referral found
    return query select null::uuid, 0, false;
    return;
  end if;

  v_referrer := v_referral_use.referrer_id;

  -- Mark as rewarded (atomic — only one caller can succeed)
  update public.referral_uses
  set rewarded = true
  where id = v_referral_use.id and rewarded = false;

  get diagnostics v_total_referrals = row_count;
  if v_total_referrals = 0 then
    -- Lost the race
    return query select null::uuid, 0, false;
    return;
  end if;

  -- Grant AI credits to referrer
  perform public.increment_ai_credits(v_referrer, 5);

  -- Check if referrer has earned a VIP voucher (every 3 successful referrals).
  --
  -- `ru2` is not cosmetic: this function declares an OUT parameter named
  -- referrer_id, so an unqualified `referrer_id` here is ambiguous between the
  -- variable and the column and plpgsql raises an error rather than guessing.
  -- The same applies to `rewarded`, which is why both are qualified.
  select count(*)::int into v_total_referrals
  from public.referral_uses ru2
  where ru2.referrer_id = v_referrer
    and ru2.rewarded = true;

  if v_total_referrals % 3 = 0 then
    -- Grant voucher (increment counter)
    update public.users
    set has_vip_voucher = true
    where id = v_referrer;

    return query select v_referrer, 5, true;
  else
    return query select v_referrer, 5, false;
  end if;
end;
$$;

revoke all on function public.grant_referral_reward(uuid) from public;
revoke all on function public.grant_referral_reward(uuid) from anon;
revoke all on function public.grant_referral_reward(uuid) from authenticated;
grant execute on function public.grant_referral_reward(uuid) to service_role;
