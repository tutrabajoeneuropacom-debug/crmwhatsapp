-- =============================================
-- MIGRATION: WHATSAPP SESSION PERSISTENCE
-- Stores Baileys auth keys for permanent QR connection
-- =============================================

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    key_type TEXT NOT NULL,
    key_id TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, key_type, key_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wa_sessions_lookup ON public.whatsapp_sessions(session_id, key_type, key_id);

-- Enable RLS (Optional, usually accessed via service role)
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
-- (No specific policies needed if using service role, but for safe access via anon key if used:)
-- create policy "Allow service_role full access" on whatsapp_sessions for all using (true) with check (true);
