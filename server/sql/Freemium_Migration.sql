-- =============================================
-- MIGRATION: FREEMIUM SAAS MODEL
-- =============================================

-- 1. Update Profiles for Tier Management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free', -- 'free', 'basic', 'pro'
ADD COLUMN IF NOT EXISTS credits_remaining integer DEFAULT 3,   -- Freemium usage limit
ADD COLUMN IF NOT EXISTS access_until timestamptz;              -- Expiration for subs

-- 2. Create Analysis Logs (For Usage Tracking)
CREATE TABLE IF NOT EXISTS public.analysis_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    feature_type text NOT NULL, -- 'ats_scanner', 'interview', 'cv_rewrite'
    created_at timestamptz DEFAULT now(),
    metadata jsonb
);

-- 3. Enable RLS on Logs
ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logs" ON public.analysis_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert logs" ON public.analysis_logs
    FOR INSERT WITH CHECK (true); -- Backend (service role) usually handles insertions, but if client does, ensure auth.uid() = user_id

-- 4. Function to Reset Credits (Monthly) - Scheduler placeholder
-- (To be run by a cron job or external trigger)
-- UPDATE public.profiles SET credits_remaining = 3 WHERE subscription_tier = 'free';
