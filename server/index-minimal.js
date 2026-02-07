// Minimal WhatsApp Cloud API Server
// No Baileys, No Supabase - Just the essentials

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { captureRawBody, verifyWebhookSignature } = require('./middleware/webhookSecurity');
const { authenticateDashboard, redactSensitive } = require('./middleware/dashboardAuth');
const { getOpenAI } = require('./services/openaiClient');
const interviewCoach = require('./services/interviewCoach');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Capture raw body for webhook signature verification
app.use(express.json({ verify: captureRawBody }));
app.use(express.urlencoded({ extended: true }));

console.log('🚀 Starting WhatsApp Cloud API Server...');

// WhatsApp Cloud API Service
const whatsappCloudAPI = require('./services/whatsappCloudAPI');
// SaaS & QR Service (Simultaneous Support)
const whatsappSaas = require('./services/whatsappSaas');

app.use('/api/saas', whatsappSaas);

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

// Global User State (In-Memory for MVP)
global.userStates = {}; // { '54911...': { cvText: '...', mode: 'assistant'|'interview', history: [] } }

// Global In-Memory Logs (for Client Dashboard)
global.recentLogs = [];
// File logging setup
const LOG_FILE = path.join(__dirname, 'logs', 'activity_log.jsonl');
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    try { fs.mkdirSync(path.dirname(LOG_FILE)); } catch (e) { }
}

const addToLogs = (log) => {
    const entry = { timestamp: new Date(), ...log };

    // 1. In-Memory (for Dashboard UI - limited)
    global.recentLogs.unshift(entry);
    if (global.recentLogs.length > 1000) global.recentLogs = global.recentLogs.slice(0, 1000);

    // 2. Persistent File Storage (Append - Unlimited)
    try {
        fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
    } catch (err) {
        console.error('Failed to write to log file:', err.message);
    }
};

// Protected endpoint - requires authentication
app.get('/api/logs', authenticateDashboard, (req, res) => {
    // Redact sensitive information before sending
    const redactedLogs = global.recentLogs.map(log => redactSensitive(log));
    res.json(redactedLogs);
});

// Download full log history file
app.get('/api/logs/download', authenticateDashboard, (req, res) => {
    if (fs.existsSync(LOG_FILE)) {
        res.download(LOG_FILE, `whatsapp-bot-logs-${new Date().toISOString().split('T')[0]}.jsonl`);
    } else {
        res.status(404).json({ error: 'No logs found on disk yet.' });
    }
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
// Validate webhook signature if APP_SECRET is configured
const appSecret = process.env.WHATSAPP_APP_SECRET;
if (appSecret) {
    console.log('✅ Webhook signature validation enabled');
    app.use('/api/webhook/whatsapp', verifyWebhookSignature(appSecret));
} else {
    console.warn('⚠️ WHATSAPP_APP_SECRET not configured - webhook signatures will not be validated');
}

// List uploaded files (Dashboard)
app.get('/api/uploads', authenticateDashboard, (req, res) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) return res.json([]);

    const files = fs.readdirSync(uploadDir).map(file => {
        const stats = fs.statSync(path.join(uploadDir, file));
        return {
            name: file,
            size: stats.size,
            date: stats.mtime
        };
    }).sort((a, b) => b.date - a.date);

    res.json(files);
});

