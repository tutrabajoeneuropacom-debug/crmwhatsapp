require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const OpenAI = require('openai');
const axios = require('axios');

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
        connectTimeoutMs: 60000
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
                    io.emit('wa_status', { status: 'QR_READY' });
                }
            });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`❌ Connection Closed. Reconnect: ${shouldReconnect}`);
            global.connectionStatus = 'DISCONNECTED';
            global.qrCodeUrl = null;
            io.emit('wa_status', { status: 'DISCONNECTED' });

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
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const id = msg.key.remoteJid;
                    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

                    if (!text) continue;

                    console.log(`📩 Mensaje de ${id}: ${text}`);

                    try {
                        let reply = '';

                        // 1. Try OpenAI if Key exists
                        if (process.env.OPENAI_API_KEY) {
                            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                            const completion = await openai.chat.completions.create({
                                model: "gpt-4o",
                                messages: [
                                    { role: "system", content: "Eres un asistente virtual de Xari SaaS. Responde de forma breve, profesional y útil." },
                                    { role: "user", content: text }
                                ]
                            });
                            reply = completion.choices[0].message.content;
                        } else {
                            // 2. Fallback Echo
                            reply = `🤖 *Xari Bot*: No tengo cerebro (API Key faltante).\nDijiste: "${text}"`;
                        }

                        // 3. Send Reply
                        await sock.sendMessage(id, { text: reply });
                        console.log(`📤 Respuesta enviada: ${reply}`);

                    } catch (e) {
                        console.error('❌ Error AI:', e);
                    }
                }
            }
        }
    });
}

// --- DASHBOARD API ENDPOINTS (AGGRESSIVE MODE) ---
const handleConnect = async (req, res) => {
    // 1. If QR exists, return it immediately
    if (global.qrCodeUrl) {
        return res.json({
            success: true,
            connection_type: 'QR',
            qr_code: global.qrCodeUrl,
            instance_id: 'session_default'
        });
    }

    // 2. If already connected, return success
    if (global.connectionStatus === 'READY') {
        return res.json({ success: true, message: 'Already Connected!', instance_id: 'session_default' });
    }

    // 3. FORCE RESTART SESSION
    console.log('⚡ Dashboard requested QR. Forcing New Session...');

    // Kill existing socket
    try { if (sock) sock.end(undefined); } catch (e) { }

    // Wipe auth folder to force fresh QR
    try {
        fs.rmSync(sessionsDir, { recursive: true, force: true });
        fs.mkdirSync(sessionsDir, { recursive: true });
    } catch (e) { }

    // Start New Connection process
    connectToWhatsApp();

    res.json({ success: false, error: '🔄 Reiniciando WhatsApp... Espera 10s y dale click otra vez.' });
};

app.post('/saas/connect', handleConnect);
app.post('/api/saas/connect', handleConnect);

// Mocks
app.get('/api/logs', (req, res) => res.json([]));
app.get('/api/uploads', (req, res) => res.json([]));
app.get('/health', (req, res) => res.send('OK'));

// SPA Fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Endpoint not found' });
    const index = path.join(CLIENT_BUILD_PATH, 'index.html');
    if (fs.existsSync(index)) res.sendFile(index);
    else res.send('Frontend loading... refresh in 30s');
});

// Auto-start on boot
connectToWhatsApp();

server.listen(PORT, () => {
    console.log(`🚀 AGGRESSIVE Baileys Server Running on ${PORT}`);
});
