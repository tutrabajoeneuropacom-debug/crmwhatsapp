require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const axios = require('axios');
const { Server } = require("socket.io");
const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay, downloadMediaMessage } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const OpenAI = require('openai');
const googleTTS = require('google-tts-api');
const { createClient } = require('@supabase/supabase-js');
// --- SERVICES ---
const whatsappCloudAPI = require('./services/whatsappCloudAPI');
const { generateResponse, cleanTextForTTS } = require('./services/aiRouter');
const useSupabaseAuthState = require('./services/supabaseAuthState');

// --- SUPABASE SETUP ---
const supabaseUrl = process.env.SUPABASE_URL;
// Use SUPABASE_KEY (anon) as preferred, fallback to SERVICE_ROLE or ANON
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- SERVER SETUP ---
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

// --- HEALTH CHECK (CRITICAL FOR RENDER) ---
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// --- STATIC ASSETS ---
const CLIENT_BUILD_PATH = path.resolve(__dirname, '../client/dist');
console.log(`📂 Client Build Path: ${CLIENT_BUILD_PATH}`);
console.log(`🔎 Path Exists?: ${fs.existsSync(CLIENT_BUILD_PATH)}`);

if (fs.existsSync(CLIENT_BUILD_PATH)) {
    console.log("✅ Serving Static Frontend from client/dist");
    app.use(express.static(CLIENT_BUILD_PATH));
} else {
    console.error("❌ client/dist NOT FOUND! Look at Dockerfile or Build Logs.");
}

// --- WHATSAPP CLOUD API ROUTES (OFFICIAL META) ---
app.get('/api/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const result = whatsappCloudAPI.verifyWebhook(mode, token, challenge);
    if (result) res.status(200).send(result);
    else res.sendStatus(403);
});

app.post('/api/webhook/whatsapp', async (req, res) => {
    try {
        const messageData = await whatsappCloudAPI.processWebhook(req.body);
        if (messageData && messageData.text) {
            const { from, text } = messageData;
            const replyText = await generateResponse(text, 'ALEX_MIGRATION', []);
            await whatsappCloudAPI.sendMessage(from, replyText);
        }
        res.sendStatus(200);
    } catch (e) {
        console.error("Cloud API Error:", e.message);
        res.sendStatus(500);
    }
});

app.get('/api/whatsapp/cloud/status', (req, res) => {
    res.json(whatsappCloudAPI.getStatus());
});

// --- GLOBAL STATE ---
let sock;
global.qrCodeUrl = null;
global.connectionStatus = 'DISCONNECTED';
global.currentPersona = 'ALEX_MIGRATION';

const personas = require('./config/personas');
const sessionsDir = path.join(__dirname, 'auth_info_baileys');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

// ==============================================================================
// 🧠 ALEX v2.0 COGNITIVE ENGINE (Arquitectura Distribuida Simulada)
// ==============================================================================

// 1. MOCK DATABASE (Supabase Simulator)
const userDatabase = {};

// 2. PERSONALITY ENGINE (Generador de Tono)
const getDynamicPrompt = (userData, recentHistory) => {
    const phase = userData.journeyPhase || 0;

    // Base Identity
    let baseSystem = `Eres **Alex v2.0**, el Arquitecto de Carreras de 'Puentes Globales'. 🌍
    
    **TU IDENTIDAD COGNITIVA:**
    - No eres un chatbot. Eres un **Estratega Senior**.
    - Tu objetivo NO es vender, es **guiar** al éxito.
    - **Piensas antes de hablar**.
    - No repites preguntas. Si ya tienes el dato, avanza.
    - Voz: Masculina (Onyx), profunda y segura.

    **TU MAPA MENTAL (ESTADO ACTUAL DEL USUARIO: FASE ${phase}):**
    `;

    // Adaptive Phase Instructions
    switch (phase) {
        case 0: // Exploración
            baseSystem += `
            - El usuario es NUEVO.
            - Objetivo: Detectar si quiere migrar y si conoce la plataforma.
            - Tono: Curioso y acogedor, pero profesional.
            - Acción Clave: Llevarlo a crear su CV en la web.`;
            break;
        case 1: // CV Creado -> ATS
            baseSystem += `
            - El usuario YA tiene CV.
            - Objetivo: Simular el análisis ATS.
            - Tono: Analítico. "Veamos si pasas los robots".
            - Acción Clave: Pedirle que simule el ATS o darle feedback si ya lo hizo.`;
            break;
        case 2: // ATS Fallido -> Psicométrico
            baseSystem += `
            - El usuario FALLÓ el ATS (Score bajo).
            - Objetivo: Calmar la frustración y redirigir al Test Psicométrico.
            - Insight: "El CV es técnico, el Test es humano. Veamos tu potencial real".`;
            break;
        case 3: // Test Hecho -> Cierre
            baseSystem += `
            - El usuario completó el circuito.
            - Objetivo: CERRAR la consultoría humana.
            - Argumento: "Los datos muestran que necesitas estrategia personalizada".
            - Call to Action: Agenda aquí -> https://calendly.com/puentesglobales-iwue`;
            break;
        case 4: // Agendado
            baseSystem += `
            - Usuario ya convertido.
            - Objetivo: Mantenimiento y tips previos a la llamada.`;
            break;
    }

    baseSystem += `
    \n**REGLAS DE RESPUESTA:**
    1. Sé breve (estilo WhatsApp).
    2. Si te hablan en inglés, cambia a **TalkMe Tutor** (Coach de Inglés).
    3. Si el usuario te da un dato nuevo, asúmelo y avanza de fase.
    4. Usa herramientas ("Voy a consultar tu perfil...") para sonar inteligente.
    `;

    return baseSystem;
};

