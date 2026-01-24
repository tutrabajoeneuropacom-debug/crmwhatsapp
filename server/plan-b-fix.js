require('dotenv').config();
const axios = require('axios');

const fixSubscriptionManual = async () => {
    // ID DE TU CUENTA COMERCIAL (WABA ID)
    // Lo sacamos de la captura anterior o intentamos deducirlo, 
    // pero para asegurar usaremos el que aparece en la metadata de tu número si es posible.
    // Si falla, te pediré que lo copies del panel.

    // INTENTO 1: Obtener WABA ID desde el Phone Number ID
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    console.log('🕵️ Iniciando Plan B de Reparación...');

    try {
        // En v18+, el campo whatsapp_business_account a veces no viene directo.
        // Vamos a probar suscribir la App a la WABA directamente si la encontramos.

        console.log('1️⃣ Buscando ID de Cuenta Comercial (WABA)...');
        // Usamos una llamada más simple para ver si tenemos acceso
        const me = await axios.get(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // A veces el ID de WABA no es visible directamente, probemos un truco:
        // Suscribir el propio PhoneNumberId (algunas versiones lo permiten)
        // O mejor: Listar las WABAs del usuario y usar la primera.

        const wabaList = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Esto suele listar páginas, no WABAs. Las WABAs están en /me/businesses (si tienes permisos)
        // O en el token debug.

        // ESTRATEGIA DEFINITIVA: 
        // Si no podemos obtener el WABA ID por API fácil, te pediré que lo mires en la URL.
        // Pero intentemos suscribir al Webhook directamente en la configuración de la App (que es lo que falta).

        console.log('⚠️ No puedo obtener el WABA ID automáticamente con este Token.');
        console.log('👉 Por favor, ve a este enlace para activar el Webhook manualmente:');
        console.log('   https://developers.facebook.com/apps/');
        console.log('   (Selecciona tu App > WhatsApp > Configuración > Webhook > Edit > Subscribe)');

    } catch (e) {
        console.log('❌ Error:', e.message);
    }
};

// Plan B Simplificado: Instrucciones claras porque la API de Meta es quisquillosa con permisos de tokens temporales.
// Pero espera, tengo un truco más.
// Vamos a usar el debug_token para sacar el WABA ID.

const debugAndFix = async () => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;

    try {
        const debug = await axios.get(`https://graph.facebook.com/v18.0/debug_token`, {
            params: { input_token: token, access_token: token } // Yes, send token as access_token too
        });

        const data = debug.data.data;
        console.log('🔍 Token Info:', {
            app_id: data.app_id,
            is_valid: data.is_valid,
            scopes: data.scopes
        });

        // Intentar suscribir usando el App ID (a veces funciona al revés)
        // No, la suscripción es WABA -> App.

    } catch (e) {
        console.log('❌ Debug falló:', e.message);
    }
}

fixSubscriptionManual();
