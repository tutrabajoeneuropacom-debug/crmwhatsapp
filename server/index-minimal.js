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
    console.log('🔄 Starting TalkMe (OpenAI + GoogleVoice)...');

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['TalkMe Hybrid', 'Chrome', '1.0.0'],
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

    // --- HYBRID HANDLER (OpenAI Brain/Ears + Google Voice) ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const id = msg.key.remoteJid;
                    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    const audioMsg = msg.message?.audioMessage || msg.message?.voiceMessage;

                    // Send Blue Tick
                    await sock.readMessages([msg.key]);

                    // 1. Handle AUDIO (Whisper - OpenAI)
                    if (audioMsg) {
                        try {
                            if (!process.env.OPENAI_API_KEY) throw new Error('Need OPENAI_API_KEY');

                            console.log('🎤 Downloading Audio...');
                            // Download buffer
                            const buffer = await downloadMediaMessage(
                                msg,
                                'buffer',
                                { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                            );

                            // Whisper needs a file path
                            const tempPath = path.join(__dirname, `audio_${Date.now()}.ogg`);
                            fs.writeFileSync(tempPath, buffer);

                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                            const transcription = await openai.audio.transcriptions.create({
                                file: fs.createReadStream(tempPath),
                                model: "whisper-1",
                                language: "en"
                            });
                            text = transcription.text;
                            console.log(`🗣️ Heard (Whisper): "${text}"`);
                            fs.unlinkSync(tempPath);

                        } catch (err) {
                            console.error('Whisper Error:', err.message);
                            await sock.sendMessage(id, { text: '⚠️ Can\'t hear you properly. Check API Key.' });
                            continue;
                        }
                    }

                    if (!text) continue;

                    // 2. AI Logic (GPT-4o)
                    try {
                        let responseText = '';
                        await sock.sendPresenceUpdate('composing', id);

                        if (process.env.OPENAI_API_KEY) {
                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                            const completion = await openai.chat.completions.create({
                                model: "gpt-4o",
                                messages: [
                                    { role: "system", content: "You are 'TalkMe', a friendly English Language Tutor.\n1. Respond conversationally in simple, clear American English.\n2. Add '💡 Correction:' at the end if the user makes mistakes (explain in Spanish).\n3. Keep responses concise." },
                                    { role: "user", content: text }
                                ],
                                max_tokens: 300
                            });
                            responseText = completion.choices[0].message.content;
                        } else {
                            responseText = `🤖 *TalkMe*: I need a brain (OPENAI_API_KEY).`;
                        }

                        // 3. Send Text Correction
                        await sock.sendMessage(id, { text: responseText });

                        // 4. Send Voice (Google TTS - Free)
                        const spokenText = responseText.split('💡')[0].trim();

                        if (spokenText.length > 0) {
                            try {
                                await sock.sendPresenceUpdate('recording', id);

                                // Get Audio Base64s via Google TTS API
                                const results = await googleTTS.getAllAudioBase64(spokenText, {
                                    lang: 'en',
                                    slow: false,
                                    host: 'https://translate.google.com',
                                    timeout: 10000,
                                });

                                for (const item of results) {
                                    const buffer = Buffer.from(item.base64, 'base64');
                                    await sock.sendMessage(id, {
                                        audio: buffer,
                                        mimetype: 'audio/mp4',
                                        ptt: true
                                    });
                                    if (results.length > 1) await new Promise(r => setTimeout(r, 500));
                                }
                            } catch (ttsError) {
                                console.error('Google TTS Error:', ttsError.message);
                            }
                        }

                        await sock.sendPresenceUpdate('paused', id);

                    } catch (e) {
                        console.error('OpenAI Error:', e);
                        await sock.sendMessage(id, { text: '⚠️ Brain offline.' });
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
server.listen(PORT, () => { console.log(`🚀 TalkMe Hybrid Running on ${PORT}`); });