// 3. COGNITIVE PROCESSOR (The Brain)
async function processMessageAleX(userId, userText, userAudioBuffer = null) {
    if (!userDatabase[userId]) {
        userDatabase[userId] = {
            name: 'Candidato',
            chatLog: [],
            currentPersona: 'ALEX_MIGRATION',
            lastMessageTime: 0,
            messageCount: 0
        };
    }
    const user = userDatabase[userId];

    // --- RATE LIMITING (10 per minute) ---
    const now = Date.now();
    if (now - user.lastMessageTime > 60000) {
        user.messageCount = 0;
        user.lastMessageTime = now;
    }
    user.messageCount++;
    if (user.messageCount > 10) {
        return "⚠️ Estás enviando mensajes muy rápido. Por favor, espera un momento.";
    }

    // --- HEURISTIC: COMMANDS ---
    if (userText && (userText.startsWith('!') || userText.startsWith('/'))) {
        const cmd = userText.toLowerCase().trim();

        if (cmd === '!ayuda' || cmd === '!help' || cmd === '!personalidades') {
            let list = "🎭 *Menú de Personalidades Alex v2.0*\n\n";
            Object.values(personas).forEach(p => {
                list += `${p.emoji} *!${p.id.replace('ALEX_', '').toLowerCase()}*: ${p.role}\n`;
            });
            list += "\n✅ *Otros comandos:*\n";
            list += "• `!actual`: Ver personalidad activa.\n";
            list += "• `!reset`: Borrar historial de chat.\n";
            return list;
        }

        if (cmd === '!actual') {
            const p = personas[user.currentPersona];
            return `🎯 *Personalidad actual:* ${p.name} ${p.emoji}\n_${p.role}_`;
        }

        if (cmd === '!status') {
            const up = Math.floor(process.uptime() / 60);
            return `📊 *Estado de Alex v2.0*\n\n` +
                `🤖 *Personalidad:* ${personas[user.currentPersona].name}\n` +
                `📡 *Conexión:* ${global.connectionStatus}\n` +
                `⏱️ *Uptime:* ${up} minutos\n` +
                `👤 *Tu histórico:* ${user.chatLog.length} mensajes`;
        }

        if (cmd === '!reiniciar') {
            setTimeout(() => {
                if (sock) sock.end();
                connectToWhatsApp();
            }, 1000);
            return "🔄 *Reiniciando conexión...* Dame 10 segundos.";
        }

        if (cmd === '!reset') {
            user.chatLog = [];
            return "🧹 *Historial reiniciado.* ¿En qué puedo ayudarte desde cero?";
        }

        // Switch Personality
        for (const [key, p] of Object.entries(personas)) {
            const shortName = key.replace('ALEX_', '').toLowerCase();
            if (cmd.includes(shortName)) {
                user.currentPersona = key;
                return `✅ *Modo ${p.name}* activado ${p.emoji}\n_${p.role}_`;
            }
        }
    }

    // --- HEURISTIC: AUTO-DETECT TOPIC ---
    if (userText) {
        const { detectPersonalityFromMessage } = require('./services/aiRouter');
        const detected = detectPersonalityFromMessage(userText);
        if (detected && detected !== user.currentPersona) {
            console.log(`🎯 [ALEX] Auto-detected topic: ${detected} for user ${userId}`);
        }
    }

    // Handle Audio
    let processedText = userText;
    if (userAudioBuffer && process.env.OPENAI_API_KEY) {
        try {
            const tempPath = path.join(__dirname, `audio_in_${Date.now()}.ogg`);
            fs.writeFileSync(tempPath, userAudioBuffer);
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: "whisper-1", language: "es"
            });
            processedText = transcription.text;
            fs.unlinkSync(tempPath);
            console.log(`👂 (Whisper): ${processedText}`);
        } catch (e) { console.error('Whisper fail', e); }
    }

    user.chatLog.push({ role: 'user', content: processedText });
    if (user.chatLog.length > 20) user.chatLog = user.chatLog.slice(-20);

    try {
        const aiResponse = await generateResponse(processedText, user.currentPersona, user.chatLog);
        user.chatLog.push({ role: 'assistant', content: aiResponse });
        return aiResponse;
    } catch (e) {
        console.error('Brain Error:', e);
        return "⚠️ Alex está recalibrando sus sistemas... dame un momento.";
    }
}

