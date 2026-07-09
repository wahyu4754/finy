-- Add ai_credits column to users table
alter table public.users add column if not exists ai_credits integer default 10;

-- Optional: Update the trigger to explicitly set it to 10 for new users,
-- though the default value handles this automatically.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, ai_credits)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 10);
  
  -- Create default wallet
  insert into public.wallets (user_id, name, type, is_default)
  values (new.id, 'Dompet', 'cash', true);
  
  return new;
end;
$$ language plpgsql security definer;
