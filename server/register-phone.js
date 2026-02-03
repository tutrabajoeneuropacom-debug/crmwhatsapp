require('dotenv').config();
const axios = require('axios');

const registerPhone = async () => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const version = process.env.WHATSAPP_API_VERSION || 'v18.0';

    if (!token || !phoneNumberId) {
        console.error('❌ Faltan credenciales en .env');
        return;
    }

    console.log(`🔧 Intentando registrar el número con ID: ${phoneNumberId}...`);

    try {
        const response = await axios.post(
            `https://graph.facebook.com/${version}/${phoneNumberId}/register`,
            {
                messaging_product: 'whatsapp',
                pin: '123456' // PIN por defecto para intentar el registro
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ ¡Registro exitoso!', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error en el registro:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);

        // Pista adicional si falla
        if (error.response?.data?.error?.code === 133010) {
            console.log('\n💡 Pista: Este error suele indicar que el número no está verificado o falta un paso en el panel de Meta.');
        }
    }
};

registerPhone();
