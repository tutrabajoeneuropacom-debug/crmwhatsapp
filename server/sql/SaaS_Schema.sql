-- WhatsApp AI Bot SaaS - Database Schema
-- Multi-tenant architecture for multiple entrepreneurs

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    company_name TEXT,
    phone TEXT,
    
    -- Subscription
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired')),
    trial_ends_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    
    -- Usage limits
    monthly_message_limit INTEGER DEFAULT 100,
    monthly_messages_used INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- ============================================
-- WHATSAPP ACCOUNTS
-- ============================================

-- WhatsApp Business Accounts (1 user can have multiple accounts)
CREATE TABLE public.whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- WhatsApp Cloud API credentials
    account_name TEXT NOT NULL, -- e.g., "Mi Tienda Principal"
    phone_number TEXT NOT NULL,
    phone_number_id TEXT NOT NULL, -- Meta's phone number ID
    business_account_id TEXT NOT NULL, -- Meta's WABA ID
    access_token TEXT NOT NULL, -- Encrypted
    webhook_verify_token TEXT NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'disconnected')),
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    
    UNIQUE(phone_number_id)
);

-- ============================================
-- AI CONFIGURATION
-- ============================================

-- AI Bot Configuration (per WhatsApp account)
CREATE TABLE public.bot_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
    
    -- Bot personality
    bot_name TEXT DEFAULT 'Asistente',
    bot_role TEXT DEFAULT 'customer_support' CHECK (bot_role IN ('customer_support', 'sales', 'lead_gen', 'custom')),
    language TEXT DEFAULT 'es' CHECK (language IN ('es', 'en', 'pt', 'fr')),
    tone TEXT DEFAULT 'friendly' CHECK (tone IN ('professional', 'friendly', 'casual', 'formal')),
    
    -- System prompt
    system_prompt TEXT,
    custom_instructions TEXT,
    
    -- Features
    auto_reply_enabled BOOLEAN DEFAULT true,
    ai_enabled BOOLEAN DEFAULT true,
    voice_enabled BOOLEAN DEFAULT false,
    crm_sync_enabled BOOLEAN DEFAULT false,
    
    -- Response settings
    max_response_length INTEGER DEFAULT 500,
    response_delay_seconds INTEGER DEFAULT 2,
    
    -- Business info
    business_description TEXT,
    business_hours TEXT,
    products_services TEXT,
    pricing_info TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(whatsapp_account_id)
);

-- ============================================
-- CONVERSATIONS & MESSAGES
-- ============================================

-- Conversations (threads with customers)
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
    
    -- Customer info
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    
    -- Conversation metadata
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    tags TEXT[], -- ['lead', 'customer', 'support']
    
    -- Analytics
    message_count INTEGER DEFAULT 0,
    ai_message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(whatsapp_account_id, customer_phone)
);

-- Messages (individual messages in conversations)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    
    -- Message data
    message_id TEXT, -- WhatsApp message ID
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document')),
    content TEXT NOT NULL,
    
    -- AI metadata
    is_ai_generated BOOLEAN DEFAULT false,
    ai_model TEXT, -- 'gpt-4o', 'deepseek', etc.
    ai_tokens_used INTEGER,
    processing_time_ms INTEGER,
    
    -- Status
    status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

-- ============================================
-- CRM & LEADS
-- ============================================

-- Leads captured from conversations
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    
    -- Lead info
    name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    company TEXT,
    
    -- Lead qualification
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    source TEXT DEFAULT 'whatsapp',
    
    -- Metadata
    notes TEXT,
    tags TEXT[],
    custom_fields JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ,
    
    UNIQUE(whatsapp_account_id, phone)
);

-- ============================================
-- ANALYTICS & USAGE
-- ============================================

-- Daily usage stats (for billing and analytics)
CREATE TABLE public.usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    whatsapp_account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
    
    -- Date
    date DATE NOT NULL,
    
    -- Message counts
    messages_received INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    ai_messages_sent INTEGER DEFAULT 0,
    
    -- AI usage
    ai_tokens_used INTEGER DEFAULT 0,
    ai_cost_usd DECIMAL(10, 4) DEFAULT 0,
    
    -- Conversations
    new_conversations INTEGER DEFAULT 0,
    active_conversations INTEGER DEFAULT 0,
    
    -- Leads
    new_leads INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, whatsapp_account_id, date)
);

-- ============================================
-- WEBHOOKS & EVENTS
-- ============================================

-- Webhook events log (for debugging)
CREATE TABLE public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
    
    -- Event data
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_whatsapp_accounts_user_id ON public.whatsapp_accounts(user_id);
CREATE INDEX idx_whatsapp_accounts_status ON public.whatsapp_accounts(status);
CREATE INDEX idx_conversations_whatsapp_account_id ON public.conversations(whatsapp_account_id);
CREATE INDEX idx_conversations_customer_phone ON public.conversations(customer_phone);
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_leads_whatsapp_account_id ON public.leads(whatsapp_account_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_usage_stats_user_id_date ON public.usage_stats(user_id, date DESC);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed, created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- WhatsApp accounts policies
CREATE POLICY "Users can view own whatsapp accounts" ON public.whatsapp_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp accounts" ON public.whatsapp_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp accounts" ON public.whatsapp_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp accounts" ON public.whatsapp_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Bot configs policies
CREATE POLICY "Users can view own bot configs" ON public.bot_configs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.whatsapp_accounts wa
            WHERE wa.id = bot_configs.whatsapp_account_id
            AND wa.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own bot configs" ON public.bot_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.whatsapp_accounts wa
            WHERE wa.id = bot_configs.whatsapp_account_id
            AND wa.user_id = auth.uid()
        )
    );

-- Similar policies for conversations, messages, leads, etc.
-- (Abbreviated for brevity - same pattern)

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to reset monthly usage
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
    UPDATE public.users
    SET monthly_messages_used = 0
    WHERE DATE_TRUNC('month', updated_at) < DATE_TRUNC('month', NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to increment message count
CREATE OR REPLACE FUNCTION increment_message_count(p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.users
    SET monthly_messages_used = monthly_messages_used + 1,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_accounts_updated_at BEFORE UPDATE ON public.whatsapp_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_configs_updated_at BEFORE UPDATE ON public.bot_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
