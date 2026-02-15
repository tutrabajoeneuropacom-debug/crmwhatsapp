// Deploy Trigger: 2026-02-15 17:18 (Force Render Sync)
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
const { generateResponse, cleanTextForTTS, detectPersonalityFromMessage } = require('./services/aiRouter');
const useSupabaseAuthState = require('./services/supabaseAuthState');

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);

// --- RECONEXIÓN CONSTANTS (GLOBAL) ---
global.MAX_RECONNECT_ATTEMPTS = 5;
global.RECONNECT_COOLDOWN = 60000;
global.reconnectAttempts = 0;

// --- SUPABASE SETUP ---
const supabaseUrl = process.env.SUPABASE_URL;
// Use SUPABASE_SERVICE_ROLE_KEY as preferred for persistence, fallback to ANON
const supabaseKey = cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY);
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- SERVER SETUP ---
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

// --- HEALTH CHECK (CRITICAL FOR RENDER) ---
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// --- DIRECT QR VIEW (BYPASS FRONTEND) ---
app.get(['/qr-final', '/qr-final**'], (req, res) => {
    if (global.qrCodeUrl) {
        res.send(`
            <div style="background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;">
                <h1 style="color: #4ade80">📱 Escanea para conectar a Alexandra</h1>
                <div style="background: white; padding: 20px; border-radius: 20px; box-shadow: 0 0 50px rgba(74, 222, 128, 0.2);">
                    <img src="${global.qrCodeUrl}" style="width: 300px; height: 300px;" />
                </div>
                <p style="margin-top: 20px; color: #64748b">Estado: <b>${global.connectionStatus}</b></p>
                <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 12px; cursor: pointer; font-weight: bold;">🔄 Actualizar QR</button>
                        <button onclick="window.location.href='/'" style="padding: 12px 24px; background: #059669; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold;">🏠 Dashboard</button>
                    </div>
                    <a href="/whatsapp/restart-direct" style="color: #ef4444; font-size: 11px; text-decoration: none; font-weight: bold; border: 1px solid #ef4444; padding: 5px 15px; border-radius: 8px; margin-top: 10px; opacity: 0.7;">⚠️ Limpiar Sesión y Reintentar</a>
                </div>

                <!-- MINI LOGS -->
                <div style="margin-top: 30px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 15px; width: 100%; max-width: 400px; text-align: left; font-family: monospace; font-size: 11px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="color: #4ade80; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; margin-bottom: 10px;">📡 EVENTOS EN TIEMPO REAL</p>
                    ${global.eventLogs.map(l => `<div style="margin-bottom: 4px;"><span style="color: #64748b">[${new Date(l.timestamp).toLocaleTimeString()}]</span> <span style="color: #4ade80">${l.from}:</span> <span style="color: #94a3b8">${l.body}</span></div>`).join('')}
                    <p style="color: #334155; margin-top: 10px; font-size: 9px;">Server Time: ${new Date().toISOString()}</p>
                </div>
            </div>
        `);
    } else {
        res.send(`
            <div style="background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; text-align: center; padding: 40px 20px;">
                <h1 style="color: #64748b; margin-bottom: 5px;">⏳ Alexandra está despertando...</h1>
                <p style="color: #475569; margin-bottom: 20px;">(Baileys está negociando con la red de WhatsApp)</p>
                <div style="width: 50px; height: 50px; border: 5px solid #1e293b; border-top-color: #4ade80; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto;"></div>
                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
                <p>Estado actual: <b>${global.connectionStatus}</b></p>
                <p style="color: #475569; font-size: 14px; max-width: 300px; margin: 15px auto;">Si tardas más de 1 minuto aquí, es posible que la conexión esté saturada.</p>
                <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                    <button onclick="window.location.reload()" style="padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 12px; cursor: pointer; font-weight: bold;">🔄 Reintentar Ahora</button>
                    <a href="/whatsapp/restart-direct" style="color: #ef4444; font-size: 11px; text-decoration: none; font-weight: bold; border: 1px solid #ef4444; padding: 5px 15px; border-radius: 8px; margin-top: 10px; opacity: 0.7;">⚠️ Forzar Reinicio Total</a>
                </div>

                <!-- MINI LOGS -->
                <div style="margin-top: 30px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 15px; width: 100%; max-width: 400px; text-align: left; font-family: monospace; font-size: 11px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="color: #4ade80; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; margin-bottom: 10px;">📡 EVENTOS EN TIEMPO REAL</p>
                    ${global.eventLogs.length > 0 ? global.eventLogs.map(l => `<div style="margin-bottom: 4px;"><span style="color: #64748b">[${new Date(l.timestamp).toLocaleTimeString()}]</span> <span style="color: #4ade80">${l.from}:</span> <span style="color: #94a3b8">${l.body}</span></div>`).join('') : '<div style="color: #334155;">Esperando actividad...</div>'}
                    <p style="color: #334155; margin-top: 10px; font-size: 9px;">Server Time: ${new Date().toISOString()}</p>
                </div>
            </div>
        `);
    }
});

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
            const userId = from.split('@')[0];
            // Enviar userId para que mantenga la memoria conversacional
            const replyText = await generateResponse(text, 'ALEX_MIGRATION', userId, []);
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
let isConnecting = false;
global.qrCodeUrl = null;
global.connectionStatus = 'DISCONNECTED';
global.currentPersona = 'ALEX_MIGRATION';
global.eventLogs = [];

