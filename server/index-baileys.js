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
const OpenAI = require('openai'); // Direct import
const axios = require('axios'); // For DeepSeek/Google

const app = express();
const PORT = process.env.PORT || 3000;

// --- SECURITY & CORS ---
// For production, this should be restricted. For MVP Deployment today, we allow all to prevent blockers.
app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));
app.use(express.json());

// --- SERVER SETUP ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve Static Frontend (if needed as fallback)
const CLIENT_BUILD_PATH = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_BUILD_PATH)) {
    app.use(express.static(CLIENT_BUILD_PATH));
}

// --- BAILEYS SESSION ---
let sock;
let qrCodeUrl = null;
let connectionStatus = 'DISCONNECTED';

// NOTE: On Render, this folder is ephemeral. Authenticated sessions will be lost on redeploy.
// For persistent production, use PostgreSQL/Supabase Auth State (complex implementation).
const sessionsDir = 'auth_info_baileys';
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// --- AI PROCESSING (SELF-CONTAINED) ---
async function generateResponse(text, user) {
    const provider = process.env.AI_PROVIDER || 'openai';
    console.log(`🧠 Processing with ${provider}...`);

    try {
        if (provider === 'deepseek') {
            const apiKey = process.env.DEEPSEEK_API_KEY;
            if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
            const res = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "Eres un asistente de ventas experto y amable. Tu objetivo es ayudar al usuario y cerrar ventas." },
                    { role: "user", content: text }
                ]
            }, { headers: { 'Authorization': `Bearer ${apiKey}` } });
            return res.data.choices[0].message.content;
        }
        else if (provider === 'google') {
            const apiKey = process.env.GOOGLE_API_KEY;
            if (!apiKey) throw new Error("Missing GOOGLE_API_KEY");
            // Simple REST fallback
            const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
                contents: [{ parts: [{ text }] }]
            });
            return res.data.candidates[0].content.parts[0].text;
        }
        else {
            // Default: OpenAI
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
            const openai = new OpenAI({ apiKey });
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "Eres Alex, un asistente virtual profesional y empático. Ayuda a los usuarios con sus dudas sobre nuestros servicios." },
                    { role: "user", content: text }
                ],
                max_tokens: 200
            });
            return completion.choices[0].message.content;
        }
    } catch (err) {
        console.error(`AI Error (${provider}):`, err.message);
        return "Lo siento, estoy teniendo problemas para pensar ahora mismo. ¿Puedes intentar de nuevo?";
    }
}

// --- WHATSAPP LOGIC ---
async function connectToWhatsApp() {
    connectionStatus = 'CONNECTING';
    io.emit('wa_status', { status: connectionStatus });
    console.log('🔄 Starting WhatsApp Connection...');

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
            console.log(`❌ Connection Closed. Reconnect: ${shouldReconnect}`);
            connectionStatus = 'DISCONNECTED';
            qrCodeUrl = null;
            io.emit('wa_status', { status: 'DISCONNECTED' });

            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 2000);
            } else {
                console.log('🚫 Logged out. Clearing session.');
                try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Connected Successfully!');
            connectionStatus = 'READY';
            qrCodeUrl = null;
            io.emit('wa_status', { status: 'READY' });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) await handleMessage(msg);
            }
        }
    });
}

const handleMessage = async (msg) => {
    try {
        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const name = msg.pushName || 'Usuario';

        if (!text) return;

        console.log(`📩 [${name}] says: ${text}`);

        // Emit to Dashboard
        io.emit('wa_log', {
            timestamp: new Date(),
            from: name,
            body: text,
            type: 'incoming'
        });

        // Generate AI Reply
        const reply = await generateResponse(text, name);

        // Send Reply
        await sock.sendMessage(remoteJid, { text: reply });
        console.log(`📤 Replied: ${reply}`);

        // Emit Reply Log
        io.emit('wa_log', {
            timestamp: new Date(),
            from: 'Bot',
            body: reply,
            type: 'outgoing'
        });

    } catch (err) {
        console.error('❌ Handle Message Error:', err);
    }
};

// --- ROUTES ---
app.get('/whatsapp/status', (req, res) => res.json({ status: connectionStatus, qr: qrCodeUrl }));
app.get('/api/whatsapp/status', (req, res) => res.json({ status: connectionStatus, qr: qrCodeUrl })); // Alias

app.post('/whatsapp/restart', (req, res) => {
    try { sock.end(undefined); } catch (e) { }
    try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
    connectToWhatsApp();
    res.json({ success: true, message: "Restarting..." });
});

app.get('/health', (req, res) => res.send('OK'));

// Start
connectToWhatsApp();

server.listen(PORT, () => {
    console.log(`🚀 Server Running on ${PORT} | AI: ${process.env.AI_PROVIDER || 'OpenAI'}`);
});