// 4. VOICE ENGINE (TTS - Onyx Cleaned)
async function speakAlex(id, text) {
    if (!text) return;

    // Detect Language Mode
    const isEnglishMode = text.includes('Correction:') || text.includes('Correction 💡');

    // Text Cleaning
    let cleanText = text
        .replace(/[*_~`]/g, '') // Markdown
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2700}-\u{27BF}]/gu, '') // Emojis
        .replace(/(https?:\/\/[^\s]+)/g, 'el enlace'); // Don't read URLs

    if (isEnglishMode) cleanText = text.split('💡')[0].trim(); // Speak only English part

    if (cleanText.trim().length === 0) return;

    try {
        await sock.sendPresenceUpdate('recording', id);

        // OPENAI TTS
        if (process.env.OPENAI_API_KEY) {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: "onyx", // MALE / AUTHORITATIVE
                input: cleanText.substring(0, 4096)
            });
            const buffer = Buffer.from(await mp3.arrayBuffer());
            await sock.sendMessage(id, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
        } else {
            // GOOGLE FALBACK
            const results = await googleTTS.getAllAudioBase64(cleanText, { lang: 'es', slow: false });
            for (const item of results) {
                const buffer = Buffer.from(item.base64, 'base64');
                await sock.sendMessage(id, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
            }
        }
    } catch (e) {
        console.error('Voice failed:', e);
    } finally {
        await sock.sendPresenceUpdate('paused', id);
    }
}


// --- BAILEYS CONNECTION LOGIC ---
const EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${PORT}`;

async function connectToWhatsApp() {
    global.connectionStatus = 'CONNECTING';
    io.emit('wa_status', { status: 'CONNECTING' });
    console.log('🧠 [ALEX] Starting Cognitive Engine...');

    // 1. SESSION MANAGEMENT (SUPABASE PERSISTENCE)
    let authState;
    if (supabase) {
        console.log('🔗 [ALEX] Persistence enabled (Supabase).');
        try {
            authState = await useSupabaseAuthState(supabase);
        } catch (e) {
            console.error('❌ [ALEX] Supabase Auth Error:', e.message);
            authState = await useMultiFileAuthState(sessionsDir);
        }
    } else {
        console.warn('⚠️ [ALEX] Persistence DISABLED. Missing SUPABASE_URL/KEY.');
        console.warn('⚠️ [ALEX] Sessions will wipe on Render restart.');
        authState = await useMultiFileAuthState(sessionsDir);
    }
    const { state, saveCreds } = authState;

    // 2. BAILEYS INITIALIZATION
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Alex v2.0', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 30000,
        keepAliveIntervalMs: 15000,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            global.connectionStatus = 'QR_READY';
            global.qrCodeUrl = null;
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) { global.qrCodeUrl = url; io.emit('wa_qr', { qr: url }); }
            });
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`📡 [ALEX] Closed (${statusCode}). Reconnect: ${shouldReconnect}`);

            if (statusCode === 408 || statusCode === 405) {
                console.error(`🛑 [ALEX] Timeout/Session Error. Restarting with clean state...`);
                // Only wipe if not using Supabase to avoid infinite loop
                if (!supabase && fs.existsSync(sessionsDir)) {
                    try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
                }
            }

            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 10000);
            } else {
                console.error('❌ [ALEX] Logged out.');
                if (fs.existsSync(sessionsDir)) fs.rmSync(sessionsDir, { recursive: true, force: true });
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            global.connectionStatus = 'READY';
            global.qrCodeUrl = null;
            io.emit('wa_status', { status: 'READY' });
            console.log('✅ [ALEX] WhatsApp Connected.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // MESSAGE HANDLER
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const id = msg.key.remoteJid;
                    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    const audioMsg = msg.message?.audioMessage || msg.message?.voiceMessage;

                    if (!text && !audioMsg) continue;

                    // Read receipt
                    await sock.readMessages([msg.key]);
                    await sock.sendPresenceUpdate('composing', id);

                    // AUDIO DOWNLOAD
                    let audioBuffer = null;
                    if (audioMsg) {
                        try {
                            audioBuffer = await downloadMediaMessage(
                                msg, 'buffer',
                                { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                            );
                        } catch (e) { console.error('Audio download failed'); }
                    }

                    // 🧠 CORE COGNITIVE PROCESS
                    try {
                        const response = await processMessageAleX(id, text, audioBuffer);

                        // Reply Text
                        await sock.sendMessage(id, { text: response });

                        // Reply Voice
                        await speakAlex(id, response);

                    } catch (err) {
                        console.error('Brain Error:', err);
                    }
                }
            }
        }
    });
}