const addEventLog = (body, from = 'SISTEMA') => {
    const logEntry = { body, from, timestamp: Date.now() };
    global.eventLogs.unshift(logEntry);
    if (global.eventLogs.length > 15) global.eventLogs.pop();
    if (typeof io !== 'undefined') io.emit('wa_log', logEntry);
};

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
    let baseSystem = `Eres **Alexandra v2.0**, la Arquitecta de Carreras de 'Puentes Globales'. 🌍
    
    **TU IDENTIDAD COGNITIVA:**
    - No eres un chatbot. Eres una **Estratega Senior**.
    - Tu objetivo NO es vender, es **guiar** al éxito.
    - **Piensas antes de hablar**.
    - No repites preguntas. Si ya tienes el dato, avanza.
    - Voz: Femenina (Shimmer/Alloy), suave y profesional.

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
            let list = "🎭 *Menú de Personalidades Alexandra v2.0*\n\n";
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
            return `📊 *Estado de Alexandra v2.0*\n\n` +
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
        const detected = detectPersonalityFromMessage(userText);
        if (detected && detected !== user.currentPersona) {
            user.currentPersona = detected; // FIX: CAMBIO REAL de personalidad
            console.log(`🎯 [ALEXANDRA] Auto-detected topic -> Personality: ${detected} for user ${userId}`);
        }
    }

    // --- HEURISTIC: PHASE PROGRESSION (MIGRATION JOURNEY) ---
    if (user.currentPersona === 'ALEX_MIGRATION' && user.journeyPhase === 0) {
        const textLC = userText.toLowerCase();
        if (textLC.includes('si') || textLC.includes('quiero') || textLC.includes('migrar') || textLC.includes('interesa')) {
            user.journeyPhase = 1; // AVANZA DE FASE (Saludado -> Interesado)
            console.log(`📈 [ALEXANDRA] Phase Progression: 0 -> 1 for user ${userId}`);
        }
    }

    // Handle Audio
    let processedText = userText;
    if (userAudioBuffer && OPENAI_API_KEY) {
        try {
            const tempPath = path.join(__dirname, `audio_in_${Date.now()}.ogg`);
            fs.writeFileSync(tempPath, userAudioBuffer);
            const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
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
        const aiResponse = await generateResponse(processedText, user.currentPersona, userId, user.chatLog);
        user.chatLog.push({ role: 'assistant', content: aiResponse });
        return aiResponse;
    } catch (e) {
        console.error('Brain Error:', e);
        return "⚠️ Alexandra está recalibrando sus sistemas... dame un momento.";
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

        // VOICE GENERATION LOOP
        let voiced = false;

        // 1. Try OPENAI TTS (Onyx)
        if (OPENAI_API_KEY) {
            try {
                const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
                const mp3 = await openai.audio.speech.create({
                    model: "tts-1",
                    voice: "onyx",
                    input: cleanText.substring(0, 4096)
                });
                const buffer = Buffer.from(await mp3.arrayBuffer());
                await sock.sendMessage(id, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                voiced = true;
            } catch (err) {
                console.error('⚠️ OpenAI TTS failed:', err.message);
            }
        }

        // 2. Google Fallback (if OpenAI fails or missing)
        if (!voiced) {
            console.log("🔊 Fallback to Google TTS...");
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
    if (isConnecting && global.connectionStatus === 'CONNECTING') {
        console.log('⚠️ [ALEX] Connection already in progress. Skipping duplicate call.');
        return;
    }
    isConnecting = true;
    global.connectionStatus = 'CONNECTING';
    io.emit('wa_status', { status: 'CONNECTING' });
    addEventLog('🧠 Iniciando Motor Cognitivo...');
    console.log('🧠 [ALEX] Starting Cognitive Engine...');

    // 1. SESSION MANAGEMENT (SUPABASE PERSISTENCE)
    let authState;
    if (supabase) {
        console.log('🔗 [ALEX] Persistence enabled (Supabase).');
        addEventLog('🔗 Persistencia habilitada (Supabase)');
        try {
            authState = await useSupabaseAuthState(supabase);
        } catch (e) {
            console.error('❌ [ALEX] Supabase Auth Error:', e.message);
            addEventLog('❌ Error en Supabase: ' + e.message);
            authState = await useMultiFileAuthState(sessionsDir);
        }
    } else {
        console.warn('⚠️ [ALEX] Persistence DISABLED. Missing SUPABASE_URL/KEY.');
        addEventLog('⚠️ Persistencia local (Sin Supabase)');
        authState = await useMultiFileAuthState(sessionsDir);
    }
    const { state, saveCreds } = authState;

    // 2. BAILEYS INITIALIZATION
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Mac OS', 'Chrome', '110.0.5481.178'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            global.connectionStatus = 'QR_READY';
            // Para el dashboard (socket): enviamos el string RAW del QR
            io.emit('wa_qr', { qr: qr });

            // Para la vista directa /qr-final (img tag): enviamos el DataURL
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) {
                    global.qrCodeUrl = url;
                    addEventLog('📱 QR Generado. Escanea para conectar.', 'WHATSAPP');
                    console.log('📱 [ALEX] QR String:', qr);
                }
            });
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`📡 [ALEX] Closed (${statusCode}). Reconnect: ${shouldReconnect}`);
            addEventLog(`📡 Conexión cerrada (${statusCode}). Reintentando: ${shouldReconnect}`);

            if (statusCode === 408 || statusCode === 405) {
                console.error(`🛑 [ALEX] Timeout/Session Error. Retrying without wiping session folder...`);
                // We no longer wipe the session folder here to allow Baileys to resume
            }

            if (shouldReconnect) {
                isConnecting = false;
                global.reconnectAttempts++;
                if (global.reconnectAttempts > global.MAX_RECONNECT_ATTEMPTS) {
                    console.error(`❌ [ALEX] Max reconnection attempts (${global.MAX_RECONNECT_ATTEMPTS}) reached.`);
                    console.error(`⏰ [ALEX] Cooldown for ${global.RECONNECT_COOLDOWN / 60000} minutes before retrying...`);
                    global.connectionStatus = 'DISCONNECTED';
                    setTimeout(() => {
                        console.log('🔄 [ALEX] Cooldown finished. Retrying connection...');
                        global.reconnectAttempts = 0;
                        connectToWhatsApp();
                    }, global.RECONNECT_COOLDOWN);
                } else {
                    const delayMs = Math.min(1000 * Math.pow(2, global.reconnectAttempts), 30000);
                    console.log(`🔄 [ALEX] Reconnecting in ${delayMs / 1000}s (Attempt ${global.reconnectAttempts}/${global.MAX_RECONNECT_ATTEMPTS})...`);
                    setTimeout(connectToWhatsApp, delayMs);
                }
            } else {
                isConnecting = false;
                console.error('❌ [ALEX] Logged out or Unauthorized (401). Manual intervention required.');

                // 1. Wipe local cache
                if (fs.existsSync(sessionsDir)) {
                    try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
                }

                // 2. Wipe Supabase Session (CRITICAL TO BREAK THE 401 LOOP)
                if (supabase) {
                    console.log('🧹 [ALEX] Wiping Supabase session due to 401 logout...');
                    supabase.from('whatsapp_sessions').delete().eq('session_id', 'main_session')
                        .then(() => console.log('✅ [ALEX] Supabase session cleared.'))
                        .catch(e => console.error('❌ [ALEX] Supabase clear error:', e.message));
                }

                global.connectionStatus = 'DISCONNECTED';
                global.qrCodeUrl = null;

                // Retry with a clean state after a short delay
                addEventLog('🔄 Sesión expirada. Generando nuevo QR...', 'SISTEMA');
                setTimeout(connectToWhatsApp, 10000);
            }
        } else if (connection === 'open') {
            isConnecting = false;
            reconnectAttempts = 0; // Reset attempts on success
            global.connectionStatus = 'READY';
            global.qrCodeUrl = null;
            io.emit('wa_status', { status: 'READY' });
            addEventLog('✅ WhatsApp Conectado y Listo.', 'WHATSAPP');
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

// Routes moved to top

app.post('/saas/connect', (req, res) => {
    // 1. If QR is ready, send it immediately
    if (global.qrCodeUrl) {
        return res.json({ success: true, connection_type: 'QR', qr_code: global.qrCodeUrl });
    }

    // 2. If already connected, confirm it
    if (global.connectionStatus === 'READY') {
        return res.json({ success: true, message: '✅ Alexandra Cognitive Engine is Active.' });
    }

    // 3. If connecting, tell them to wait
    if (global.connectionStatus === 'CONNECTING') {
        return res.json({ success: false, error: '⏳ Alexandra está despertando... espera el QR.' });
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

app.get('/whatsapp/logout', async (req, res) => {
    console.log('🚪 Manual Logout Triggered');
    addEventLog('🚪 Cerrando sesión y borrando datos...', 'SISTEMA');

    global.connectionStatus = 'DISCONNECTED';
    global.qrCodeUrl = null;

    try {
        if (sock) {
            sock.logout(); // Baileys standard logout
            sock.end(undefined);
        }
        // Wipe local files
        if (fs.existsSync(sessionsDir)) fs.rmSync(sessionsDir, { recursive: true, force: true });

        // Wipe Supabase
        if (supabase) {
            await supabase.from('whatsapp_sessions').delete().eq('session_id', 'main_session');
            console.log('✅ Supabase session wiped for logout.');
        }
    } catch (e) { console.error('Logout error:', e); }

    res.send(`
        <div style="background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;">
            <h1 style="color: #4ade80">👋 Sesión Cerrada</h1>
            <p>Se ha desconectado de WhatsApp y borrado la sesión de la base de datos.</p>
            <button onclick="window.location.href='/qr-final'" style="margin-top: 20px; padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 12px; cursor: pointer; font-weight: bold;">Volver a Conectar</button>
        </div>
    `);
});

app.get('/whatsapp/restart-direct', async (req, res) => {
    console.log('🔄 Forced Restart Triggered via URL');
    addEventLog('🔄 Reinicio forzado por el usuario...');

    global.connectionStatus = 'DISCONNECTED';
    global.qrCodeUrl = null;
    global.reconnectAttempts = 0;

    try {
        if (sock) sock.end(undefined);
        if (fs.existsSync(sessionsDir)) {
            fs.rmSync(sessionsDir, { recursive: true, force: true });
        }
    } catch (e) { }

    setTimeout(() => {
        connectToWhatsApp();
    }, 2000);

    res.send(`
        <div style="background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;">
            <h1 style="color: #ef4444">🧹 Sistema Reiniciado</h1>
            <p>Se ha borrado el caché local y se está reintentando la conexión.</p>
            <p>Espera 10 segundos y vuelve a la página del QR.</p>
            <button onclick="window.location.href='/qr-final'" style="margin-top: 20px; padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 12px; cursor: pointer; font-weight: bold;">Volver al QR</button>
        </div>
    `);
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
    if (fs.existsSync(path.join(CLIENT_BUILD_PATH, 'index.html'))) {
        res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
    } else {
        // If frontend is missing, redirect to the direct QR view
        res.redirect('/qr-final');
    }
});

// START
connectToWhatsApp();
server.listen(PORT, () => { console.log(`🚀 Alexandra v2.0 Live on ${PORT}`); });

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

// --- STUCK DETECTOR ---
let connectingSince = null;
setInterval(() => {
    if (global.connectionStatus === 'CONNECTING') {
        if (!connectingSince) connectingSince = Date.now();
        const duration = Date.now() - connectingSince;

        if (duration > 45000) { // FIX: 45 segundos para detectar el bloqueo (No 3 minutos!)
            console.warn('🕒 [ALEX] Connection STUCK for 45s. Forcing auto-restart...');
            connectingSince = null;
            global.connectionStatus = 'DISCONNECTED';
            if (sock) try { sock.end(undefined); } catch (e) { }
            connectToWhatsApp();
        }
    } else {
        connectingSince = null;
    }
}, 10000);

