require('dotenv').config();
const whatsappClient = require('./services/whatsappCloudAPI');

const main = async () => {
    // Recipient phone number (Standard format: 549 + Area Code + Number for Argentina Mobile)
    const recipient = '5491160103049';

    console.log(`🚀 Enviando mensaje de prueba a: ${recipient}...`);
    console.log(`📱 Desde ID: ${whatsappClient.phoneNumberId}`);

    try {
        // Now that user said "Hello", we can send free text!
        const response = await whatsappClient.sendMessage(recipient, "¡Hola Gabriel! 👋 Conexión exitosa con Puentes Globales. Soy tu Asistente de IA activo en el número oficial.");
        console.log('✅ Mensaje enviado con éxito:', JSON.stringify(response, null, 2));
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error.response ? error.response.data : error.message);
    }
};

main();
