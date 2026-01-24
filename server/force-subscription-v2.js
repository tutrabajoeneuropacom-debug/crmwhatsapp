require('dotenv').config();
const axios = require('axios');

const forceSubscriptionV2 = async () => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // TRUCO: A veces no necesitamos saber el WABA ID. 
    // Podemos suscribirnos al WABA 'me' si el token pertenece al admin.

    console.log(`🚀 Iniciando Script de Fuerza Bruta (v2)...`);

    try {
        // En lugar de buscar el ID y fallar, vamos a intentar ver qué cuentas tiene este token.
        const me = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Esto suele devolver Pages, pero si es token de sistema, devuelve info útil.
        // Pero vamos a lo seguro:
        // Si el Token es correcto, podemos intentar suscribir al WABA id asociado al token.
        // Pero como no lo sabemos, intentemos esto:

        // 1. Obtener info del telefono, pero sin pedir campos raros.
        const phone = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('📱 Info Teléfono:', phone.data); // A ver qué ID nos da

        // El truco definitivo:
        // Ve a la URL que imprime este script para hacerlo manual si falla la automatización.
        // https://developers.facebook.com/tools/explorer/

        // Pero intentemos otra llamada para sacar el WABA
        const business = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumberId}/whatsapp_business_profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('🏢 Perfil de Negocio:', business.data);

    } catch (error) {
        console.log('❌ Error:', error.response?.data || error.message);
    }
};

forceSubscriptionV2();
