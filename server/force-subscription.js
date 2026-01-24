require('dotenv').config();
const axios = require('axios');

const forceSubscription = async () => {
    // Usamos las credenciales de .env
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const version = 'v18.0'; // Usamos v18 explícitamente

    console.log(`🚀 Iniciando Script de Fuerza Bruta para Suscripción...`);
    console.log(`📱 Phone ID: ${phoneNumberId}`);

    if (!token || !phoneNumberId) {
        console.error('❌ Faltan credenciales.');
        return;
    }

    try {
        // PASO 1: Obtener el ID de la cuenta comercial (WABA) que posee este número
        console.log('1️⃣  Buscando ID de Cuenta Comercial (WABA)...');
        const phoneResp = await axios.get(
            `https://graph.facebook.com/${version}/${phoneNumberId}?fields=whatsapp_business_account`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const wabaId = phoneResp.data.whatsapp_business_account?.id;

        if (!wabaId) {
            console.error('❌ No se pudo encontrar el WABA ID. El token podría no tener permisos suficientes o ser de Sandbox.');
            console.log('Datos recibidos:', JSON.stringify(phoneResp.data, null, 2));
            return;
        }
        console.log(`   ✅ WABA ID detectado: ${wabaId}`);

        // PASO 2: Suscribir la App a esa WABA
        console.log(`2️⃣  Forzando suscripción de la App a la WABA: ${wabaId}...`);

        const subResp = await axios.post(
            `https://graph.facebook.com/${version}/${wabaId}/subscribed_apps`,
            {}, // Cuerpo vacío
            { headers: { Authorization: `Bearer ${token}` } }
        );

        if (subResp.data && subResp.data.success) {
            console.log('\n🎉 ¡ÉXITO TOTAL! 🎉');
            console.log('✅ La App se ha suscrito correctamente a las notificaciones del negocio.');
            console.log('👉 PRUEBA AHORA ENVIAR "HOLA" AL BOT.');
        } else {
            console.log('⚠️ Respuesta inesperada:', subResp.data);
        }

    } catch (error) {
        console.error('\n❌ ERROR FATAL:', error.response?.data || error.message);

        if (error.response?.data?.error?.code === 200) {
            console.log('💡 Pista: Error de Permisos. El Token que usas no tiene permiso "whatsapp_business_management" O no es administrador del negocio.');
        }
    }
};

forceSubscription();
