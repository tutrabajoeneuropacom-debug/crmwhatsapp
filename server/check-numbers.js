require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = '3927349234066709'; // From user screenshot

async function checkNumbers() {
    console.log('🔍 Consultando números de teléfono en la cuenta WABA:', WABA_ID);

    try {
        const url = `https://graph.facebook.com/v18.0/${WABA_ID}/phone_numbers`;
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
        });

        console.log('📱 Números encontrados:', JSON.stringify(response.data, null, 2));

        if (response.data.data && response.data.data.length > 0) {
            console.log('\n✅ USA ESTE ID:', response.data.data[0].id);
            console.log('   (Compáralo con el que tienes en .env)');
        }

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

checkNumbers();
