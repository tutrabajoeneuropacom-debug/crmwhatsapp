require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

async function findResources() {
    console.log('🕵️‍♂️ Buscando recursos accesibles con el Token actual...');

    try {
        // 1. Check Businesses this user belongs to
        console.log('\n--- Negocios (Business Managers) ---');
        const businesses = await axios.get(`https://graph.facebook.com/v18.0/me/businesses`, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
        });
        console.log(JSON.stringify(businesses.data, null, 2));

        if (businesses.data.data.length > 0) {
            const bizId = businesses.data.data[0].id;
            console.log(`\n--- Buscando Números en el Negocio ${bizId} ---`);
            // This endpoint might require system user token, but worth a shot if user is admin
            try {
                const nums = await axios.get(`https://graph.facebook.com/v18.0/${bizId}/phone_numbers`, {
                    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
                });
                console.log(JSON.stringify(nums.data, null, 2));
            } catch (e) { console.log('❌ No se pueden leer números directamente del negocio (posible falta de permisos).'); }
        }

        // 2. Check Ad Accounts or other entities might hint at structure
        // 3. Check WABA directly if we guessed the ID (we have it from screenshot)
        const WABA_ID = '3927349234066709';
        console.log(`\n--- Intentando leer WABA ${WABA_ID} ---`);
        try {
            const waba = await axios.get(`https://graph.facebook.com/v18.0/${WABA_ID}`, {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
            });
            console.log('✅ WABA Accedida:', JSON.stringify(waba.data, null, 2));

            // If we can see WABA, let's see phones
            const wabaNums = await axios.get(`https://graph.facebook.com/v18.0/${WABA_ID}/phone_numbers`, {
                headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
            });
            console.log('📱 Números en WABA:', JSON.stringify(wabaNums.data, null, 2));

        } catch (e) {
            console.log('❌ Falló acceso a WABA especifica:', e.response?.data?.error?.message || e.message);
        }

    } catch (error) {
        console.error('❌ Error General:', error.response ? error.response.data : error.message);
    }
}

findResources();