// Download uploaded file
app.get('/api/uploads/:filename', authenticateDashboard, (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

app.post('/api/webhook/whatsapp', async (req, res) => {
    try {
        console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));

        // Process the webhook
        const messageData = await whatsappCloudAPI.processWebhook(req.body);

        if (messageData) {
            const { from, name, type } = messageData;
            let userText = messageData.text;

            // Log Incoming
            addToLogs({
                type: 'incoming',
                from,
                name,
                body: userText || `[${type}] ${messageData.document ? messageData.document.filename : ''}`
            });

            let isVoiceMessage = (type === 'audio');
            let isDocument = (type === 'document');

            // 0. Handle Documents (CVs)
            if (isDocument && messageData.document) {
                try {
                    console.log(`📄 Document received: ${messageData.document.filename}`);
                    const axios = require('axios');

                    // Get Download URL
                    const mediaUrl = await whatsappCloudAPI.getMediaUrl(messageData.document.id);

                    // Download Document
                    const docResponse = await axios.get(mediaUrl, {
                        responseType: 'arraybuffer',
                        headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
                    });

                    // Save to Disk
                    const filename = `${Date.now()}_${messageData.document.filename.replace(/\s+/g, '_')}`;
                    const itemsDir = path.join(__dirname, 'uploads');
                    if (!fs.existsSync(itemsDir)) fs.mkdirSync(itemsDir);

                    fs.writeFileSync(path.join(itemsDir, filename), Buffer.from(docResponse.data));
                    console.log(`✅ Saved document to uploads/${filename}`);

                    // EXTRACT TEXT from PDF (CV)
                    let extractedText = "";
                    try {
                        const pdfParse = require('pdf-parse');
                        const pdfData = await pdfParse(Buffer.from(docResponse.data));
                        extractedText = pdfData.text;

                        // Save to User State
                        if (!global.userStates[from]) global.userStates[from] = {};
                        global.userStates[from].cvText = extractedText;
                        global.userStates[from].cvFilename = messageData.document.filename;
                        console.log(`✅ Extracted ${extractedText.length} chars from CV for user ${from}`);
                    } catch (pdfErr) {
                        console.error('❌ PDF Parse Error:', pdfErr.message);
                    }

                    // Generate automatic response
                    // userText = `He recibido tu archivo "${messageData.document.filename}". Voy a analizarlo...`;

                    // Send confirmation immediately
                    await whatsappCloudAPI.sendMessage(from, `📄 Recibí tu CV ("${messageData.document.filename}").\n\n¿Quieres que analice tu perfil o **simular una entrevista**? (Escribe "Entrevista")`);

                    // Stop here, don't trigger general AI yet, wait for user command
                    return res.sendStatus(200);

                } catch (docErr) {
                    console.error('❌ Error downloading document:', docErr.message);
                    await whatsappCloudAPI.sendMessage(from, "Hubo un error al descargar tu archivo. ¿Podrías intentar enviarlo de nuevo?");
                }
            }

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

                // --- STATE MANAGEMENT ---
                if (!global.userStates[from]) global.userStates[from] = { mode: 'assistant', history: [] };
                const userState = global.userStates[from];

                // Check Commands
                const lowerText = userText.toLowerCase();
                const isInterviewCommand = lowerText.includes('entrevista') || lowerText.includes('roleplay') || lowerText.includes('simular');
                const isStopCommand = lowerText.includes('detener') || lowerText.includes('parar') || lowerText.includes('salir');

                if (isStopCommand) {
                    userState.mode = 'assistant';
                    userState.history = []; // Clear history?
                    await whatsappCloudAPI.sendMessage(from, "🛑 Entrevista finalizada. Volviendo al modo asistente.");
                    return res.sendStatus(200);
                }

                if (isInterviewCommand) {
                    userState.mode = 'interview';
                    if (!userState.cvText) {
                        await whatsappCloudAPI.sendMessage(from, "⚠️ Para iniciar una entrevista simulada, primero necesito que me envíes tu CV (PDF).");
                        return res.sendStatus(200);
                    }
                    userState.history = []; // Reset history for new interview
                    await whatsappCloudAPI.sendMessage(from, "🎙️ **Iniciando Entrevista Técnica**\n\nSoy Alex, tu reclutador. Empecemos...");
                    // Fall through to let the interview logic run immediately? No, wait for next turn or trigger generic 'Hello'
                    // actually, let's treat this message as the trigger.
                }

                // --- DISPATCHER ---

                if (userState.mode === 'interview') {
                    // --- INTERVIEW MODE (Alex) ---
                    try {
                        const conversationHistory = userState.history.map(h => ({ role: h.role, content: h.content }));

                        // Add current user message (if it's not the start command itself, but even if it is, it's fine)
                        // Actually, if it's the start command, we might want to suppress it or pass 'Hola'
                        if (!isInterviewCommand) {
                            conversationHistory.push({ role: 'user', content: userText });
                        }

                        // Call Interview Service
                        // Mock Job Description for MVP (or allow user to set it later)
                        const jobDescription = "Senior Software Engineer. React, Node.js, Cloud Architecture. Fluent English required.";

                        const responseJSON = await interviewCoach.getInterviewResponse(
                            conversationHistory,
                            userState.cvText || "No CV provided",
                            jobDescription
                        );

                        const { dialogue, feedback } = responseJSON;

                        // 1. Send Feedback (if any)
                        if (feedback && feedback.analysis) {
                            const feedbackMsg = `💡 *Feedback:*\n${feedback.analysis}\n${feedback.suggestion ? `👉 _Mejor di:_ "${feedback.suggestion}"` : ''}`;
                            await whatsappCloudAPI.sendMessage(from, feedbackMsg);
                        }

                        // 2. Send Dialogue (Alex)
                        await whatsappCloudAPI.sendMessage(from, dialogue || "Interesante. Continuemos...");

                        // 3. Update History
                        if (!isInterviewCommand) userState.history.push({ role: 'user', content: userText });
                        userState.history.push({ role: 'assistant', content: JSON.stringify(responseJSON) }); // Store full JSON or just dialogue?
                        // Better to store just the dialogue for the context of next turn, OR keeping full JSON might confuse the LLM if we feed it back raw.
                        // Let's store just the text content for the next prompt context to keep it clean.
                        // Actually, InterviewCoach expects standard message format.
                        userState.history.push({ role: 'assistant', content: dialogue });

                    } catch (intError) {
                        console.error('Interview Mode Error:', intError);
                        await whatsappCloudAPI.sendMessage(from, "Tuve un problema simulando la entrevista. Intenta de nuevo.");
                    }

                } else {
                    // --- ASSISTANT MODE (Cooper - General) ---
                    // AI Response (GPT-4o) - Using centralized client
                    try {
                        const openai = getOpenAI();

                        const systemPrompt = `Eres un asistente virtual de Career Mastery Engine, una plataforma de preparación para entrevistas laborales y optimización de CVs.
    
    Tu rol es:
    - Ayudar a usuarios con información sobre visas de trabajo
    - Responder preguntas sobre preparación de entrevistas
    - Explicar cómo mejorar CVs para sistemas ATS
    - Ser amigable, profesional y conciso (máximo 2-3 líneas por respuesta)
    
    Si te preguntan por precios o planes, menciona que tenemos planes freemium y premium.
    
    Si el usuario envió su CV recientemente (tenemos el texto), úsalo para dar consejos personalizados si te lo piden.`;

                        const messages = [
                            { role: 'system', content: systemPrompt }
                        ];

                        // Add CV context if available
                        if (userState.cvText) {
                            messages.push({ role: 'system', content: `CONTEXTO: El usuario ha subido este CV:\n${userState.cvText.slice(0, 1000)}...` });
                        }

                        messages.push({ role: 'user', content: userText });

                        const completion = await openai.chat.completions.create({
                            model: 'gpt-4o',
                            messages: messages,
                            max_tokens: 300
                        });

                        const replyText = completion.choices[0].message.content;
                        console.log(`🤖 AI Reply: ${replyText.substring(0, 50)}...`);

                        // Send text reply
                        await whatsappCloudAPI.sendMessage(from, replyText);

                        // Log Outgoing
                        addToLogs({
                            type: 'outgoing',
                            from: 'Bot',
                            to: from,
                            body: replyText
                        });

                        // Log to Dashboard (if Supabase configured)
                        if (supabaseAdmin) {
                            try {
                                await supabaseAdmin.from('usage_logs').insert({
                                    input_text: `[WA] ${userText} (User: ${from}) ${isVoiceMessage ? '[AUDIO]' : ''}`,
                                    translated_text: replyText,
                                    provider_llm: 'gpt-4o-whatsapp',
                                    cost_estimated: 0.005,
                                    is_cache_hit: false,
                                    created_at: new Date()
                                });
                                console.log('📊 Logged to Dashboard');
                            } catch (logErr) {
                                console.error('⚠️ Failed to log to dashboard:', logErr.message);
                            }
                        }

                        // Copper CRM Sync (async, non-blocking)
                        try {
                            const copperService = require('./services/copperService');
                            copperService.syncUser(from, name).then(contact => {
                                if (contact) console.log('🔗 Synced with Copper CRM');
                            }).catch(err => console.error('⚠️ CRM Sync failed:', err.message));
                        } catch (crmErr) {
                            // CRM service not available
                        }

                    } catch (aiError) {
                        console.error(`❌ AI Response Error: ${aiError.message}`, aiError);

                        // Detectar si es el stub que indica falta de API key
                        const msgMissingKey = aiError && aiError.message && aiError.message.includes('OpenAI API key not configured');

                        try {
                            if (msgMissingKey) {
                                await whatsappCloudAPI.sendMessage(from,
                                    "Lo siento — el servicio de IA no está configurado ahora mismo. Por favor contacta al administrador.");
                            } else {
                                await whatsappCloudAPI.sendMessage(from,
                                    "Tuve un error procesando tu mensaje. ¿Intentamos de nuevo?");
                            }
                        } catch (sendErr) {
                            console.error('❌ Error enviando mensaje de fallback:', sendErr);
                        }
                    }
                } // End else (Assistant Mode)
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
