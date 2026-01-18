const { makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const useSupabaseAuthState = require('./supabaseAuthState');
const { createClient } = require('@supabase/supabase-js');

// Initialize internal Supabase Admin for Session Storage
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.status = 'DISCONNECTED';
        this.qrCodeUrl = null;
        this.io = null;
        // Don't init immediately, wait for setSocket
    }

    setSocket(io) {
        this.io = io;
        this.initializeClient();
    }

    async initializeClient() {
        console.log("Initializing WhatsApp Client (Baileys + Supabase Persistence)...");

        // Auth management via Supabase
        const { state, saveCreds } = await useSupabaseAuthState(supabase);

        this.sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ["TalkMe AI", "Chrome", "1.0.0"],
            connectTimeoutMs: 60000,
        });

        // Connection Update Handler
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log('QR RECEIVED');
                this.qrCodeUrl = qr; // Baileys gives raw string
                this.status = 'QR_READY';
                if (this.io) this.io.emit('wa_qr', { qr });
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('Connection closed. Reconnecting?: ', shouldReconnect);
                this.status = 'DISCONNECTED';
                if (shouldReconnect) {
                    this.initializeClient();
                } else {
                    console.log('Logged out. Delete auth folder to restart.');
                }
                if (this.io) this.io.emit('wa_status', { status: 'DISCONNECTED' });
            } else if (connection === 'open') {
                console.log('WHATSAPP CLIENT IS READY!');
                this.status = 'READY';
                this.qrCodeUrl = null;
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
                console.log('MESSAGE RECEIVED:', text, 'FROM:', from);

                if (this.io) this.io.emit('wa_log', {
                    from: from.replace('@s.whatsapp.net', ''),
                    body: text,
                    timestamp: new Date()
                });

                if (isMe) continue; // Don't reply to self

                // Ping-Pong Test
                if (text === '!ping') {
                    await this.sock.sendMessage(from, { text: 'pong' });
                }

                // CRM INTEGRATION
                if (text.toLowerCase().includes('precio') || text.toLowerCase().includes('información')) {
                    const leadData = {
                        name: msg.pushName || 'Unknown User',
                        phone: from.replace('@s.whatsapp.net', ''),
                        query: text,
                        source: 'WhatsApp SaaS'
                    };
                    await this.sendToCRM(leadData);
                }
            }
        });
    }

    async sendToCRM(leadData) {
        const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
        if (!CRM_WEBHOOK_URL) {
            console.log("⚠️ CRM Webhook not configured.");
            return;
        }

        try {
            const axios = require('axios');
            console.log(`🚀 Sending Lead to CRM: ${leadData.name}`);

            await axios.post(CRM_WEBHOOK_URL, {
                fields: {
                    TITLE: `Lead WhatsApp: ${leadData.name}`,
                    NAME: leadData.name,
                    PHONE: [{ "VALUE": leadData.phone, "VALUE_TYPE": "WORK" }],
                    COMMENTS: leadData.query,
                    SOURCE_ID: "WHATSAPP"
                }
            });
            console.log("✅ Lead synced to CRM!");
        } catch (error) {
            console.error("❌ Failed to sync to CRM:", error.message);
        }
    }

    getStatus() {
        return {
            status: this.status,
            qr: this.qrCodeUrl
        };
    }
}

module.exports = new WhatsAppService();
