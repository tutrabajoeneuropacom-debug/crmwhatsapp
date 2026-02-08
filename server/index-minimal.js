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

if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

async function connectToWhatsApp() {
    global.connectionStatus = 'CONNECTING';
    io.emit('wa_status', { status: 'CONNECTING' });
    console.log('🔄 Starting Puentes Globales (Sweet Voice)...');

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Use terminal for QR logging
        logger: pino({ level: 'silent' }),
        browser: ['Puentes Sweet', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('✨ QRCode Generated'); // Log clearly for deployment logs
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

    // --- HANDLER: SWEET VOICE (NOVA) ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const id = msg.key.remoteJid;
                    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    const audioMsg = msg.message?.audioMessage || msg.message?.voiceMessage;

                    // Send Blue Tick
                    await sock.readMessages([msg.key]);

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
                                language: "es" // Optimized for Spanish/Global context
                            });
                            text = transcription.text;
                            console.log(`🗣️ Heard (Whisper): "${text}"`);
                            fs.unlinkSync(tempPath);

                        } catch (err) {
                            console.error('Whisper Error:', err.message);
                            await sock.sendMessage(id, { text: '⚠️ No te escuché bien. Intenta de nuevo.' });
                            continue;
                        }
                    }

                    if (!text) continue;

                    // 2. AI Logic (GPT-4o) - PUENTES GLOBALES PROMPT
                    try {
                        let responseText = '';
                        await sock.sendPresenceUpdate('composing', id);

                        if (process.env.OPENAI_API_KEY) {
                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

                            // SYSTEM PROMPT: ALEX (ELITE CLOSER) + TALKME TUTOR
                            const systemPrompt = `Eres **Alex**, estratega senior en 'Puentes Globales'. 🌍
No eres un asistente básico. Eres un **"Elite Career Coach"** experto en recolocación internacional.

**TUS 2 MODOS DE OPERACIÓN:**

🔴 **MODO 1: ALEX (Evaluador de Perfiles - Español)**
Tu objetivo: **VENDER la Consultoría de Diagnóstico**.
1. **Personalidad:** Directo, analítico, desafiante y profesional. No eres servil. Dices la verdad dura.
2. **Contexto:** El usuario tiene un perfil que probablemente NO pasará los filtros europeos/USA actuales.
3. **Flujo de Venta:**
   - Si no tienes datos del usuario, **pídele que suba su CV** o pregúntale: *"¿Cuál es tu score actual en Antigravity?"*.
   - **Desafía:** *"Con ese perfil/score, tu probabilidad de éxito es <15%."*
   - **Roleplay:** Hazle una pregunta difícil de entrevista (ej: técnica o de liderazgo) para probarlo.
   - **Quiebre:** Explícale fríamente por qué su respuesta falló.
   - **Cierre (CTA):** Vende la entrevista como la *única* solución. *"Tengo un hueco en la agenda. ¿Te reservo una sesión de plan de choque?"*

🔵 **MODO 2: TALKME (Tutor de Inglés - English)**
Si el usuario te escribe en **INGLÉS**:
   - Cambia a "TalkMe Tutor".
   - Sé un profesor nativo amable y alentador.
   - Conversa en inglés y corrige errores al final con '💡 Correction:'.
   - *Objetivo:* Demostrar que practicar inglés es clave para su éxito global.

**Regla de Oro:**
- Sé breve (WhatsApp).
- Usa emojis de autoridad: 🚀, 🛑, 📉, 🇪🇺.
- Voz (TTS): Tu voz es dulce y profesional, pero tus palabras son afiladas.`;

                            const completion = await openai.chat.completions.create({
                                model: "gpt-4o",
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: text }
                                ],
                                max_tokens: 350
                            });
                            responseText = completion.choices[0].message.content;
                        } else {
                            responseText = `🤖 *Puentes Globales AI*: Error de configuración (OPENAI_API_KEY).`;
                        }

                        // 3. Send Text
                        await sock.sendMessage(id, { text: responseText });

                        // 4. Send Voice (CLEANED & ROBUST)
                        let textToSpeak = responseText;

                        // A. Logic for English Tutor Mode (Split Correction)
                        if (responseText.includes('Correction:') || responseText.includes('Correction 💡')) {
                            textToSpeak = textToSpeak.split('💡')[0].trim();
                        }

                        // B. Clean Text for TTS (Remove Emojis & Markdown)
                        // Removes: *, _, and Emoji ranges roughly
                        textToSpeak = textToSpeak
                            .replace(/[*_]/g, '') // Remove Markdown
                            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2700}-\u{27BF}]/gu, ''); // Remove most Emojis

                        if (textToSpeak.trim().length > 0) {
                            try {
                                await sock.sendPresenceUpdate('recording', id);

                                if (process.env.OPENAI_API_KEY) {
                                    // Primary: OpenAI Nova
                                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                                    const mp3 = await openai.audio.speech.create({
                                        model: "tts-1",
                                        voice: "nova",
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
                                console.error('TTS Fallback (Google):', ttsError.message);

                                // Fallback: Google TTS
                                try {
                                    const results = await googleTTS.getAllAudioBase64(textToSpeak, {
                                        lang: 'es',
                                        slow: false,
                                        host: 'https://translate.google.com',
                                        timeout: 10000
                                    });
                                    for (const item of results) {
                                        const buffer = Buffer.from(item.base64, 'base64');
                                        await sock.sendMessage(id, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                                    }
                                } catch (e) { console.error('Voice completely failed:', e); }
                            }
                        }

                        await sock.sendPresenceUpdate('paused', id);

                    } catch (e) {
                        console.error('OpenAI Error:', e);
                        await sock.sendMessage(id, { text: '⚠️ Cerebro desconectado.' });
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
server.listen(PORT, () => { console.log(`🚀 Puentes Globales (SweetNova) Running on ${PORT}`); });
