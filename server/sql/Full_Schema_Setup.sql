-- ==========================================
-- FULL DATABASE SETUP FOR CAREER MASTERY ENGINE
-- Run this entire script in Supabase SQL Editor
-- ==========================================

-- 1. Create Profiles Table (if not exists)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  usage_count int default 0,
  is_premium boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable RLS (Security)
alter table public.profiles enable row level security;

-- 3. Policies
create policy "Users can view own profile" 
  on profiles for select 
  using ( auth.uid() = id );

create policy "Users can update own profile" 
  on profiles for update 
  using ( auth.uid() = id );

create policy "Users can insert own profile" 
  on profiles for insert 
  with check ( auth.uid() = id );

-- 4. Trigger: Auto-create profile on SignUp
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, usage_count, is_premium)
  values (new.id, new.email, 0, false)
  on conflict (id) do nothing; -- Prevent errors if row exists
  return new;
end;
$$ language plpgsql security definer;

-- Re-create trigger to be safe (drop first to avoid error if exists)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. RPC Function: Increment Usage
create or replace function increment_usage(user_id uuid)
returns void as $$
begin
  update public.profiles
  set usage_count = usage_count + 1
  where id = user_id;
end;
$$ language plpgsql security definer;

-- 6. ADD ALL EXTRA COLUMNS (Safe to run multiple times)

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS goal text,
ADD COLUMN IF NOT EXISTS level text,
ADD COLUMN IF NOT EXISTS interests text[],
ADD COLUMN IF NOT EXISTS urgency text,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,

-- Career Fields
ADD COLUMN IF NOT EXISTS role_title text,
ADD COLUMN IF NOT EXISTS role_industry text, 
ADD COLUMN IF NOT EXISTS work_context text,
ADD COLUMN IF NOT EXISTS last_active timestamp with time zone,

-- ATS Fields
ADD COLUMN IF NOT EXISTS ats_score integer,
ADD COLUMN IF NOT EXISTS ats_status text,
ADD COLUMN IF NOT EXISTS ats_missing_keywords text[];

-- 7. Add comments
COMMENT ON COLUMN public.profiles.goal IS 'Primary objective: viajar, trabajo_remoto, migrar, estudio_examen';
COMMENT ON COLUMN public.profiles.role_title IS 'Target job title (e.g. React Developer)';
