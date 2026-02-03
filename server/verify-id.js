const axios = require('axios');
require('dotenv').config();

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

console.log(`🔍 Verificando Phone ID: ${PHONE_ID}`);

async function verify() {
    try {
        const url = `https://graph.facebook.com/v18.0/${PHONE_ID}`;
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        console.log('✅ ID Válido! Datos:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ Error verificando ID:', error.response ? error.response.data : error.message);
    }
}

verify();
