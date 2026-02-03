-- Run this in your Supabase SQL Editor to fix the "Column not found" error

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role_title text,
ADD COLUMN IF NOT EXISTS role_industry text, 
ADD COLUMN IF NOT EXISTS work_context text,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ats_score integer,
ADD COLUMN IF NOT EXISTS ats_status text,
ADD COLUMN IF NOT EXISTS ats_missing_keywords text[];

-- Reload the schema cache is automatic in Supabase usually, but this ensures columns exist.
