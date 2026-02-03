require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID = '956780224186740';

async function verifyOwnership() {
    console.log(`🕵️‍♂️ Verificando acceso al Teléfono ID: ${PHONE_ID}`);

    try {
        // Intenta obtener detalles de ESTE número específico
        const url = `https://graph.facebook.com/v18.0/${PHONE_ID}`;
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
        });

        console.log('✅ ¡ÉXITO! El Token TIENE acceso a este número.');
        console.log('Datos:', JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error('❌ FALLÓ: El Token NO sirve para este número.');
        console.error('Error:', error.response ? error.response.data : error.message);

        console.log('\n--- DIAGNÓSTICO ---');
        console.log('1. El Token que copiaste pertenece a UNA App.');
        console.log('2. El ID de teléfono pertenece a OTRA App (o cuenta comercial).');
        console.log('3. Solución: Asegúrate de estar en la MISMA pestaña del navegador donde copiaste el token.');
    }
}

verifyOwnership();
