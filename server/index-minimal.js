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
    console.log('🔄 Starting TalkMe Tutor Connection...');

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['TalkMe Tutor', 'Chrome', '1.0.0'],
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

    // --- TALKME TUTOR MESSAGE HANDLER ---
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
                            if (!process.env.OPENAI_API_KEY) throw new Error('No API Key');

                            console.log('🎤 Listening to Audio...');
                            await sock.sendPresenceUpdate('composing', id); // Show we are processing

                            // Capture Audio Buffer
                            const buffer = await downloadMediaMessage(
                                msg,
                                'buffer',
                                { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                            );

                            // Save temp file (Whisper needs file path or compatible stream)
                            const tempPath = path.join(__dirname, `audio_${Date.now()}.ogg`);
                            fs.writeFileSync(tempPath, buffer);

                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                            const transcription = await openai.audio.transcriptions.create({
                                file: fs.createReadStream(tempPath),
                                model: "whisper-1",
                                language: "en"
                            });
                            text = transcription.text;
                            console.log(`🗣️ Heard: "${text}"`);
                            fs.unlinkSync(tempPath);

                        } catch (err) {
                            console.error('Audio Error:', err.message);
                            await sock.sendMessage(id, { text: '🙉 I couldn\'t hear that properly. Could you write it?' });
                            continue;
                        }
                    }

                    if (!text) continue;

                    // 2. AI Tutor Logic
                    await sock.sendPresenceUpdate('composing', id);
                    await new Promise(r => setTimeout(r, 1000));

                    try {
                        let replyText = '';
                        if (process.env.OPENAI_API_KEY) {
                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                            const completion = await openai.chat.completions.create({
                                model: "gpt-4o",
                                messages: [
                                    { role: "system", content: "You are 'TalkMe', a friendly English Language Tutor. \n1. Respond to the user's message in clear, natural English.\n2. If the user makes a grammar mistake, add a section '💡 Correction:' at the end (explain in Spanish).\n3. Keep responses concise." },
                                    { role: "user", content: text }
                                ],
                                max_tokens: 300
                            });
                            replyText = completion.choices[0].message.content;
                        } else {
                            replyText = `🤖 *TalkMe Demo*: "${text}"`;
                        }

                        // 3. Send Text Correction
                        await sock.sendMessage(id, { text: replyText });

                        // 4. Send Voice (Only the English part)
                        if (process.env.OPENAI_API_KEY && replyText) {
                            try {
                                await sock.sendPresenceUpdate('recording', id);

                                // Clean text: Remove "Correction:" part so audio is just pure English conversation
                                let spokenText = replyText;
                                if (replyText.includes('💡')) {
                                    spokenText = replyText.split('💡')[0];
                                }

                                if (spokenText.trim().length > 0) {
                                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                                    const mp3 = await openai.audio.speech.create({
                                        model: "tts-1",
                                        voice: "alloy",
                                        input: spokenText.substring(0, 4096)
                                    });

                                    const buffer = Buffer.from(await mp3.arrayBuffer());
                                    await sock.sendMessage(id, {
                                        audio: buffer,
                                        mimetype: 'audio/mp4',
                                        ptt: true
                                    });
                                }
                            } catch (ttsError) { console.error('TTS Error', ttsError); }
                        }

                        await sock.sendPresenceUpdate('paused', id);

                    } catch (e) {
                        console.error('AI Error:', e);
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
app.get('/api/uploads', (req, res) => res.json([]));
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
    const index = path.join(CLIENT_BUILD_PATH, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.send('Frontend Loading...');
});

connectToWhatsApp();
server.listen(PORT, () => { console.log(`🚀 TalkMe Tutor Running on ${PORT}`); });
