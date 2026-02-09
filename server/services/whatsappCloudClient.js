const axios = require('axios');
const UniversalRouter = require('./UniversalRouter'); // NEW: Brain Integration

class WhatsAppCloudService {
    // ... (constructor and setSocket remain same)
    constructor() {
        this.token = process.env.WHATSAPP_CLOUD_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_ID;
        this.io = null;
    }

    setSocket(io) {
        this.io = io;
    }

    // ... (sendMessage remains same)
    async sendMessage(to, text) {
        if (!this.token || !this.phoneNumberId) {
            console.error("❌ ERROR: WhatsApp Cloud API Credentials missing.");
            return;
        }
        try {
            const url = `https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`;
            await axios.post(url,
                { messaging_product: "whatsapp", to: to, text: { body: text } },
                { headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" } }
            );
            console.log(`✅ Message sent to ${to}`);
        } catch (error) {
            console.error("❌ Failed to send WhatsApp message:", error.response?.data || error.message);
        }
    }

    // Process Incoming Webhook (UPDATED)
    async processWebhook(body) {
        if (!body.object) return;

        if (
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0] &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            const changes = body.entry[0].changes[0].value;
            const from = changes.messages[0].from;
            const msg_body = changes.messages[0].text.body;
            const name = changes.contacts[0].profile.name;

            console.log(`📩 Message from ${from} (${name}): ${msg_body}`);

            // 1. Emit Log
            if (this.io) this.io.emit('wa_log', { from, body: msg_body, timestamp: new Date() });

            // 2. Simple Command Check
            if (msg_body.toLowerCase() === '!ping') {
                return await this.sendMessage(from, "pong (Cloud API ☁️)");
            }

            // 3. ALEX AI RESPONSE (Universal Router)
            try {
                // PUENTES GLOBALES: VENTAS (ATS & TALKME)
                const salesContext = `
                ACTÚA COMO: Representante Comercial de 'Puentes Globales'.
                NOMBRE AGENTE: Alex.
                OBJETIVO: Vender nuestros 2 productos estrella de manera consultiva y profesional.

                PRODUCTO 1: ATS / OPTIMIZACIÓN DE CARRERA
                - Problema: Tu CV actual no pasa los filtros de Recursos Humanos.
                - Solución: Te damos un Escáner de CV con IA, Entrevistas Simuladas (Roleplay) y Plan de Mejora.
                - Precio: Freemium (Gratis análisis básico, Premium para reportes completos).
                - CTA: "Prueba nuestro escáner gratuito hoy".

                PRODUCTO 2: TALKME (INGLÉS CON IA)
                - Problema: No puedes practicar inglés cuando quieras y te da vergüenza hablar.
                - Solución: Chat de voz 24/7 con IA que te corrige sin juzgar. Planes de estudio personalizados diarios.
                - Precio: Mucho más barato que un profesor privado.
                - CTA: "Empieza a hablar en inglés ahora mismo".

                REGLA DE ORO:
                - Sé breve y persuasivo.
                - Si el cliente pregunta por otro tema, redírelo amablemente a estos dos productos.
                - Usa emojis profesionales 🚀💼.
                `;

                // AI Brain decides (Flash vs Pro)
                const aiResponse = await UniversalRouter.chatWithAlex(msg_body, { salesContext });

                await this.sendMessage(from, aiResponse);

            } catch (aiError) {
                console.error("❌ Alex Brain Error:", aiError);
                await this.sendMessage(from, "Lo siento, estoy reiniciando mis sistemas neuronales. Intenta de nuevo en 5 seg.");
            }

            // 4. CRM Integration (Background)
            if (msg_body.toLowerCase().includes('precio') || msg_body.toLowerCase().includes('info')) {
                this.sendToCRM({ name, phone: from, query: msg_body }).catch(e => console.error(e));
            }

        } else {
            console.log("ℹ️ Webhook received (status update or other).");
        }
    }

    // ... (sendToCRM remains same)
    async sendToCRM(leadData) {
        // ... CRM Logic (omitted for brevity in this replace block, kept in file)
        const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL;
        if (!CRM_WEBHOOK_URL) return;
        try {
            await axios.post(CRM_WEBHOOK_URL, {
                fields: {
                    TITLE: `Lead WhatsApp: ${leadData.name}`,
                    NAME: leadData.name,
                    PHONE: [{ "VALUE": leadData.phone, "VALUE_TYPE": "WORK" }],
                    COMMENTS: leadData.query
                }
            });
        } catch (e) {
            console.error("CRM Sync Error", e.message);
        }
    }
}

module.exports = new WhatsAppCloudService();
