-- 014 — Referral detail views
-- Adds an RPC that returns the list of referred users with their names,
-- subscription status, and reward info for the referral dashboard.

create or replace function get_referral_details()
returns json as $$
declare
  result json;
begin
  select coalesce(json_agg(row_to_json(r)), '[]'::json) into result
  from (
    select
      ru.referred_user_id   as user_id,
      coalesce(u.name, u.email, 'Pengguna')  as name,
      ru.rewarded           as subscribed,
      ru.created_at         as joined_at,
      case when ru.rewarded then 5 else 0 end as credits_earned
    from referral_uses ru
    left join users u on u.id = ru.referred_user_id
    where ru.referrer_id = auth.uid()
    order by ru.created_at desc
  ) r;

  return result;
end;
$$ language plpgsql security definer;

revoke all on function get_referral_details() from public;
grant execute on function get_referral_details() to authenticated;
