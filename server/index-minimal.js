// Minimal WhatsApp Cloud API Server
// No Baileys, No Supabase - Just the essentials

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js'); // Add Supabase

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('🚀 Starting WhatsApp Cloud API Server...');

// WhatsApp Cloud API Service
const whatsappCloudAPI = require('./services/whatsappCloudAPI');

// Initialize Supabase (If configured)
let supabaseAdmin = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
        supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        console.log('✅ Supabase connected for logging (Cooper/Dashboard)');
    } catch (e) {
        console.error('❌ Supabase Init Error:', e.message);
    }
} else {
    console.warn('⚠️ Supabase credentials missing. Activity will not be logged to Dashboard.');
}

// Health check
app.get('/health', (req, res) => {
    res.send('OK');
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'WhatsApp Cloud API Server Running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        server: 'whatsapp-cloud-api-server',
        mode: 'WhatsApp Cloud API (Meta)',
        checks: {
            whatsapp_configured: !!process.env.WHATSAPP_ACCESS_TOKEN,
            openai: !!process.env.OPENAI_API_KEY,
            supabase_logging: !!supabaseAdmin
        },
        timestamp: new Date().toISOString()
    });
});

// WhatsApp Cloud API Status
app.get('/api/whatsapp/cloud/status', (req, res) => {
    res.json(whatsappCloudAPI.getStatus());
});

