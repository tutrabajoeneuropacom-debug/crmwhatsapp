require('dotenv').config();
const whatsappService = require('./services/whatsappClient');

console.log("🔍 Inciando depuración de Baileys...");

// Aumentar el nivel de log
whatsappService.log = (msg, type = 'info') => {
    console.log(`[DEBUG-LOG] [${type}] ${msg}`);
};

// Monitorear eventos de socket emitidos (mockeando io)
const mockIo = {
    emit: (event, data) => {
        console.log(`[SOCKET-EMIT] Event: ${event}, Data:`, data);
    }
};

whatsappService.setSocket(mockIo);

console.log("⏳ Esperando eventos de Baileys (60 segundos)...");

setTimeout(() => {
    const status = whatsappService.getStatus();
    console.log("📊 Estado final del servicio:", JSON.stringify(status, null, 2));
    process.exit(0);
}, 60000);
