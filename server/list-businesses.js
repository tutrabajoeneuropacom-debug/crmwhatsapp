require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

async function listBusinesses() {
    console.log('🏢 Buscando negocios asociados al token...');

    try {
        const url = `https://graph.facebook.com/v18.0/me/businesses`;
        const response = await axios.get(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });

        console.log('Result:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

listBusinesses();
