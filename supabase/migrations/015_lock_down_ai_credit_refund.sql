-- 015: close the refund_ai_credit privilege-escalation hole.
--
-- refund_ai_credit() is SECURITY DEFINER with an uncapped `ai_credits + 1` and no
-- proof that a credit was ever consumed. It was granted to `authenticated`, so any
-- logged-in user could call it directly from the browser in a loop and mint unlimited
-- AI credits, defeating both the free tier and the referral reward economy.
--
-- SECURITY DEFINER bypasses the column-level grant on users (name, avatar_url only),
-- which is why migration 009's hardening did not catch this. increment_ai_credits was
-- already revoked correctly; this brings refund into line.
--
-- Edge Functions still need to refund a credit when a call fails after consumption,
-- so the capability moves to an explicit-user-id variant that only service_role can
-- execute. Functions must call it with a service-role client.

-- Service-role-only refund, scoped to an explicit user.
create or replace function public.refund_ai_credit_for(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'refund_ai_credit_for: p_user_id is required';
  end if;

  update public.users
  set ai_credits = ai_credits + 1
  where id = p_user_id;
end;
$$;

revoke all on function public.refund_ai_credit_for(uuid) from public;
revoke all on function public.refund_ai_credit_for(uuid) from anon;
revoke all on function public.refund_ai_credit_for(uuid) from authenticated;
grant execute on function public.refund_ai_credit_for(uuid) to service_role;

-- Drop the zero-argument version entirely rather than leaving it granted to nobody:
-- a leftover SECURITY DEFINER function with `auth.uid()` semantics is exactly the
-- shape that gets re-granted by accident later.
drop function if exists public.refund_ai_credit();
