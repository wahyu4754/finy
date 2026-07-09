-- Referral system
-- User invites friends; when a referred user subscribes, the referrer earns credits.
-- After 3 subscribed referrals the referrer gets a free 1-month VIP voucher.

-- ── Extend users table ──────────────────────────────────────────────
-- ai_credits already exists from migration 003; only add new columns here
alter table users
  add column if not exists referred_by_code  text,
  add column if not exists has_vip_voucher   boolean not null default false;

-- ── Referral codes (one per user, generated on demand) ──────────────
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

-- ── Referral uses (tracks who used whose code) ──────────────────────
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

-- ── RPC: get_or_create_referral_code() ─────────────────────────────
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

-- ── RPC: get_referral_stats() ───────────────────────────────────────
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

-- ── RPC: apply_referral_code(code) ─────────────────────────────────
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

-- ── RPC: redeem_vip_voucher() ───────────────────────────────────────
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

-- ── RPC: increment_ai_credits(user_id, amount) ──────────────────────
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

-- Service role only — not callable by clients directly
revoke all on function increment_ai_credits(uuid, integer) from public;
revoke all on function increment_ai_credits(uuid, integer) from authenticated;
