-- 019: Atomic referral grant + payment hardening (H-03, M-12, M-13)

-- ── H-03: Atomic referral reward grant ───────────────────────
-- Prevents double-credits when verify-payment and midtrans-webhook
-- race. Uses UPDATE ... WHERE rewarded = false returning exactly 1 row.
create or replace function grant_referral_reward(
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
  select ru.id, ru.referrer_user_id
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

  v_referrer := v_referral_use.referrer_user_id;

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

  -- Check if referrer has earned a VIP voucher (every 3 successful referrals)
  select count(*)::int into v_total_referrals
  from public.referral_uses
  where referrer_user_id = v_referrer and rewarded = true;

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

revoke all on function grant_referral_reward(uuid) from public;
revoke all on function grant_referral_reward(uuid) from anon;
revoke all on function grant_referral_reward(uuid) from authenticated;
grant execute on function grant_referral_reward(uuid) to service_role;