// --- EXPRESS SERVER (UPDATED ENDPOINT) ---
app.post('/saas/connect', (req, res) => {
    // 1. If QR is ready, send it immediately
    if (global.qrCodeUrl) {
        return res.json({ success: true, connection_type: 'QR', qr_code: global.qrCodeUrl });
    }

    // 2. If already connected, confirm it
    if (global.connectionStatus === 'READY') {
        return res.json({ success: true, message: '✅ Alex Cognitive Engine is Active.' });
    }

    // 3. If connecting, tell them to wait
    if (global.connectionStatus === 'CONNECTING') {
        return res.json({ success: false, error: '⏳ Alex está despertando... espera el QR.' });
    }

    // 4. Default: Start if not running
    connectToWhatsApp();
    res.json({ success: false, error: '🔄 Iniciando sistema... espera 10s.' });
});

app.get('/whatsapp/status', (req, res) => {
    res.json({
        status: global.connectionStatus,
        qr: global.qrCodeUrl,
        persona: global.currentPersona
    });
});

app.post('/whatsapp/persona', (req, res) => {
    const { persona } = req.body;
    if (personas[persona]) {
        global.currentPersona = persona;
        return res.json({ success: true, persona: persona });
    }
    res.status(400).json({ success: false, error: 'Persona invalid' });
});

app.post('/whatsapp/restart', async (req, res) => {
    console.log('🔄 Restarting WhatsApp connection...');
    global.connectionStatus = 'DISCONNECTED';
    global.qrCodeUrl = null;
    try {
        if (sock) sock.end(undefined);
        if (fs.existsSync(sessionsDir)) fs.rmSync(sessionsDir, { recursive: true, force: true });
    } catch (e) { }
    connectToWhatsApp();
    res.json({ success: true, message: 'Restarting...' });
});

app.get('/api/logs', (req, res) => res.json([]));
app.get('*', (req, res) => {
    if (fs.existsSync(path.join(CLIENT_BUILD_PATH, 'index.html')))
        res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
    else res.send('Alex Cognitive Engine Live');
});

// START
connectToWhatsApp();
server.listen(PORT, () => { console.log(`🚀 Alex v2.0 Live on ${PORT}`); });

// --- AGGRESSIVE ANTI-SLEEP (RENDER FIX) ---
setInterval(async () => {
    try {
        // 1. WebSocket Ping (Baileys)
        if (sock && sock.ws && sock.ws.readyState === 1) {
            try { sock.ws.ping(); } catch (e) { }
        }

        // 2. Local Self-Ping (to avoid Render idle)
        // Using localhost:PORT avoids all HTTPS/SSL protocol errors
        try {
            await axios.get(`http://localhost:${PORT}/health`, {
                timeout: 5000,
                headers: { 'User-Agent': 'Alex-Heartbeat/2.0' }
            });
            if (global.connectionStatus === 'READY') {
                // Log only occasionally or depending on debug mode
                // console.log('💓 [ALEX] Heartbeat OK');
            }
        } catch (e) {
            // Silently ignore local errors during restarts
        }
    } catch (error) {
        // Global catch for interval
    }
}, 30000); // Every 30s

