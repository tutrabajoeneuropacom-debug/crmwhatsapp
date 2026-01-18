// Polyfill for global crypto (Required for Baileys on some Node envs)
if (!global.crypto) {
    global.crypto = require('crypto');
}

const { makeWASocket, DisconnectReason, makeCacheableSignalKeyStore, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
// const useSupabaseAuthState = require('./supabaseAuthState'); // Disabled for testing
const { createClient } = require('@supabase/supabase-js');
const { HttpsProxyAgent } = require('https-proxy-agent'); // Proxy support

// Initialize internal Supabase Admin for Session Storage
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.status = 'DISCONNECTED';
        this.qrCodeUrl = null;
        this.pairingCode = null;
        this.phoneNumber = null;
        this.io = null;
        this.logs = []; // In-memory logs
        this.lastError = null;
        this.lastInitTime = 0;
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${type}] ${msg}`;
        console.log(logEntry);
        this.logs.unshift(logEntry);
        if (this.logs.length > 50) this.logs.pop();
    }

    setSocket(io) {
        this.io = io;
        const envPhone = process.env.WHATSAPP_PHONE;
        if (envPhone) {
            this.initializeClient(envPhone);
        } else {
            this.initializeClient();
        }
    }

    async initializeClient(phoneNumber) {
        // 1. Throttle Reconnections
        const now = Date.now();
        if (this.lastInitTime && (now - this.lastInitTime) < 5000) {
            this.log('⚠️ Throttling: Connection attempt too fast. Ignoring.', 'warn');
            return;
        }
        this.lastInitTime = now;

        this.log("Initializing WhatsApp Client (LOCAL FILE STORAGE + PROXY)...");
        this.lastError = null;
        if (phoneNumber) this.phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        try {
            // Auth management via LOCAL FILE SYSTEM (latency check)
            // const { state, saveCreds } = await useSupabaseAuthState(supabase);
            const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

            // Proxy Configuration (Definitive Solution for 405)
            const proxyUrl = undefined; // FORCE NO PROXY FOR LOCAL TEST
            let wsAgent = undefined;
            let httpAgent = undefined;

            if (proxyUrl) {
                this.log(`🌐 Using Proxy: ${proxyUrl.replace(/:[^:]*@/, ':***@')}`);
                wsAgent = new HttpsProxyAgent(proxyUrl);
                httpAgent = new HttpsProxyAgent(proxyUrl);
            }

            // CONSENSUS CONFIGURATION
            this.sock = makeWASocket({
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                mobile: false,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
                },
                // SWITCHING SIGNATURE TO UBUNTU (Standard Baileys)
                browser: ['Ubuntu', 'Chrome', '20.0.04'],
                // 2. Critical for Serverless
                syncFullHistory: false,
                // 3. Ninja Mode
                markOnlineOnConnect: false,
                // 4. Stability Settings
                connectTimeoutMs: 20000,
                defaultQueryTimeoutMs: 20000,
                retryRequestDelayMs: 2000,
                keepAliveIntervalMs: 10000,
                // 5. Proxy Agents (Separated)
                // agent: wsAgent, // DISABLED FOR LOCAL
                // fetchAgent: httpAgent // DISABLED FOR LOCAL
            });

            // Pairing Code Logic
            if (!state.creds.registered && this.phoneNumber) {
                this.log(`📱 Requesting Pairing Code for ${this.phoneNumber}...`);
                setTimeout(async () => {
                    try {
                        this.pairingCode = await this.sock.requestPairingCode(this.phoneNumber);
                        this.log(`✅ PAIRING CODE GENERATED: ${this.pairingCode}`);
                        this.status = 'PAIRING_READY';
                        if (this.io) this.io.emit('wa_pairing_code', { code: this.pairingCode });
                    } catch (err) {
                        this.lastError = err.message;
                        this.log(`❌ Failed to request pairing code: ${err.message}`, 'error');
                    }
                }, 4000); // Increased wait to 4s
            }

            // Connection Update Handler
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.log('QR RECEIVED (Fallback)');
                    this.qrCodeUrl = qr;
                    if (!this.phoneNumber) { // Only status QR if we are not using pairing code
                        this.status = 'QR_READY';
                        if (this.io) this.io.emit('wa_qr', { qr });
                    }
                }

                if (connection === 'close') {
                    const error = lastDisconnect?.error;
                    // Detect if 405 is actually the status code from the output
                    const statusCode = error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    this.lastError = `Connection Closed. Code: ${statusCode}. Details: ${error?.message}`;
                    this.log(`Connection closed. Reconnecting?: ${shouldReconnect}. Error: ${this.lastError}`, 'warn');

                    this.status = 'DISCONNECTED';

                    if (statusCode === 405) {
                        this.log('🛑 ERROR 405 DETECTED (Corrupted Session). Auto-reconnect paused. Please use /api/whatsapp/wipe', 'error');
                        // Do NOT call initializeClient again here
                    } else if (shouldReconnect) {
                        setTimeout(() => this.initializeClient(this.phoneNumber), 2000);
                    } else {
                        this.log('Logged out fatal error. Delete auth to restart.', 'error');
                    }

                    if (this.io) this.io.emit('wa_status', { status: 'DISCONNECTED' });
                } else if (connection === 'open') {
                    this.log('WHATSAPP CLIENT IS READY! 🚀');
                    this.status = 'READY';
                    this.qrCodeUrl = null;
                    this.pairingCode = null;
                    this.lastError = null;
                    if (this.io) this.io.emit('wa_status', { status: 'READY' });
                }
            });

            // Creds Update Handler
            this.sock.ev.on('creds.update', saveCreds);

            // Message Handler
            this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify') return;

                for (const msg of messages) {
                    if (!msg.message) continue;

                    // Extract Body
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
                    if (!text) continue;

                    // Sender
                    const from = msg.key.remoteJid;
                    const isMe = msg.key.fromMe;
                    this.log(`MESSAGE RECEIVED from ${from}: ${text.substring(0, 20)}...`);

                    if (this.io) this.io.emit('wa_log', {
                        from: from.replace('@s.whatsapp.net', ''),
                        body: text,
                        timestamp: new Date()
                    });

                    if (isMe) continue; // Don't reply to self

                    // Ping-Pong Test
                    if (text === '!ping') {
                        await this.sock.sendMessage(from, { text: 'pong' });
                        continue;
                    }

                    // CRM INTEGRATION - Keeping logic simple
                    if (text.toLowerCase().includes('precio') || text.toLowerCase().includes('información')) {
                        const leadData = {
                            name: msg.pushName || 'Unknown User',
                            phone: from.replace('@s.whatsapp.net', ''),
                            query: text,
                            source: 'WhatsApp SaaS'
                        };
                        await this.sendToCRM(leadData);
                    }

                    // AI AUTO-RESPONSE (All Messages)
                    try {
                        const aiRouter = require('./aiRouter');

                        const systemPrompt = `Eres un asistente virtual de Career Mastery Engine, una plataforma de preparación para entrevistas laborales y optimización de CVs.

