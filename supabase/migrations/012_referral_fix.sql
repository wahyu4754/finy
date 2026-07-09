-- 012 — Referral system fixes
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
