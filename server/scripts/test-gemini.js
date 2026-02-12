require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function diagnose() {
    const key = process.env.GEMINI_API_KEY;

    // Show last 4 chars to verify if it's the NEW key
    const keySuffix = key ? key.slice(-4) : "NONE";
    console.log(`\n🔍 DIAGNÓSTICO DE LLAVE (v4)`);
    console.log(`🔑 Llave leída del .env termina en: "...${keySuffix}"`);
    console.log(`   (Tu nueva llave debería terminar en "0Cq4")`);

    if (!key) {
        console.error("❌ ERROR: .env vacío o no guardado.");
        return;
    }

    const genAI = new GoogleGenerativeAI(key);

    console.log("\n📡 Contactando a Google para ver qué modelos te permiten usar...");
    try {
        const list = await genAI.listModels();
        console.log("✅ Tu llave funciona.");
        console.log("📋 Modelos disponibles para ti:");

        const models = list.models.map(m => m.name.replace('models/', ''));
        models.forEach(m => console.log(`   - ${m}`));

        // Try Flash specifically
        const flash = models.find(m => m.includes('flash'));
        if (flash) {
            console.log(`\n✨ Probando generación con ${flash}...`);
            const model = genAI.getGenerativeModel({ model: flash });
            const result = await model.generateContent("Respond OK");
            console.log(`🎉 ÉXITO TOTAL: ${result.response.text().trim()}`);
        } else {
            console.error("\n⚠️ TU CUENTA NO TIENE ACCESO A MODELOS FLASH.");
            console.log("Intenta habilitar 'Pay-as-you-go' o verifica la región.");
        }

    } catch (err) {
        console.error("\n❌ ERROR GRAVE:");
        console.error(err.message);
        if (err.message.includes('404')) {
            console.log("\n💡 El error 404 significa que Google no reconoce el modelo para TU llave.");
            console.log("   Verifica que copiaste la llave del proyecto NUEVO.");
        }
    }
}

diagnose();