Tu rol es:
- Ayudar a usuarios con información sobre visas de trabajo
- Responder preguntas sobre preparación de entrevistas
- Explicar cómo mejorar CVs para sistemas ATS
- Ser amigable, profesional y conciso (máximo 2-3 líneas por respuesta)

Si te preguntan por precios o planes, menciona que tenemos planes freemium y premium.`;

                        const response = await aiRouter.chat(
                            [{ role: 'user', content: text }],
                            { llm: 'gpt-4o' },
                            systemPrompt
                        );

                        const replyText = response.text || "Lo siento, no pude procesar tu mensaje.";

                        await this.sock.sendMessage(from, { text: replyText });
                        this.log(`REPLIED to ${from}: ${replyText.substring(0, 30)}...`);

                    } catch (aiError) {
                        this.log(`AI Response Error: ${aiError.message}`, 'error');
                        // Fallback response
                        await this.sock.sendMessage(from, {
                            text: "Gracias por tu mensaje. Un asesor te responderá pronto."
                        });
                    }
                }
            });

        } catch (fatalErr) {
            this.lastError = fatalErr.message;
            this.log(`FATAL INIT ERROR: ${fatalErr.message}`, 'error');
        }
    }

    async clearSession() {
        this.log("⚠️ WIPING SESSION DATA...");

        try {
            // 1. Wipe Local Files (Priority for MultiFileAuthState)
            const fs = require('fs');
            const path = require('path');
            const authPath = path.resolve('auth_info_baileys');

            if (fs.existsSync(authPath)) {
                fs.rmSync(authPath, { recursive: true, force: true });
                this.log("✅ Local auth folder deleted.");
            } else {
                this.log("ℹ️ Local auth folder not found (Clean).");
            }

            // 2. Wipe DB (Optional fallback if we switch back)
            // const { error } = await supabase.from('whatsapp_sessions').delete().neq('session_id', 'CHECK');

            this.status = 'DISCONNECTED';
            this.pairingCode = null;
            this.lastInitTime = 0; // Reset throttle
            this.phoneNumber = null;

            if (this.sock) {
                try {
                    this.sock.end(undefined);
                } catch (e) {
                    console.error("Error closing socket during wipe:", e);
                }
                this.sock = null;
            }

            this.log("✅ SESSION STATE CLEARED. Ready to re-pair.");
            return true;
        } catch (error) {
            this.log(`❌ Failed to wipe session: ${error.message}`, 'error');
            return false;
        }
    }

    async sendToCRM(leadData) {
        const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
        if (!CRM_WEBHOOK_URL) {
            this.log("⚠️ CRM Webhook not configured.", 'warn');
            return;
        }

        try {
            const axios = require('axios');
            this.log(`🚀 Sending Lead to CRM: ${leadData.name}`);

            await axios.post(CRM_WEBHOOK_URL, {
                fields: {
                    TITLE: `Lead WhatsApp: ${leadData.name}`,
                    NAME: leadData.name,
                    PHONE: [{ "VALUE": leadData.phone, "VALUE_TYPE": "WORK" }],
                    COMMENTS: leadData.query,
                    SOURCE_ID: "WHATSAPP"
                }
            });
            this.log("✅ Lead synced to CRM!");
        } catch (error) {
            this.lastError = error.message;
            this.log(`❌ Failed to sync to CRM: ${error.message}`, 'error');
        }
    }

    getStatus() {
        return {
            status: this.status,
            qr: this.qrCodeUrl,
            pairingCode: this.pairingCode,
            phoneNumber: this.phoneNumber,
            last_error: this.lastError,
            logs: this.logs // Expose logs
        };
    }
}

module.exports = new WhatsAppService();
