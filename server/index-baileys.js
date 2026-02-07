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

// Services
const { getOpenAI } = require('./services/openaiClient'); // Reuse existing OpenAI logic if possible
// We will implement simple handleMessage here or reuse a service

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP Server & Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for MVP
        methods: ["GET", "POST"]
    }
});

// Serve Frontend Static Files
const CLIENT_BUILD_PATH = path.join(__dirname, '../client/dist');
app.use(express.static(CLIENT_BUILD_PATH));

// --- BAILEYS LOGIC ---
let sock;
let qrCodeUrl = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED, QR_READY, CONNECTING, READY

const sessionsDir = 'auth_info_baileys';
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

async function connectToWhatsApp() {
    connectionStatus = 'CONNECTING';
    io.emit('wa_status', { status: connectionStatus });

    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }), // Hide logs to clean terminal
        browser: ['TalkMe CRM', 'Chrome', '1.0.0'],
        syncFullHistory: false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QRCode received');
            connectionStatus = 'QR_READY';
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) {
                    qrCodeUrl = url;
                    io.emit('wa_qr', { qr: url });
                    io.emit('wa_status', { status: 'QR_READY' });
                }
            });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting?', shouldReconnect);
            connectionStatus = 'DISCONNECTED';
            qrCodeUrl = null;
            io.emit('wa_status', { status: 'DISCONNECTED' });

            if (shouldReconnect) {
                // Delay restart slightly
                setTimeout(connectToWhatsApp, 2000);
            } else {
                console.log('Logged out. Please restart to scan QR again.');
                // Delete auth folder to force new QR
                fs.rmSync(sessionsDir, { recursive: true, force: true });
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected!');
            connectionStatus = 'READY';
            qrCodeUrl = null;
            io.emit('wa_status', { status: 'READY' });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) handleMessage(msg);
            }
        }
    });
}

// --- MESSAGE HANDLER (AI) ---
const handleMessage = async (msg) => {
    const remoteJid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const name = msg.pushName || 'Usuario';

    if (!text) return;

    console.log(`📩 Msg from ${name}: ${text}`);

    // Emit Log to Frontend Dashboard
    io.emit('wa_log', {
        timestamp: new Date(),
        from: name,
        body: text,
        type: 'incoming'
    });

    // AI Logic (Simplified for this file, ideally import from service)
    // Using OpenAI directly here for robust single-file Bailey server
    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Use Multi-Provider keys if available
        // ... (Simplified: Text response)

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Eres un asistente de ventas útil y amable. Responde en español." },
                { role: "user", content: text }
            ],
            max_tokens: 150
        });

        const reply = completion.choices[0].message.content;

        // Send Reply
        await sock.sendMessage(remoteJid, { text: reply });
        console.log(`📤 Replied: ${reply}`);

        // Log Outgoing
        io.emit('wa_log', {
            timestamp: new Date(),
            from: 'Bot',
            body: reply,
            type: 'outgoing'
        });

    } catch (e) {
        console.error('AI Error:', e.message);
    }
};

// --- API ENDPOINTS (Frontend Expects These) ---
// Note: Frontend calls /whatsapp/status via generic API client, likely prefixed /api or root.
// Based on WhatsAppConnect.jsx: api.get('/whatsapp/status')
// Assuming api.js uses base URL from Vite env.

app.get('/whatsapp/status', (req, res) => {
    res.json({
        status: connectionStatus,
        qr: qrCodeUrl
    });
});
// Alias for /api prefix if frontend adds it
app.get('/api/whatsapp/status', (req, res) => {
    res.json({ status: connectionStatus, qr: qrCodeUrl });
});

app.post('/whatsapp/restart', (req, res) => {
    console.log('Restaring session...');
    try {
        sock.end(undefined); // Close current
    } catch (e) { }
    fs.rmSync(sessionsDir, { recursive: true, force: true });
    connectToWhatsApp();
    res.json({ success: true });
});
// Alias
app.post('/api/whatsapp/restart', (req, res) => {
    try { sock.end(undefined); } catch (e) { }
    try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
    connectToWhatsApp();
    res.json({ success: true });
});

app.get('/health', (req, res) => res.send('OK - Baileys Server Running'));

// Start
connectToWhatsApp();

server.listen(PORT, () => {
    console.log(`🚀 Baileys Server with Socket.io running on port ${PORT}`);
});
