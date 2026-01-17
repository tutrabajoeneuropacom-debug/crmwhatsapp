-- ==========================================
-- SAFE MIGRATION SCRIPT (IDEMPOTENT)
-- ==========================================

-- 1. Create Table (Only if missing)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  usage_count int default 0,
  is_premium boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable RLS
alter table public.profiles enable row level security;

-- 3. Policies (Drop first to avoid conflicts)
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;

create policy "Users can view own profile" on profiles for select using ( auth.uid() = id );
create policy "Users can update own profile" on profiles for update using ( auth.uid() = id );
create policy "Users can insert own profile" on profiles for insert with check ( auth.uid() = id );

-- 4. Add Columns (Safe usage)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role_title text,
ADD COLUMN IF NOT EXISTS role_industry text, 
ADD COLUMN IF NOT EXISTS work_context text,
ADD COLUMN IF NOT EXISTS ats_score integer,
ADD COLUMN IF NOT EXISTS ats_status text,
ADD COLUMN IF NOT EXISTS ats_missing_keywords text[],
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS goal text,
ADD COLUMN IF NOT EXISTS level text,
ADD COLUMN IF NOT EXISTS interests text[],
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS urgency text;

-- 5. Helper Functions
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, usage_count, is_premium)
  values (new.id, new.email, 0, false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger Re-creation
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
