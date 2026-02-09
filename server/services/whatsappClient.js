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

                    // SESSION & ROUTING
                    try {
                        const SessionManager = require('./sessionManager');
                        const UniversalRouter = require('./UniversalRouter');

                        const userId = from.replace('@s.whatsapp.net', '');
                        const session = SessionManager.getSession(userId);

                        let replyText = "";

                        // 1. COMMANDS / MODE SWITCHING
                        const lowerText = text.toLowerCase().trim();

                        if (lowerText === '/alex' || lowerText === 'salir') {
                            SessionManager.setMode(userId, 'ALEX');
                            replyText = "👋 Hola, soy Alex. ¿En qué puedo ayudarte hoy?";
                            await this.sock.sendMessage(from, { text: replyText });
                            continue;
                        }

                        if (lowerText === '/roleplay' || lowerText.includes('entrevista')) {
                            SessionManager.setMode(userId, 'ROLEPLAY');
                            replyText = "🎭 Modo Entrevista Activado. Envíame tu CV (texto o PDF) o dime el puesto para comenzar.";
                            await this.sock.sendMessage(from, { text: replyText });
                            continue;
                        }

                        if (lowerText === '/talkme' || lowerText.includes('idiomas')) {
                            SessionManager.setMode(userId, 'TALKME');
                            replyText = "🗣️ TalkMe Activated! Let's practice English. What topic do you like?";
                            await this.sock.sendMessage(from, { text: replyText });
                            continue;
                        }

                        // 2. ROUTING BASED ON MODE
                        this.log(`Routing message for ${userId} in mode: ${session.mode}`);

                        if (session.mode === 'ROLEPLAY') {
                            // Check context
                            const cvText = session.context.cvText || "Experiencia general en ventas y atención al cliente.";
                            const job = session.context.job || "Gerente de Ventas";

                            const systemPrompt = `
                            Eres un Reclutador Senior (Roleplay Mode).
                            Estás entrevistando a un candidato para el puesto: ${job}.
                            Su CV (resumen): ${cvText.substring(0, 500)}...
                            
                            Instrucciones:
                            - Mantén el personaje. Sé profesional.
                            - Haz UNA pregunta a la vez.
                            - Evalúa la respuesta del usuario y luego haz la siguiente pregunta.
                            - Si el usuario dice 'feedback', dame una devolución constructiva.
                            `;

                            replyText = await UniversalRouter.routeRequest('ROLEPLAY', text, systemPrompt);

                        } else if (session.mode === 'TALKME') {
                            const systemPrompt = `
                            You are TALKME, a friendly English tutor.
                            Engage in conversation with the user.
                            Correct major grammar mistakes gently, but prioritize fluency.
                            Keep responses short and encouraging.
                            `;
                            replyText = await UniversalRouter.routeRequest('TALKME', text, systemPrompt);
                        } else {
                            // Default: ALEX (Sales/Support)
                            const systemPrompt = `
                            Eres ALEX, el asistente virtual de Career Mastery Engine.
                            Tu objetivo es ayudar a los usuarios a navegar nuestros servicios:
                            1. Optimización de CV
                            2. Simulación de Entrevistas (usa el comando /roleplay)
                            3. Práctica de Idiomas (usa el comando /talkme)
                            
                            Sé breve, amigable y usa emojis.
                            `;
                            replyText = await UniversalRouter.routeRequest('ALEX', text, systemPrompt);
                        }

                        // 3. SEND REPLY
                        await this.sock.sendMessage(from, { text: replyText });
                        this.log(`REPLIED (${session.mode}): ${replyText.substring(0, 30)}...`);

                    } catch (routerError) {
                        this.log(`Router Error: ${routerError.message}`, 'error');
                        await this.sock.sendMessage(from, { text: "Lo siento, tuve un error interno. Intenta escribir 'salir' para reiniciar." });
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
