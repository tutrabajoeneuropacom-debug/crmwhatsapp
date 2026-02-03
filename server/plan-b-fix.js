require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v18.0';

// CHANGE: Use WABA ID if Phone ID fails, but usually subscribed_apps is on WABA
// Let's try to send a Template Message (Qwen/Claude Recommendation)
// This "opens" the conversation window.

async function sendTemplateAndSubscribe() {
    const RECIPIENT = '5491160103049'; // Tu número

    console.log(`🚀 Iniciando "Rompehielos" con ${RECIPIENT}...`);

    try {
        // 1. Send Hello World Template
        const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

        const payload = {
            messaging_product: "whatsapp",
            to: RECIPIENT,
            type: "template",
            template: {
                name: "hello_world",
                language: { code: "en_US" }
            }
        };

        console.log('📨 Enviando plantilla hello_world...');
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Plantilla Enviada:', JSON.stringify(response.data, null, 2));
        console.log('\n⚠️ IMPORTANTE: Revisa tu WhatsApp AHORA.');
        console.log('👉 Debes haber recibido un "Hello World".');
        console.log('👉 RESPONDE A ESE MENSAJE con "Hola".');
        console.log('👉 Eso debería disparar el webhook al servidor.');

    } catch (error) {
        console.error('❌ Error enviando plantilla:', error.response ? error.response.data : error.message);
    }
}

sendTemplateAndSubscribe();
