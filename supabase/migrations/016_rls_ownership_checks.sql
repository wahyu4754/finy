-- 016: RLS ownership checks on wallet_id / category_id (C-14)
-- Prevents a user from inserting transactions/budgets/recurring_rules
-- referencing another user's wallets or categories.

-- ── transactions ──────────────────────────────────────────────
drop policy if exists "Users own transactions" on transactions;

create policy "Users read own transactions"
  on transactions for select
  using (auth.uid() = user_id);

create policy "Users insert own transactions"
  on transactions for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from wallets w where w.id = wallet_id and w.user_id = auth.uid())
    and (
      category_id is null
      or exists (select 1 from categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
    )
  );

create policy "Users update own transactions"
  on transactions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from wallets w where w.id = wallet_id and w.user_id = auth.uid())
    and (
      category_id is null
      or exists (select 1 from categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
    )
  );

create policy "Users delete own transactions"
  on transactions for delete
  using (auth.uid() = user_id);

-- ── budgets ───────────────────────────────────────────────────
drop policy if exists "Users own budgets" on budgets;

create policy "Users read own budgets"
  on budgets for select
  using (auth.uid() = user_id);

create policy "Users insert own budgets"
  on budgets for insert
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (select 1 from categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
    )
  );

create policy "Users update own budgets"
  on budgets for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      category_id is null
      or exists (select 1 from categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
    )
  );

create policy "Users delete own budgets"
  on budgets for delete
  using (auth.uid() = user_id);

-- ── recurring_rules ───────────────────────────────────────────
drop policy if exists "Users own recurring rules" on recurring_rules;

create policy "Users read own recurring rules"
  on recurring_rules for select
  using (auth.uid() = user_id);

create policy "Users insert own recurring rules"
  on recurring_rules for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from wallets w where w.id = wallet_id and w.user_id = auth.uid())
    and (
      category_id is null
      or exists (select 1 from categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
    )
  );

create policy "Users update own recurring rules"
  on recurring_rules for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      wallet_id is null
      or exists (select 1 from wallets w where w.id = wallet_id and w.user_id = auth.uid())
    )
    and (
      category_id is null
      or exists (select 1 from categories c where c.id = category_id and (c.user_id = auth.uid() or c.user_id is null))
    )
  );

create policy "Users delete own recurring rules"
  on recurring_rules for delete
  using (auth.uid() = user_id);
