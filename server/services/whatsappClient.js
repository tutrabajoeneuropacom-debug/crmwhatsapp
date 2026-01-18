const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

class WhatsAppService {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth({ dataPath: './whatsapp_auth' }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
                ],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
            }
        });

        this.qrCodeUrl = null;
        this.status = 'DISCONNECTED'; // DISCONNECTED, QR_READY, READY
        this.io = null; // Socket.io instance

        this.initializeClient();
    }

    setSocket(io) {
        this.io = io;
    }

    initializeClient() {
        console.log("Initializing WhatsApp Client...");

        this.client.on('qr', async (qr) => {
            console.log('QR RECEIVED', qr);
            this.qrCodeUrl = qr; // Raw QR string for frontend to render
            this.status = 'QR_READY';
            if (this.io) this.io.emit('wa_qr', { qr });
        });

        this.client.on('ready', () => {
            console.log('WHATSAPP CLIENT IS READY!');
            this.status = 'READY';
            this.qrCodeUrl = null;
            if (this.io) this.io.emit('wa_status', { status: 'READY' });
        });

        this.client.on('message', async msg => {
            console.log('MESSAGE RECEIVED:', msg.body);
            if (msg.body === '!ping') {
                msg.reply('pong');
            }
            // Emit to frontend logger
            if (this.io) this.io.emit('wa_log', {
                from: msg.from,
                body: msg.body,
                timestamp: new Date()
            });

            // CRM INTEGRATION HOOK (Bitrix24 / Zapier)
            if (msg.body.toLowerCase().includes('precio') || msg.body.toLowerCase().includes('información')) {
                const leadData = {
                    name: msg._data?.notifyName || 'Unknown User',
                    phone: msg.from.replace('@c.us', ''),
                    query: msg.body,
                    source: 'WhatsApp SaaS'
                };
                await this.sendToCRM(leadData);
            }
        });

        this.client.on('authenticated', () => {
            console.log('AUTHENTICATED');
        });

        this.client.initialize();
    }

    async sendToCRM(leadData) {
        // Check if Webhook URL is configured
        const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
        if (!CRM_WEBHOOK_URL) {
            console.log("⚠️ CRM Webhook not configured. Skipping sync.", leadData);
            return;
        }

        try {
            const axios = require('axios');
            console.log(`🚀 Sending Lead to CRM: ${leadData.name}`);

            // Bitrix24 Inbound Webhook Format (Example)
            // https://your-domain.bitrix24.com/rest/1/webhook_token/crm.lead.add.json
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
