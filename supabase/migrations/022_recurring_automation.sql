-- 022: Server-side recurring transaction automation + Pro gate
--
-- Recurring rules were dead until now: recurring_rules existed and had a UI to
-- list them, but nothing ever created a rule (no form) and nothing ever fired one
-- (processDueRules() in src/store/recurring.ts was never called). Firing them from
-- the browser was never going to work anyway — it only runs while the app is open.
-- This migration moves execution into the database so a rule posts whether or not
-- the user opens Finy that day.

-- ── Link auto-posted transactions back to the rule that produced them ───
alter table public.transactions
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null;

-- Idempotency. cron can re-run (retry, manual trigger, overlapping schedules) and
-- must never post the same occurrence twice; every insert below is
-- ON CONFLICT DO NOTHING against this index.
create unique index if not exists uq_tx_recurring_occurrence
  on public.transactions (recurring_rule_id, transaction_date)
  where recurring_rule_id is not null;

-- The "transaksi rutin baru dicatat" undo banner on Home reads this.
create index if not exists idx_tx_recurring_recent
  on public.transactions (user_id, created_at desc)
  where recurring_rule_id is not null;

-- recurring_period rejected 'daily' even though recurring_rules.frequency allows it,
-- so a daily rule could never be recorded faithfully.
alter table public.transactions drop constraint if exists transactions_recurring_period_check;
alter table public.transactions
  add constraint transactions_recurring_period_check
  check (recurring_period in ('daily', 'weekly', 'monthly'));

-- ── VIP check that honours both sources of truth ───────────────────────────
-- users.is_vip is flipped by the hourly cron in migration 018 and by the admin
-- CMS, while subscriptions is what verify-payment/midtrans-webhook write. A gate
-- that reads only one of them shows a paying member as free in the window between
-- the two, so read both.
create or replace function public.is_currently_vip(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.users u
           where u.id = p_user_id
             and (u.is_vip = true or u.vip_until > now())
         )
      or exists (
           select 1 from public.subscriptions s
           where s.user_id = p_user_id
             and s.status = 'active'
             and s.expires_at > now()
         );
$$;

revoke all on function public.is_currently_vip(uuid) from public;
revoke all on function public.is_currently_vip(uuid) from anon;
grant execute on function public.is_currently_vip(uuid) to authenticated;
grant execute on function public.is_currently_vip(uuid) to service_role;

-- ── RLS: recurring is a Pro feature ────────────────────────────────────────
-- Read and delete stay open to every owner on purpose: a lapsed member must still
-- be able to see and clean up the rules they created while they were paying.
drop policy if exists "Users insert own recurring rules" on public.recurring_rules;
create policy "Pro users insert own recurring rules"
  on public.recurring_rules for insert
  with check (
    auth.uid() = user_id
    and public.is_currently_vip(auth.uid())
    and exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid())
    and (
      category_id is null
      or exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
    )
  );

drop policy if exists "Users update own recurring rules" on public.recurring_rules;
create policy "Pro users update own recurring rules"
  on public.recurring_rules for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.is_currently_vip(auth.uid())
    and (
      wallet_id is null
      or exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid())
    )
    and (
      category_id is null
      or exists (select 1 from public.categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
    )
  );

