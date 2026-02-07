const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const pino = require('pino');
const OpenAI = require('openai');
const express = require('express');
const router = express.Router();
const copperService = require('./copperService'); // Ensure this exists

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Session Storage
const activeSessions = new Map();
const clientConfigs = new Map();
const sessionsDir = './sessions';

if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// --- 🧠 BUSINESS LOGIC TEMPLATES ---
const BUSINESS_TEMPLATES = {
    pizzeria: (name) => `Eres el asistente virtual de la pizzería "${name}". Tu objetivo es tomar pedidos, ofrecer el menú y confirmar direcciones. Sé amable y breve.`,
    dentista: (name) => `Eres la secretaria virtual del consultorio dental "${name}". Tu objetivo es agendar citas, responder dudas sobre horarios y precios básicos.`,
    generic: (name) => `Eres un asistente virtual útil y profesional para el negocio "${name}". Responde dudas y ayuda a los clientes.`,
    talkme_sales: () => `Eres el "Coach de Admisión" de TalkMe, una plataforma revolucionaria de inglés con IA.
    TU OBJETIVO: Vender la suscripción Pro ($19/mes).
    ESTRATEGIA:
    1. Si el usuario saluda, ofrécele un "Diagnóstico de Nivel Express" gratuito (3 preguntas rápidas).
    2. Hazle una pregunta simple de inglés (ej: "Completa: I ___ happy").
    3. Dale feedback positivo y dile: "¡Tienes potencial! Con TalkMe podrías dominar esto en 3 meses".
    4. CIERRE: "Suscríbete ahora y obtén tu primer mes con 50% OFF aquí: https://mvp-idiomas-server.onrender.com/payment-setup".
    
    IMPORTANTE:
    - Sé entusiasta, usa emojis 🚀.
    - No des clases largas gratis, tu fin es CONVERTIR a venta.
    - Si preguntan precio: "$19/mes, pero hoy puedes entrar con descuento".`
};

