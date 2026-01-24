require('dotenv').config();
const axios = require('axios');

const fixConnection = async () => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const version = process.env.WHATSAPP_API_VERSION || 'v18.0';

    if (!token || !phoneNumberId) {
        console.error('❌ Faltan credenciales en .env');
        return;
    }

    console.log(`🕵️ Diagnosticar conexión para Teléfono ID: ${phoneNumberId}`);

    try {
        // 1. Obtener ID de la Cuenta de WhatsApp Business (WABA)
        console.log('1️⃣ Obteniendo ID de Cuenta de Negocio (WABA)...');
        const phoneData = await axios.get(
            `https://graph.facebook.com/${version}/${phoneNumberId}?fields=id,whatsapp_business_account`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const wabaId = phoneData.data.whatsapp_business_account?.id;

        if (!wabaId) {
            console.error('❌ No se encontró WABA ID linked to this phone number.');
            return;
        }
        console.log(`   ✅ WABA ID encontrado: ${wabaId}`);

        // 2. Verificar o Suscribir la App a la WABA
        console.log('2️⃣ Verificando suscripción de la App a la WABA...');

        // Intentamos suscribir directamente (es idempotente, si ya está, no pasa nada)
        const subscribeResponse = await axios.post(
            `https://graph.facebook.com/${version}/${wabaId}/subscribed_apps`,
            {},
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (subscribeResponse.data && subscribeResponse.data.success) {
            console.log('   ✅ ¡Suscripción confirmada/reparada Exitosamente!');
            console.log('   🚀 Meta ahora debería enviar los mensajes a tu Webhook.');
        } else {
            console.log('   ⚠️ Respuesta inesperada:', subscribeResponse.data);
        }

    } catch (error) {
        console.error('❌ Error en el diagnóstico:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        console.log('\n💡 Tip: Si el error es de permisos, verifica que el Token tenga permisos "whatsapp_business_management".');
    }
};

fixConnection();
