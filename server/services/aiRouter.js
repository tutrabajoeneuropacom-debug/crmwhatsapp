// aiRouter.js: V7.1 FINAL DIAGNOSTIC & ULTIMATE FALLBACK
const axios = require('axios');
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');
const personas = require('../config/personas');

// Deep Clean
const c = (k) => (k || "").trim().replace(/["']/g, '').replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GEMINI_KEY = c(process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY);
const OPENAI_KEY = c(process.env.OPENAI_API_KEY);
const DEEPSEEK_KEY = c(process.env.DEEPSEEK_API_KEY);

async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', userId = 'default', history = []) {
    let responseText = null;
    let usageSource = 'none';

    // 🔑 ULTIMATE DIAGNOSTIC
    console.log(`📡 [ALEX AI] Diagnóstico de Conexión:
       - User: ${userId}
       - Message: "${userMessage?.substring(0, 20)}..."
       - Gemini Key: ${GEMINI_KEY ? `OK (${GEMINI_KEY.substring(0, 6)}...) [LEN:${GEMINI_KEY.length}]` : 'BLOQUEADA/VACÍA'}
       - OpenAI Key: ${OPENAI_KEY ? 'OK' : 'VACÍA'}`);

    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = personaKey === 'ALEX_MIGRATION' ? MIGRATION_SYSTEM_PROMPT_V1 : currentPersona.systemPrompt;
    systemPrompt = `IDENTIDAD: Eres ALEX, asesor estratégico jefe. Habla directo y profesional.\n\n${systemPrompt}`;

    const normalizedUserMsg = String(userMessage || "").trim();

    // 1. INTENTO GEMINI (REST) - FORMATO ULTRA-COMPATIBLE
    if (GEMINI_KEY && GEMINI_KEY.length > 30) {
        const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5-flash-latest"];
        const versions = ["v1beta", "v1"];

        for (const v of versions) {
            if (responseText) break;
            for (const m of models) {
                if (responseText) break;
                try {
                    const url = `https://generativelanguage.googleapis.com/${v}/models/${m}:generateContent?key=${GEMINI_KEY}`;

                    let contents = [];
                    // Simple Prepend of System Prompt to history if history is empty
                    if ((history || []).length === 0) {
                        contents.push({ role: 'user', parts: [{ text: `INSTRUCCIONES DE SISTEMA: ${systemPrompt}\n\nMENSAJE DEL USUARIO: ${normalizedUserMsg}` }] });
                    } else {
                        // Regular history
                        let lastRole = null;
                        for (const msg of history.slice(-6)) {
                            let role = (msg.role === 'user') ? 'user' : 'model';
                            let text = String(msg.content || msg.text || "").trim();
                            if (text && role !== lastRole) {
                                contents.push({ role, parts: [{ text }] });
                                lastRole = role;
                            }
                        }
                        if (contents.length > 0 && contents[0].role !== 'user') contents.shift();
                        if (contents.length > 0 && contents[contents.length - 1].role !== 'model') contents.pop();
                        contents.push({ role: 'user', parts: [{ text: normalizedUserMsg }] });
                    }

                    const payload = {
                        contents,
                        generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                    };

                    // Only Add system_instruction if v1beta (v1 fails with it)
                    if (v === 'v1beta') {
                        payload.system_instruction = { parts: [{ text: systemPrompt }] };
                    }

                    const response = await axios.post(url, payload, { timeout: 15000 });
                    if (response.data.candidates?.[0]?.content) {
                        responseText = response.data.candidates[0].content.parts[0].text;
                        usageSource = `gemini-${m}-${v}`;
                        console.log(`✅ [ALEX AI] ÉXITO: ${m} (${v})`);
                    }
                } catch (err) {
                    const respErr = err.response?.data?.error?.message || err.message;
                    console.warn(`⚠️ [ALEX AI] Intento Fallido (${m}/${v}): ${respErr.substring(0, 50)}`);
                    if (err.response?.status === 403 || err.response?.status === 429) break; // Bloqueo de cuenta
                }
            }
        }
    }

    // 2. FALLBACK OPENAI
    if (!responseText && OPENAI_KEY) {
        try {
            console.log("🔄 [ALEX AI] Intentando Fallback OpenAI...");
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...(history || []).slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                    { role: "user", content: normalizedUserMsg }
                ]
            }, { headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }, timeout: 15000 });
            responseText = res.data.choices[0].message.content;
            usageSource = 'openai-mini';
        } catch (e) {
            console.error("❌ [ALEX AI] OpenAI Falló:", e.response?.data?.error?.message || e.message);
        }
    }

    // 3. FALLBACK DEEPSEEK
    if (!responseText && DEEPSEEK_KEY) {
        try {
            console.log("🔄 [ALEX AI] Intentando Fallback DeepSeek...");
            const res = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...(history || []).slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                    { role: "user", content: normalizedUserMsg }
                ]
            }, { headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}` }, timeout: 15000 });
            responseText = res.data.choices[0].message.content;
            usageSource = 'deepseek';
        } catch (e) { console.error("❌ [ALEX AI] DeepSeek Falló"); }
    }

    // EMERGENCY TEXT
    const emergencyResponse = "Hola, soy ALEX. Mi cerebro principal está experimentando una alta demanda. Por favor, ¿podrías repetirme cuál es tu objetivo migratorio principal? (Canada, USA, España...)";
    const finalResponse = (responseText || emergencyResponse).replace(/Alexandra/g, 'ALEX');

    return {
        response: finalResponse,
        source: usageSource,
        tier: 'v7.1',
        metrics: { tokens: { total: 0 }, cost: 0, responseTime: 0 },
        fallback: !responseText
    };
}

module.exports = { generateResponse };