// Webhook Verification (GET) - Meta requires this
app.get('/api/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const result = whatsappCloudAPI.verifyWebhook(mode, token, challenge);

    if (result) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(result);
    } else {
        console.error('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});

// Webhook Message Handler (POST) - Receives incoming messages
app.post('/api/webhook/whatsapp', async (req, res) => {
    try {
        console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));

        // Process the webhook
        const messageData = await whatsappCloudAPI.processWebhook(req.body);

        if (messageData) {
            const { from, name, type } = messageData;
            let userText = messageData.text;
            let isVoiceMessage = (type === 'audio');

            // 1. If Audio, Transcribe it first (Whisper)
            if (isVoiceMessage && messageData.audio) {
                try {
                    console.log('🎤 Voice message received. Transcribing...');
                    const axios = require('axios');
                    const FormData = require('form-data');

                    // Get Download URL
                    const mediaUrl = await whatsappCloudAPI.getMediaUrl(messageData.audio.id);

                    // Download Audio Buffer
                    const audioResponse = await axios.get(mediaUrl, {
                        responseType: 'arraybuffer',
                        headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
                    });

                    // Send to Whisper
                    const formData = new FormData();
                    formData.append('file', Buffer.from(audioResponse.data), { filename: 'audio.ogg', contentType: 'audio/ogg' });
                    formData.append('model', 'whisper-1');

                    const OpenAIApi = require('openai');
                    // Note: We use raw axios for Whisper to handle FormData easily with buffers
                    const whisperResponse = await axios.post(
                        'https://api.openai.com/v1/audio/transcriptions',
                        formData,
                        {
                            headers: {
                                ...formData.getHeaders(),
                                'Authorization': `Bearer ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : ''}`
                            }
                        }
                    );

                    userText = whisperResponse.data.text;
                    console.log(`🗣️ Transcribed: "${userText}"`);

                } catch (transcribeError) {
                    console.error('❌ Transcription failed:', transcribeError.message);
                    userText = "Lo siento, no pude escuchar tu audio. ¿Me lo escribes?";
                    isVoiceMessage = false; // Fallback to text
                }
            }

            if (userText) {
                console.log(`💬 Processing from ${name || from}: ${userText}`);

                // 2. AI Response (GPT-4o)
                try {
                    const OpenAI = require('openai');
                    const openai = new OpenAI({
                        apiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : ''
                    });

                    const systemPrompt = `Eres un asistente virtual de Career Mastery Engine, una plataforma de preparación para entrevistas laborales y optimización de CVs.

Tu rol es:
- Ayudar a usuarios con información sobre visas de trabajo
- Responder preguntas sobre preparación de entrevistas
- Explicar cómo mejorar CVs para sistemas ATS
- Ser amigable, profesional y conciso (máximo 2-3 líneas por respuesta)

Si te preguntan por precios o planes, menciona que tenemos planes freemium y premium.`;

                    const completion = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userText }
                        ],
                        max_tokens: 150
                    });

                    const replyText = completion.choices[0].message.content;
                    console.log(`🤖 AI Reply: ${replyText.substring(0, 30)}...`);

                    // 3. Send Reply (Voice or Text)
                    // Config: Respond with Voice ALWAYS (as requested via "hacelo con vos/voz")
                    // Change to (isVoiceMessage) to revert to "only reply voice if spoken to"
                    if (true) {
                        try {
                            console.log('🔊 Generating Voice Reply (ElevenLabs)...');
                            const axios = require('axios');
                            const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
                            const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

                            if (!ELEVENLABS_API_KEY) throw new Error('No ElevenLabs Key');

                            const ttsResponse = await axios.post(
                                `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
                                {
                                    text: replyText,
                                    model_id: "eleven_monolingual_v1",
                                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                                },
                                {
                                    headers: {
                                        'xi-api-key': ELEVENLABS_API_KEY,
                                        'Content-Type': 'application/json'
                                    },
                                    responseType: 'arraybuffer'
                                }
                            );

                            // Upload to WhatsApp
                            const mediaId = await whatsappCloudAPI.uploadMedia(Buffer.from(ttsResponse.data), 'audio/mpeg');

                            // Send Voice Note
                            await whatsappCloudAPI.sendAudio(from, mediaId);
                            console.log('✅ Voice Reply Sent');

                        } catch (ttsError) {
                            console.error('❌ TTS/Audio Send failed:', ttsError.message);
                            console.error('Stack:', ttsError.stack); // Log stack for Render dashboard

                            // FALLBACK: Inform User (Debug Mode) or just send text
                            const debugMsg = `(Debug: Fallo en Voz - ${ttsError.message}) \n\n${replyText}`;
                            await whatsappCloudAPI.sendMessage(from, debugMsg);
                        }

                    } else {
                        // Text Reply
                        await whatsappCloudAPI.sendMessage(from, replyText);
                    }

                    // --- LOG && SYNC ---
                    // (Dashboard & Copper Logic preserved below)
                    if (supabaseAdmin) {
                        try {
                            const estimatedCost = 0.005; // Base
                            // If audio involved, cost is higher. logic can be improved.

                            await supabaseAdmin.from('usage_logs').insert({
                                input_text: `[WA] ${userText} (User: ${from}) ${isVoiceMessage ? '[AUDIO]' : ''}`,
                                translated_text: replyText,
                                provider_llm: 'gpt-4o-whatsapp',
                                cost_estimated: estimatedCost,
                                is_cache_hit: false,
                                created_at: new Date()
                            });
                            console.log('📊 Logged to Dashboard (Cooper)');
                        } catch (logErr) {
                            console.error('⚠️ Failed to log to dashboard:', logErr.message);
                        }
                    }

                    // Copper Sync
                    try {
                        const copperService = require('./services/copperService');
                        // We don't await this to avoid slowing down the WhatsApp response
                        copperService.syncUser(from, name).then(contact => {
                            if (contact) console.log('🔗 Synced with Copper CRM');
                        });
                    } catch (crmErr) {
                        console.error('⚠️ CRM Sync failed:', crmErr.message);
                    }

                } catch (aiError) {
                    console.error(`❌ AI Response Error: ${aiError.message}`);
                    await whatsappCloudAPI.sendMessage(from, "Tuve un error procesando eso. ¿Intentamos de nuevo?");
                }
            }
        }

        // Always respond 200 OK to Meta
        res.sendStatus(200);

    } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.sendStatus(500);
    }
});

// Global Chat Status (In-memory for MVP - resets on restart)
// To make persistent, you'd use Supabase/Redis
global.chatEnabled = true;

app.get('/api/chat/status', (req, res) => {
    res.json({ enabled: global.chatEnabled });
});

app.post('/api/chat/status', (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled === 'boolean') {
        global.chatEnabled = enabled;
        console.log(`🔌 Web Chat IS NOW: ${enabled ? 'ON' : 'OFF'}`);
        res.json({ success: true, enabled: global.chatEnabled });
    } else {
        res.status(400).json({ error: 'Boolean "enabled" required' });
    }
});

// --- WEB CHAT ENDPOINT (For Website Widget) ---
app.post('/api/chat', async (req, res) => {
    // Check if enabled
    if (!global.chatEnabled) {
        return res.status(503).json({
            error: 'Chat is currently disabled',
            reply: 'El chat está deshabilitado temporalmente.'
        });
    }

    try {
        const { message, sessionId, userData } = req.body;

        if (!message) return res.status(400).json({ error: 'Message required' });

        console.log(`💬 Web Chat from ${sessionId}: ${message}`);

        // Sync to Copper (Async) - If user provided data in Lead Form
        if (userData && (userData.name || userData.email || userData.phone)) {
            try {
                const copperService = require('./services/copperService');
                copperService.syncUser(userData.phone, userData.name, userData.email)
                    .then(p => { if (p) console.log('🔗 [Web] Synced with Copper CRM'); });
            } catch (crmErr) { console.error(crmErr); }
        }

        // Reuse AI Logic
        const OpenAI = require('openai');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : ''
        });

        const systemPrompt = `Eres un asistente virtual de Career Mastery Engine... (Mismo que WhatsApp)`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: "Eres Cooper, el asistente IA amigable y profesional de Career Mastery Engine." },
                { role: 'user', content: message }
            ],
            max_tokens: 150
        });

        const replyText = completion.choices[0].message.content;

        // Log to Dashboard
        if (supabaseAdmin) {
            try {
                // If we have userData, add it to the log to identify better
                const identifier = userData && userData.email ?
                    `${userData.email} (Web)` :
                    `Session: ${sessionId}`;

                await supabaseAdmin.from('usage_logs').insert({
                    input_text: `[WEB] ${message} (${identifier})`,
                    translated_text: replyText,
                    provider_llm: 'gpt-4o-web',
                    cost_estimated: 0.005,
                    is_cache_hit: false,
                    created_at: new Date()
                });
            } catch (e) { console.error(e); }
        }

        res.json({ reply: replyText });

    } catch (error) {
        console.error('❌ Web Chat Error:', error.message);
        res.status(500).json({ error: 'AI processing failed' });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 Webhook URL: /api/webhook/whatsapp`);
    console.log(`🤖 WhatsApp Cloud API Status: ${whatsappCloudAPI.getStatus().configured ? 'Configured' : 'Not Configured'}`);
});
