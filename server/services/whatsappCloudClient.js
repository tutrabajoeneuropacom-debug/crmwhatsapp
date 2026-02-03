const axios = require('axios');

class WhatsAppCloudService {
    constructor() {
        this.token = process.env.WHATSAPP_CLOUD_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_ID; // From Meta App
        this.io = null; // Socket.io for frontend logs
    }

    setSocket(io) {
        this.io = io;
    }

    // Send a text message
    async sendMessage(to, text) {
        if (!this.token || !this.phoneNumberId) {
            console.error("❌ ERROR: WhatsApp Cloud API Credentials missing (TOKEN or PHONE_ID).");
            return;
        }

        try {
            const url = `https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`;
            await axios.post(
                url,
                {
                    messaging_product: "whatsapp",
                    to: to,
                    text: { body: text },
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        "Content-Type": "application/json",
                    },
                }
            );
            console.log(`✅ Message sent to ${to}`);
        } catch (error) {
            console.error("❌ Failed to send WhatsApp message:", error.response?.data || error.message);
        }
    }

    // Process Incoming Webhook
    async processWebhook(body) {
        console.log("📨 Processing Webhook...");

        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
                const from = body.entry[0].changes[0].value.messages[0].from; // sender phone number
                const msg_body = body.entry[0].changes[0].value.messages[0].text.body; // msg text
                const name = body.entry[0].changes[0].value.contacts[0].profile.name;

                console.log(`📩 Message from ${from} (${name}): ${msg_body}`);

                // 1. Emit to Frontend (Command Center)
                if (this.io) {
                    this.io.emit('wa_log', {
                        from: from,
                        body: msg_body,
                        timestamp: new Date()
                    });
                }

                // 2. Ping-Pong Test
                if (msg_body.toLowerCase() === '!ping') {
                    await this.sendMessage(from, "pong (Cloud API ☁️)");
                }

                // 3. CRM Integration
                if (msg_body.toLowerCase().includes('precio') || msg_body.toLowerCase().includes('información')) {
                    await this.sendToCRM({
                        name: name,
                        phone: from,
                        query: msg_body,
                        source: 'WhatsApp Cloud API'
                    });
                }
            } else {
                console.log("ℹ️ Webhook received but no messages found (likely status update).");
            }
        }
    }

    async sendToCRM(leadData) {
        const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
        if (!CRM_WEBHOOK_URL) {
            console.log("⚠️ CRM Webhook not configured.");
            return;
        }

        try {
            console.log(`🚀 Sending Lead to CRM: ${leadData.name}`);
            await axios.post(CRM_WEBHOOK_URL, {
                fields: {
                    TITLE: `Lead WhatsApp Cloud: ${leadData.name}`,
                    NAME: leadData.name,
                    PHONE: [{ "VALUE": leadData.phone, "VALUE_TYPE": "WORK" }],
                    COMMENTS: leadData.query,
                    SOURCE_ID: "WHATSAPP_CLOUD"
                }
            });
            console.log("✅ Lead synced to CRM!");
        } catch (error) {
            console.error("❌ Failed to sync to CRM:", error.message);
        }
    }
}

module.exports = new WhatsAppCloudService();
