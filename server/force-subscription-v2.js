require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v18.0';

async function forceSubscription() {
    console.log('🔄 Verificando suscripción de la App al Número...');

    try {
        // 1. Check current subscriptions
        const getUrl = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/subscribed_apps`;
        const check = await axios.get(getUrl, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
        });

        console.log('📋 Estado actual:', JSON.stringify(check.data, null, 2));

        // 2. Force Subscribe (POST)
        console.log('\n🚀 Forzando suscripción (POST)...');
        const postUrl = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/subscribed_apps`;

        const subscribe = await axios.post(postUrl, {}, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
        });

        console.log('✅ Suscripción EXITOSA:', JSON.stringify(subscribe.data, null, 2));
        console.log('👉 Ahora Meta debería enviar los webhooks.');

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

forceSubscription();
