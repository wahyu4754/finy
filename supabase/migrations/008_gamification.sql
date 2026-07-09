alter table users
  add column if not exists current_streak integer default 0,
  add column if not exists last_transaction_date date;