-- ── Schedule arithmetic ───────────────────────────────────────────────────
-- Returns the next occurrence after p_from, or (when p_min is given) the first
-- occurrence strictly after p_min. Clamping the monthly day to 28 is deliberate:
-- a rule created on the 31st would otherwise roll over to the 1st of the month
-- after and then stay there, because date arithmetic on '2026-01-31 + 1 month'
-- normalises to 2026-03-03 in Postgres.
create or replace function public.next_recurring_occurrence(
  p_from         date,
  p_frequency    text,
  p_day_of_month integer default null,
  p_min          date    default null
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_next  date := p_from;
  v_day   integer := least(coalesce(p_day_of_month, extract(day from p_from)::integer), 28);
  v_guard integer := 0;
begin
  loop
    v_next := case p_frequency
      when 'weekly'  then v_next + 7
      when 'monthly' then (date_trunc('month', v_next) + interval '1 month'
                             + make_interval(days => v_day - 1))::date
      else v_next + 1  -- 'daily', and any unknown value degrades to daily
    end;

    v_guard := v_guard + 1;
    exit when p_min is null or v_next > p_min or v_guard > 800;
  end loop;

  return v_next;
end;
$$;

revoke all on function public.next_recurring_occurrence(date, text, integer, date) from public;
revoke all on function public.next_recurring_occurrence(date, text, integer, date) from anon;
revoke all on function public.next_recurring_occurrence(date, text, integer, date) from authenticated;

-- ── The processor ─────────────────────────────────────────────────────────
-- SECURITY DEFINER because it writes transactions for every user; only the cron
-- role and service_role may call it. The wallet balance is maintained by the
-- migration 017 insert trigger, so posting here keeps balances correct without
-- duplicating that arithmetic.
create or replace function public.process_recurring_due_rules()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- The whole product is Indonesian and next_due_date is a wall-clock date the
  -- user picked, so "today" must be read in WIB. current_date is UTC here, which
  -- would post a rule dated today up to 7 hours late.
  v_today      date := (now() at time zone 'Asia/Jakarta')::date;
  v_rule       record;
  v_due        date;
  v_loops      integer;
  v_rows       integer;
  v_posted     integer := 0;
  -- Bound on backfill per rule per run. cron runs daily so this only bites after
  -- an outage; without it a daily rule left for a year would post 365 rows in one
  -- transaction and a user returning from a long absence would find their history
  -- silently rewritten.
  c_max_catchup constant integer := 3;
begin
  for v_rule in
    select r.id, r.user_id, r.wallet_id, r.category_id, r.amount, r.type, r.note,
           r.frequency, r.day_of_month, r.next_due_date
    from public.recurring_rules r
    where r.is_active = true
      and r.next_due_date <= v_today
    order by r.next_due_date, r.id
    for update skip locked
  loop
    -- wallets/categories are ON DELETE SET NULL, so a rule can outlive the wallet
    -- it points at. Deactivate rather than fail the same way every single day.
    if v_rule.wallet_id is null or v_rule.category_id is null then
      update public.recurring_rules set is_active = false where id = v_rule.id;
      continue;
    end if;

    -- Lapsed member: don't post, and don't leave next_due_date in the past —
    -- otherwise resubscribing replays a burst of stale charges. Fast-forward
    -- instead; renewing resumes from the next real occurrence.
    if not public.is_currently_vip(v_rule.user_id) then
      update public.recurring_rules
      set next_due_date = public.next_recurring_occurrence(
            v_rule.next_due_date, v_rule.frequency, v_rule.day_of_month, v_today)
      where id = v_rule.id;
      continue;
    end if;

    v_due   := v_rule.next_due_date;
    v_loops := 0;

    while v_due <= v_today and v_loops < c_max_catchup loop
      insert into public.transactions (
        user_id, wallet_id, category_id, amount, type, note,
        transaction_date, is_recurring, recurring_period, created_by_ai, recurring_rule_id
      )
      values (
        v_rule.user_id, v_rule.wallet_id, v_rule.category_id, v_rule.amount, v_rule.type,
        coalesce(nullif(btrim(v_rule.note), ''), 'Transaksi rutin'),
        v_due, true, v_rule.frequency, false, v_rule.id
      )
      on conflict do nothing;

      get diagnostics v_rows = row_count;
      v_posted := v_posted + v_rows;

      v_loops := v_loops + 1;
      v_due := public.next_recurring_occurrence(v_due, v_rule.frequency, v_rule.day_of_month);
    end loop;

    update public.recurring_rules
    set next_due_date = public.next_recurring_occurrence(
          v_rule.next_due_date, v_rule.frequency, v_rule.day_of_month, v_today)
    where id = v_rule.id;
  end loop;

  return v_posted;
end;
$$;

revoke all on function public.process_recurring_due_rules() from public;
revoke all on function public.process_recurring_due_rules() from anon;
revoke all on function public.process_recurring_due_rules() from authenticated;
grant execute on function public.process_recurring_due_rules() to service_role;

-- ── Daily cron ────────────────────────────────────────────────────────────
-- 00:05 UTC = 07:05 WIB, after the date has rolled over in Jakarta but before the
-- user's day starts, so a bill due today is already recorded when they open Finy.
select cron.schedule(
  'process-recurring-daily',
  '5 0 * * *',
  $$ select public.process_recurring_due_rules() $$
);
