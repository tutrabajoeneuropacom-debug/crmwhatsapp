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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const CLIENT_BUILD_PATH = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_BUILD_PATH)) app.use(express.static(CLIENT_BUILD_PATH));

// --- GLOBAL STATE ---
let sock;
global.qrCodeUrl = null;
global.connectionStatus = 'DISCONNECTED';
const sessionsDir = path.join(__dirname, 'auth_info_baileys');

// SIMPLE IN-MEMORY HISTORY
const chatHistory = {}; // { jid: [ { role, content } ] }

if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

async function connectToWhatsApp() {
    global.connectionStatus = 'CONNECTING';
    io.emit('wa_status', { status: 'CONNECTING' });
    console.log('🔄 Starting Alex Elite (Onyx + Memory)...');

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Alex Elite', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('✨ QRCode Generated');
            global.connectionStatus = 'QR_READY';
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) {
                    global.qrCodeUrl = url;
                    io.emit('wa_qr', { qr: url });
                }
            });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`❌ Connection Closed. Reconnect: ${shouldReconnect}`);
            global.connectionStatus = 'DISCONNECTED';
            global.qrCodeUrl = null;

            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 2000);
            } else {
                try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            global.connectionStatus = 'READY';
            global.qrCodeUrl = null;
            io.emit('wa_status', { status: 'READY' });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- ALEX HANDLER (MEMORY + MALE VOICE) ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const id = msg.key.remoteJid;
                    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    const audioMsg = msg.message?.audioMessage || msg.message?.voiceMessage;

                    // Send Blue Tick
                    await sock.readMessages([msg.key]);

                    // Initialize History
                    if (!chatHistory[id]) chatHistory[id] = [];

                    // 1. Handle AUDIO (Whisper)
                    if (audioMsg) {
                        try {
                            if (!process.env.OPENAI_API_KEY) throw new Error('Need OPENAI_API_KEY');

                            console.log('🎤 Downloading Audio...');
                            const buffer = await downloadMediaMessage(
                                msg,
                                'buffer',
                                { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                            );

                            const tempPath = path.join(__dirname, `audio_${Date.now()}.ogg`);
                            fs.writeFileSync(tempPath, buffer);

                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                            const transcription = await openai.audio.transcriptions.create({
                                file: fs.createReadStream(tempPath),
                                model: "whisper-1",
                                language: "es"
                            });
                            text = transcription.text;
                            console.log(`🗣️ Heard: "${text}"`);
                            fs.unlinkSync(tempPath);
                        } catch (err) {
                            console.error('Whisper Error:', err.message);
                            await sock.sendMessage(id, { text: '⚠️ No te escuché bien.' });
                            continue;
                        }
                    }

                    if (!text) continue;

                    // Add User Message to History
                    chatHistory[id].push({ role: 'user', content: text });
                    // Keep last 12 messages for good context (increased slightly)
                    if (chatHistory[id].length > 12) chatHistory[id] = chatHistory[id].slice(-12);

                    // 2. AI Logic (Alex with Memory)
                    try {
                        let responseText = '';
                        await sock.sendPresenceUpdate('composing', id);

                        if (process.env.OPENAI_API_KEY) {
                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

                            const systemPrompt = `Eres **Alex**, Asesor Senior en 'Puentes Globales' 🌍.
Tu objetivo es **guiar al usuario** hacia una Consultoría Estratégica con naturalidad.

**GUION DINÁMICO (ADAPTABLE):**
1. **Contacto:** Saluda y pregunta si quieren migrar (si no lo has hecho ya).
2. **Filtro:** Averigua si tienen CV o Score (si no lo sabes).
3. **Diagnóstico:** Si suben CV o datos, diles amablemente que el mercado Europeo es duro y necesitan mejorar.
4. **Cierre:** Vende la llamada de Calendly.

**REGLAS DE ORO:**
- **IMPORTANTE:** Revisa el historial de mensajes. ¡NO PREGUNTES LO QUE YA SABES!
- Si ya te dijeron "Sí", pasa a la siguiente fase.
- Si ya te dieron el CV, no lo pidas de nuevo, dales el feedback.
- Voz: Eres HOMBRE (Alex). Tono seguro y profesional.
- Inglés: Si te hablan en inglés, conviértete en Tutor (TalkMe).
- **NO REPITAS COMO ROBOT.** Conversa.`;

                            const completion = await openai.chat.completions.create({
                                model: "gpt-4o",
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    ...chatHistory[id] // Inject History Context
                                ],
                                max_tokens: 350
                            });
                            responseText = completion.choices[0].message.content;
                        } else {
                            responseText = `🤖 Error: Missing OpenAI Key.`;
                        }

                        // Add Bot Response to History
                        chatHistory[id].push({ role: 'assistant', content: responseText });

                        // 3. Send Text
                        await sock.sendMessage(id, { text: responseText });

                        // 4. Send Voice (ONYX - MALE & AUTHORITATIVE)
                        let textToSpeak = responseText;

                        if (responseText.includes('Correction:') || responseText.includes('Correction 💡')) {
                            textToSpeak = textToSpeak.split('💡')[0].trim();
                        }

                        // Clean Text (Remove Emojis & Markdown for audio)
                        textToSpeak = textToSpeak
                            .replace(/[*_]/g, '')
                            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2700}-\u{27BF}]/gu, '');

                        if (textToSpeak.trim().length > 0) {
                            try {
                                await sock.sendPresenceUpdate('recording', id);

                                if (process.env.OPENAI_API_KEY) {
                                    // Primary: OpenAI Onyx (MALE)
                                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                                    const mp3 = await openai.audio.speech.create({
                                        model: "tts-1",
                                        voice: "onyx", // MALE VOICE
                                        input: textToSpeak.substring(0, 4096)
                                    });
                                    const buffer = Buffer.from(await mp3.arrayBuffer());

                                    await sock.sendMessage(id, {
                                        audio: buffer,
                                        mimetype: 'audio/mp4',
                                        ptt: true
                                    });

                                } else {
                                    throw new Error('No OpenAI Key');
                                }

                            } catch (ttsError) {
                                console.error('TTS Error (Google Fallback):', ttsError.message);
                                try {
                                    const results = await googleTTS.getAllAudioBase64(textToSpeak, { lang: 'es', slow: false });
                                    for (const item of results) {
                                        const buffer = Buffer.from(item.base64, 'base64');
                                        await sock.sendMessage(id, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                                    }
                                } catch (e) { }
                            }
                        }

                        await sock.sendPresenceUpdate('paused', id);

                    } catch (e) {
                        console.error('AI Error:', e);
                        await sock.sendMessage(id, { text: '⚠️ Alex está reiniciando...' });
                    }
                }
            }
        }
    });
}


// --- API & MOCKS ---
const handleConnect = async (req, res) => {
    if (global.qrCodeUrl) return res.json({ success: true, connection_type: 'QR', qr_code: global.qrCodeUrl });
    if (global.connectionStatus === 'READY') return res.json({ success: true, message: 'Connected!' });
    // Aggressive Restart
    try { if (sock) sock.end(undefined); } catch (e) { }
    try { fs.rmSync(sessionsDir, { recursive: true, force: true }); fs.mkdirSync(sessionsDir, { recursive: true }); } catch (e) { }
    connectToWhatsApp();
    res.json({ success: false, error: '🔄 Reiniciando... espera 10s.' });
};

app.post('/saas/connect', handleConnect);
app.post('/api/saas/connect', handleConnect);
app.get('/api/logs', (req, res) => res.json([]));
app.get('*', (req, res) => { const index = path.join(CLIENT_BUILD_PATH, 'index.html'); if (fs.existsSync(index)) res.sendFile(index); else res.send('Loading...'); });

connectToWhatsApp();
server.listen(PORT, () => { console.log(`🚀 Alex Elite (Onyx) Running on ${PORT}`); });
