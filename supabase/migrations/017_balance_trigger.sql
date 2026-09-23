-- 017: Atomic wallet balance trigger (C-04)
-- Balance is now maintained inside the same transaction as the write,
-- eliminating the non-atomic browser-side balance math.

-- ── INSERT trigger ────────────────────────────────────────────
create or replace function fn_tx_balance_insert()
returns trigger as $$
begin
  update wallets
  set balance = balance + case when new.type = 'expense' then -new.amount else new.amount end
  where id = new.wallet_id;
  return new;
end;
$$ language plpgsql security definer;

-- ── DELETE trigger ────────────────────────────────────────────
create or replace function fn_tx_balance_delete()
returns trigger as $$
begin
  update wallets
  set balance = balance + case when old.type = 'expense' then old.amount else -old.amount end
  where id = old.wallet_id;
  return old;
end;
$$ language plpgsql security definer;

-- ── UPDATE trigger ────────────────────────────────────────────
create or replace function fn_tx_balance_update()
returns trigger as $$
begin
  -- reverse old effect
  update wallets
  set balance = balance + case when old.type = 'expense' then old.amount else -old.amount end
  where id = old.wallet_id;
  -- apply new effect
  update wallets
  set balance = balance + case when new.type = 'expense' then -new.amount else new.amount end
  where id = new.wallet_id;
  return new;
end;
$$ language plpgsql security definer;

-- ── Attach triggers ───────────────────────────────────────────
drop trigger if exists trg_tx_balance_insert on transactions;
create trigger trg_tx_balance_insert
  after insert on transactions
  for each row execute function fn_tx_balance_insert();

drop trigger if exists trg_tx_balance_delete on transactions;
create trigger trg_tx_balance_delete
  after delete on transactions
  for each row execute function fn_tx_balance_delete();

drop trigger if exists trg_tx_balance_update on transactions;
create trigger trg_tx_balance_update
  after update on transactions
  for each row execute function fn_tx_balance_update();
