require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const MYSTERY_ID = '826834483710532'; // From Debug Token

async function investigateMysteryObject() {
    console.log(`🕵️‍♂️ Investigando el objeto: ${MYSTERY_ID}`);

    try {
        // 1. What is it?
        const info = await axios.get(`https://graph.facebook.com/v18.0/${MYSTERY_ID}`, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
        });
        console.log('📦 Info del Objeto:', JSON.stringify(info.data, null, 2));

        // 2. Is it a Business? Let's check owned phone numbers
        try {
            const phones = await axios.get(`https://graph.facebook.com/v18.0/${MYSTERY_ID}/phone_numbers`, {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
            });
            console.log('📱 Teléfonos dentro:', JSON.stringify(phones.data, null, 2));
        } catch (e) {
            console.log('❌ No es un negocio o no tiene teléfonos leíbles.');
        }

        // 3. Is it a WABA?
        try {
            // WABA endpoint is just GET /<WABA_ID> which we did in step 1, but let's check specifically for message_templates to confirm
            const templates = await axios.get(`https://graph.facebook.com/v18.0/${MYSTERY_ID}/message_templates`, {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
            });
            console.log('📜 Plantillas (Confirmado WABA):', templates.data.data.length);
        } catch (e) { /* Not a WABA */ }

    } catch (error) {
        console.error('❌ Error fatal:', error.response ? error.response.data : error.message);
    }
}

investigateMysteryObject();
