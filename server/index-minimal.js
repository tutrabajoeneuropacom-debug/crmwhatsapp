require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay, downloadMediaMessage } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const OpenAI = require('openai');
const googleTTS = require('google-tts-api');

// --- SERVER SETUP ---
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
const CLIENT_BUILD_PATH = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_BUILD_PATH)) app.use(express.static(CLIENT_BUILD_PATH));

// --- GLOBAL BAILEYS STATE ---
let sock;
global.qrCodeUrl = null;
global.connectionStatus = 'DISCONNECTED';
const sessionsDir = path.join(__dirname, 'auth_info_baileys');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

// ==============================================================================
// 🧠 ALEX v2.0 COGNITIVE ENGINE (Arquitectura Distribuida Simulada)
// ==============================================================================

// 1. MOCK DATABASE (Supabase Simulator)
// Holds the "Truth" about where the user is in the funnel
const userDatabase = {};
/* Structure:
   jid: {
      name: String,
      journeyPhase: 0-4, // 0:Exploration, 1:CV_Created, 2:ATS_Simulated, 3:Psychometric, 4:Calendly
      metrics: { cvScore: null, atsIssues: [] },
      interactions: [], // Long term memory summary
      lastAction: timestamp
   }
*/

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
            - Call to Action: Calendly.`;
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
    // A. Init User State if new
    if (!userDatabase[userId]) {
        userDatabase[userId] = {
            name: 'Candidato',
            journeyPhase: 0,
            metrics: { cvScore: null },
            chatLog: [] // Short term memory
        };
    }
    const user = userDatabase[userId];

    // B. Handle Audio (Whisper Ear)
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

    // UPDATE HISTORY
    user.chatLog.push({ role: 'user', content: processedText });
    if (user.chatLog.length > 10) user.chatLog = user.chatLog.slice(-10);

    // C. INTELLIGENT ROUTING (Pseudo-Function Calling)
    // Detect intent keywords to update phase "magically" (Simulating API Webhooks)
    const lowerText = processedText.toLowerCase();

    // Heuristics to update state (Cognitive Dots)
    if (lowerText.includes('cv') && lowerText.includes('listo') && user.journeyPhase === 0) {
        user.journeyPhase = 1; // User says "CV Ready"
    } else if (lowerText.includes('ats') && (lowerText.includes('mal') || lowerText.includes('error')) && user.journeyPhase === 1) {
        user.journeyPhase = 2; // User simulated ATS and failed
    } else if (lowerText.includes('agendar') || lowerText.includes('llamada')) {
        user.journeyPhase = 4; // Wants to book
    } else if (lowerText.includes('reiniciar') || lowerText.includes('hola')) {
        // If saying Hello after a long time, maybe check context? 
        // For now, keep state unless explicit reset.
    }

    // D. GENERATE THOUGHT & RESPONSE (GPT-4o)
    if (!process.env.OPENAI_API_KEY) return "⚠️ Error: Cerebro desconectado (API Key).";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const dynamicSystemPrompt = getDynamicPrompt(user, user.chatLog);

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: dynamicSystemPrompt },
            ...user.chatLog
        ],
        max_tokens: 350
    });

    const aiResponse = completion.choices[0].message.content;

    // Update History
    user.chatLog.push({ role: 'assistant', content: aiResponse });

    return aiResponse;
}

// 4. VOICE ENGINE (TTS - Onyx Cleaned)
async function speakAlex(id, text) {
    if (!text) return;

    // Detect Language Mode (Tutor vs Alex)
    // Simple heuristic: If text contains "Correction:", likely English mode.
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
async function connectToWhatsApp() {
    global.connectionStatus = 'CONNECTING';
    io.emit('wa_status', { status: 'CONNECTING' });
    console.log('🧠 Starting Alex v2.0 Cognitive Engine...');

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Alex Cognitive', 'Chrome', '2.0.0'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
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
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(connectToWhatsApp, 2000);
            else {
                try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            global.connectionStatus = 'READY';
            io.emit('wa_status', { status: 'READY' });
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

// --- EXPRESS SERVER ---
app.post('/saas/connect', (req, res) => {
    // Reset Logic
    try { if (sock) sock.end(undefined); } catch (e) { }
    try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
    connectToWhatsApp();
    res.json({ success: false, error: '🔄 Rebooting Alex...' });
});
app.get('*', (req, res) => {
    if (fs.existsSync(path.join(CLIENT_BUILD_PATH, 'index.html')))
        res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
    else res.send('Alex Cognitive Engine Loading...');
});

// START
connectToWhatsApp();
server.listen(PORT, () => { console.log(`🚀 Alex v2.0 Live on ${PORT}`); });
