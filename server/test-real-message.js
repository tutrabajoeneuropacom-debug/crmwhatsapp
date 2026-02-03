require('dotenv').config();
const whatsappClient = require('./services/whatsappCloudAPI');

const main = async () => {
    // Recipient phone number (Standard format: 549 + Area Code + Number for Argentina Mobile)
    const recipient = '5491160103049';

    console.log(`🚀 Enviando mensaje de prueba a: ${recipient}...`);
    console.log(`📱 Desde ID: ${whatsappClient.phoneNumberId}`);

    try {
        // Enviar Ping simple
        const response = await whatsappClient.sendMessage(recipient, "🔔 Ping de verificación de Token. Si lees esto, tus credenciales locales funcionan.");
        console.log('✅ Mensaje enviado con éxito:', JSON.stringify(response, null, 2));
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error.response ? error.response.data : error.message);
    }
};

main();
