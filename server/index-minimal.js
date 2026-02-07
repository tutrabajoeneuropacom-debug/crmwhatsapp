require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
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
    console.log('🔄 Starting Baileys Connection...');

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['TalkMe CRM', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined, // Keep connection alive
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
                console.log('🚫 Logged out. Clearing session.');
                try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected!');
            global.connectionStatus = 'READY';
            global.qrCodeUrl = null;
            io.emit('wa_status', { status: 'READY' });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- ENHANCED MESSAGE HANDLER ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const id = msg.key.remoteJid;

                    // Extract Text from various types
                    const text = msg.message?.conversation
                        || msg.message?.extendedTextMessage?.text
                        || msg.message?.imageMessage?.caption
                        || msg.message?.videoMessage?.caption;

                    if (!text) continue;

                    console.log(`📩 INCOMING (${id}): "${text}"`);

                    // Send Blue Tick
                    await sock.readMessages([msg.key]);

                    // Simulate "Typing..."
                    await sock.sendPresenceUpdate('composing', id);
                    await new Promise(r => setTimeout(r, 1500)); // 1.5s delay to feel human

                    // AI Reply Logic
                    try {
                        let replyText = '';
                        if (process.env.OPENAI_API_KEY) {
                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                            const completion = await openai.chat.completions.create({
                                model: "gpt-4o",
                                messages: [
                                    { role: "system", content: "Eres Xari, el asistente de ventas IA. Responde de forma breve, persuasiva y profesional a los clientes." },
                                    { role: "user", content: text }
                                ],
                                max_tokens: 150
                            });
                            replyText = completion.choices[0].message.content;
                        } else {
                            replyText = `🤖 *Eco*: "${text}"\n_(Configura tu API Key)_`;
                        }

                        // Send
                        await sock.sendMessage(id, { text: replyText });
                        await sock.sendPresenceUpdate('paused', id);
                        console.log(`📤 OUTGOING: "${replyText}"`);

                    } catch (e) {
                        console.error('❌ AI ERROR:', e);
                        await sock.sendMessage(id, { text: '⚠️ Cerebro temporalmente desconectado.' });
                    }
                }
            }
        }
    });
}

// --- API ENDPOINTS ---

// Force Speak (Test)
app.post('/saas/speak', async (req, res) => {
    const { number, message } = req.body;
    if (!sock) return res.status(503).json({ error: 'WhatsApp Down' });
    try {
        const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message || '🤖 Hola! Soy Xari.' });
        res.json({ success: true, target: jid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Dashboard Connect Logic
const handleConnect = async (req, res) => {
    if (global.qrCodeUrl) {
        return res.json({ success: true, connection_type: 'QR', qr_code: global.qrCodeUrl, instance_id: 'sess_1' });
    }
    if (global.connectionStatus === 'READY') {
        return res.json({ success: true, message: 'Connected!', instance_id: 'sess_1' });
    }

    // Force Restart if stuck
    console.log('⚡ Forcing Session Reset for Dashboard...');
    try { if (sock) sock.end(undefined); } catch (e) { }
    try {
        fs.rmSync(sessionsDir, { recursive: true, force: true });
        fs.mkdirSync(sessionsDir, { recursive: true });
    } catch (e) { }
    connectToWhatsApp();
    res.json({ success: false, error: '🔄 Reiniciando... espera 10s.' });
};

app.post('/saas/connect', handleConnect);
app.post('/api/saas/connect', handleConnect);

// Mocks
app.get('/api/logs', (req, res) => res.json([]));
app.get('/api/uploads', (req, res) => res.json([]));
app.get('/health', (req, res) => res.send('OK'));

// SPA Fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
    const index = path.join(CLIENT_BUILD_PATH, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.send('Frontend Loading...');
});

// Boot
connectToWhatsApp();

server.listen(PORT, () => {
    console.log(`🚀 Xari Server Running on ${PORT}`);
});
