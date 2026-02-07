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
const { GoogleGenerativeAI } = require("@google/generative-ai");
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
    console.log('🔄 Starting TalkMe (Gemini + GoogleTTS)...');

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['TalkMe Google', 'Chrome', '1.0.0'],
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

    // --- GEMINI TUTOR + GOOGLE TTS HANDLER ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const id = msg.key.remoteJid;
                    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    const audioMsg = msg.message?.audioMessage || msg.message?.voiceMessage;

                    // Send Blue Tick
                    await sock.readMessages([msg.key]);

                    // Gemini Logic
                    try {
                        let responseText = '';

                        // 1. Process Input (Gemini Multimodal)
                        if (process.env.GOOGLE_API_KEY) {
                            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
                            // Use flash model for speed and cost
                            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                            await sock.sendPresenceUpdate('composing', id);

                            // Construct Prompt
                            const systemPrompt = `You are 'TalkMe', a friendly English Language Tutor.
                            1. Respond to the user's message in clear, natural English conversationally.
                            2. If the user makes a grammar/flow mistake, add a section '💡 Correction:' at the very end (explain briefly in Spanish).
                            3. Keep responses concise (under 3 sentences).`;

                            let result;

                            if (audioMsg) {
                                console.log('🎤 Processing Audio (Gemini)...');

                                // Download Audio
                                const buffer = await downloadMediaMessage(
                                    msg,
                                    'buffer',
                                    { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                                );

                                // Send Audio + Prompt to Gemini
                                result = await model.generateContent([
                                    systemPrompt,
                                    {
                                        inlineData: {
                                            data: buffer.toString('base64'),
                                            mimeType: "audio/ogg" // OGG is standard for WhatsApp voice notes
                                        }
                                    }
                                ]);

                            } else if (text) {
                                console.log('💬 Processing Text (Gemini)...');
                                result = await model.generateContent([systemPrompt, text]);
                            } else {
                                continue;
                            }

                            responseText = result.response.text();

                        } else {
                            // Fallback if no Google Key
                            responseText = `🤖 *TalkMe Warning*: Please set GOOGLE_API_KEY to activate my brain.`;
                        }

                        // 2. Send Text Correction
                        await sock.sendMessage(id, { text: responseText });

                        // 3. Send Voice (Google TTS - Free)
                        // Note: Only speak the conversational part (before the bulb)
                        const spokenText = responseText.split('💡')[0].trim();

                        if (spokenText.length > 0) {
                            try {
                                await sock.sendPresenceUpdate('recording', id);
                                console.log('🗣️ Generating Voice (Google TTS)...');

                                // Get Audio Base64s (splits long text automatically)
                                const results = await googleTTS.getAllAudioBase64(spokenText, {
                                    lang: 'en',
                                    slow: false,
                                    host: 'https://translate.google.com',
                                    timeout: 10000,
                                });

                                // Send audio chunks (usually just 1 for short replies)
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
                        console.error('Gemini Error:', e);
                        await sock.sendMessage(id, { text: '⚠️ Brain offline (Check API Keys).' });
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
app.get('/api/uploads', (req, res) => res.json([]));
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
    const index = path.join(CLIENT_BUILD_PATH, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.send('Frontend Loading...');
});

connectToWhatsApp();
server.listen(PORT, () => { console.log(`🚀 TalkMe Google Running on ${PORT}`); });