// --- AI GENERATION LOGIC (MULTI-PROVIDER) ---
async function generateAIResponse(message, history, businessType, businessName, customPrompt) {
    try {
        // 1. Select Template & Construct System Prompt
        const templateFn = BUSINESS_TEMPLATES[businessType] || BUSINESS_TEMPLATES.generic;
        let systemPrompt = templateFn(businessName);
        if (customPrompt && customPrompt.trim() !== "") {
            systemPrompt = customPrompt;
        }

        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: message }
        ];

        // 2. Select Provider (Default: OpenAI)
        // You can make this dynamic per bot in the future
        const provider = process.env.AI_PROVIDER || 'openai';

        let replyText = "";

        if (provider === 'deepseek') {
            const deepseekKey = process.env.DEEPSEEK_API_KEY;
            if (!deepseekKey) throw new Error("DeepSeek API Key missing");
            const response = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: messages
            }, { headers: { 'Authorization': `Bearer ${deepseekKey}` } });
            replyText = response.data.choices[0].message.content;

        } else if (provider === 'google') {
            const googleKey = process.env.GOOGLE_API_KEY;
            if (!googleKey) throw new Error("Google API Key missing");
            // Mapping messages format for Gemini (simplified)
            const geminiContents = messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            })).filter(m => m.role !== 'system'); // Gemini handles system prompt differently usually, but for REST simple chat:

            // Note: For full gemini support, better to use @google/generative-ai sdk. 
            // Using simple axios fallback here or reverting to OpenAI if complex.
            // For stability in this MVP, we will fallback to OpenAI if Google logic is complex to implement without SDK.
            // BUT, user asked for it. Let's use a simple OpenAI-compatible endpoint if they provide one, or standard Rest.
            // Google Gemini generic REST:
            // https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=...

            const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${googleKey}`, {
                contents: geminiContents,
                system_instruction: { parts: [{ text: systemPrompt }] } // Gemini 1.5 Pro/Flash supports this
            });
            replyText = response.data.candidates[0].content.parts[0].text;

        } else {
            // Default: OpenAI
            const completion = await openai.chat.completions.create({
                model: "gpt-4o", // Or gpt-3.5-turbo
                messages: messages,
                max_tokens: 300,
                temperature: 0.7,
            });
            replyText = completion.choices[0].message.content;
        }

        return replyText;

    } catch (error) {
        logger.error({ err: error }, 'Error generating AI response');
        return "Lo siento, tuve un error procesando tu mensaje. (IA Error)";
    }
}

// --- 📲 QR HANDLER (NO CRM) ---
async function handleQRMessage(sock, msg, instanceId) {
    if (!msg.message) return;
    if (msg.key.remoteJid === 'status@broadcast') return;
    if (msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    // Get Config
    const config = clientConfigs.get(instanceId) || { companyName: 'Nuestro Negocio', businessType: 'generic' };
    const { companyName } = config;

    const remoteJid = msg.key.remoteJid;
    console.log(`📩 [QR: ${companyName}] Msg: ${text}`);

    try {
        await new Promise(r => setTimeout(r, 1000));
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', remoteJid);

        const reply = await generateAIResponse(text, config);

        await sock.sendMessage(remoteJid, { text: reply });
        console.log(`📤 Bot Replied: ${reply}`);

    } catch (err) {
        console.error('❌ QR Handler Error:', err.message);
    }
}

// --- ☁️ CLOUD API HANDLER (WITH CRM) ---
async function handleCloudMessage(message) {
    const from = message.from;
    const text = message.text?.body;
    const name = message.contacts?.[0]?.profile?.name || 'Usuario';

    // For MVP, allow overriding logic via env or DB
    // Here we hardcode a default "API Mode" behavior or look up by PhoneNumberID in a real DB
    const config = {
        companyName: 'TalkMe AI',
        businessType: 'talkme_sales', // DEFAULT TO SALES BOT FOR API
        connectionType: 'API',
        mode: 'text',
        crmEnabled: true
    };

    console.log(`📩 [API: ${from}] Msg: ${text}`);

    // 1. CRM Sync (API Only)
    if (config.crmEnabled && copperService) {
        copperService.syncUser(from, name, null).catch(err => console.error('CRM Sync Fail:', err));
    }

    // 2. Generate Reply
    const reply = await generateAIResponse(text, config);

    // 3. Send Reply (Using Cloud API)
    try {
        const axios = require('axios');
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

        if (!phoneNumberId || !accessToken) {
            console.error('❌ Missing WhatsApp Cloud API Credentials');
            return;
        }

        await axios.post(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: from,
                type: 'text',
                text: { body: reply }
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log(`📤 Cloud API Replied: ${reply}`);
    } catch (error) {
        console.error('❌ Cloud API Send Error:', error.response?.data || error.message);
    }
}


// --- 🔗 CONNECT FUNCTION (Baileys) ---
async function connectToWhatsApp(instanceId, config, res = null) {
    const sessionPath = `${sessionsDir}/${instanceId}`;
    clientConfigs.set(instanceId, config);
    const { companyName } = config;

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        syncFullHistory: false,
        retryRequestDelayMs: 250
    });

    activeSessions.set(instanceId, sock);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && res && !res.headersSent) {
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) {
                    res.json({
                        success: true,
                        instance_id: instanceId,
                        qr_code: url,
                        message: 'Escanear QR para conectar (Modo Celular)'
                    });
                }
            });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(instanceId, config, null), 2000);
            } else {
                activeSessions.delete(instanceId);
                clientConfigs.delete(instanceId);
                try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (e) { }
            }
        } else if (connection === 'open') {
            const type = config.connectionType || 'QR';
            console.log(`✅ ${companyName} (${type}) ONLINE!`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                await handleQRMessage(sock, msg, instanceId);
            }
        }
    });

    return sock;
}

// --- 🔗 SAAS CONNECT ENDPOINT ---
router.post('/connect', async (req, res) => {
    const { companyName, businessType, connectionType, mode, customPrompt, voiceId } = req.body;

    const config = {
        companyName,
        businessType: businessType || 'generic',
        connectionType: connectionType || 'QR',
        mode: mode || 'text',
        customPrompt,
        voiceId
    };

    console.log(`🔌 Client Request: ${companyName} [${config.businessType}]`);

    if (config.connectionType === 'QR') {
        const safeName = companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const instanceId = `saas_${safeName}_${Date.now()}`;

        try {
            await connectToWhatsApp(instanceId, config, res);
            setTimeout(() => {
                if (!res.headersSent) res.status(408).json({ error: 'Timeout waiting for QR.' });
            }, 15000);
        } catch (err) {
            if (!res.headersSent) res.status(500).json({ error: err.message });
        }
    } else {
        res.json({
            success: true,
            connection_type: 'API',
            message: 'Configuración API lista.',
            webhook_url: 'https://crmwhatsapp-xari.onrender.com/api/saas/webhook'
        });
    }
});

// --- 🔗 WEBHOOKS ---
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe') {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

router.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object) {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;

        if (messages && messages[0]) {
            const msg = messages[0];
            const normalizedMsg = {
                from: msg.from,
                text: msg.text,
                type: msg.type,
                contacts: value.contacts
            };
            await handleCloudMessage(normalizedMsg);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

module.exports = router;
