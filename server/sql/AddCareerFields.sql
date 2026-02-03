-- Migration: Add Career Fields for Interview Coach & ATS
-- Adds role_title, role_industry, work_context to profiles table

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role_title text,
ADD COLUMN IF NOT EXISTS role_industry text, 
ADD COLUMN IF NOT EXISTS work_context text;

-- Add usage comments
COMMENT ON COLUMN public.profiles.role_title IS 'Target job title for the user (e.g. React Developer)';
COMMENT ON COLUMN public.profiles.role_industry IS 'Target industry (e.g. Fintech)';
COMMENT ON COLUMN public.profiles.work_context IS 'Description of current/past work experience for context injection';
