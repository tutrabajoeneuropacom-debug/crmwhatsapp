require('dotenv').config();
const whatsappCloudAPI = require('./services/whatsappCloudAPI');

const MY_NUMBER = '5491136427300'; // Tu numero personal (donde recibes)

async function sendHello() {
    console.log('📤 Enviando mensaje de prueba a:', MY_NUMBER);
    try {
        await whatsappCloudAPI.sendMessage(MY_NUMBER, "¡Hola! Soy Cooper. Mi cerebro ha sido reiniciado con el nuevo token. Si lees esto, la salida funciona. ¿Me lees?");
        console.log('✅ Mensaje enviado con éxito.');
    } catch (error) {
        console.error('❌ Error al enviar:', error.response ? error.response.data : error.message);
    }
}

sendHello();
