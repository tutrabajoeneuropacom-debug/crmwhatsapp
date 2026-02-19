// aiRouter.js for WhatsApp Bot (CommonJS) - V6.9 ULTRA STABLE
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');
const personas = require('../config/personas');

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '').replace(/["']/g, '');
const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);

const GEMINI_TIMEOUT = 15000;

async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', userId = 'default', history = []) {
    let responseText = null;
    let usageSource = 'none';

    // Persona & Prompt Setup
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = personaKey === 'ALEX_MIGRATION' ? MIGRATION_SYSTEM_PROMPT_V1 : currentPersona.systemPrompt;
    systemPrompt = `Eres ALEX, asesor estratégico jefe. IMPORTANTE: Sigue tu estructura de diagnósticos.\n\n${systemPrompt}`;

    const normalizedUserMsg = String(userMessage || "").trim();

    // 0. DIAGNOSTIC LOG (Crucial to verify Key)
    if (GENAI_API_KEY) {
        console.log(`🔑 [ALEX AI] Diagnóstico de Key: Starts with "${GENAI_API_KEY.substring(0, 6)}" | Total Length: ${GENAI_API_KEY.length}`);
    }

    // 1. INTENTO GEMINI (SDK + REST FALLBACK)
    if (GENAI_API_KEY && GENAI_API_KEY.length > 30) {
        const modelNames = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"];

        for (const modelName of modelNames) {
            if (responseText) break;
            try {
                console.log(`🤖 [ALEX AI] Probando modelo: ${modelName}...`);

                // Intento vía REST (Más compatible en Render)
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GENAI_API_KEY}`;

                let contents = [];
                let lastRole = null;
                for (const msg of (history || []).slice(-6)) {
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

                const payload = {
                    contents,
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                };

                const response = await axios.post(url, payload, { timeout: GEMINI_TIMEOUT });
                if (response.data.candidates?.[0]?.content) {
                    responseText = response.data.candidates[0].content.parts[0].text;
                    usageSource = `gemini-${modelName}`;
                    console.log(`✅ [ALEX AI] ÉXITO con ${modelName}`);
                    break;
                }
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.message;
                console.warn(`⚠️ [ALEX AI] Falló ${modelName}: ${errMsg.substring(0, 80)}`);
            }
        }
    }

    // 2. FALLBACK OPENAI (Only if Gemini fails)
    if (!responseText && OPENAI_API_KEY && OPENAI_API_KEY.length > 10) {
        try {
            console.log("🔄 [ALEX AI] Fallback a OpenAI...");
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...(history || []).slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                    { role: "user", content: normalizedUserMsg }
                ]
            }, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, timeout: 15000 });
            responseText = res.data.choices[0].message.content;
            usageSource = 'openai-mini';
        } catch (e) {
            console.error("❌ OpenAI Fail:", e.message);
        }
    }

    // 3. FALLBACK DEEPSEEK
    if (!responseText && DEEPSEEK_API_KEY && DEEPSEEK_API_KEY.length > 10) {
        try {
            console.log("🔄 [ALEX AI] Fallback a DeepSeek...");
            const res = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...history.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                    { role: "user", content: normalizedUserMsg }
                ]
            }, { headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` }, timeout: 15000 });
            responseText = res.data.choices[0].message.content;
            usageSource = 'deepseek';
        } catch (e) { console.error("❌ DeepSeek Fail"); }
    }

    // FINAL RESPONSE (Friendly fallback instead of error loop)
    const finalResponse = (responseText || "Hola, soy ALEX. Mi conexión está un poco saturada, pero sigo aquí para tu diagnóstico migratorio. ¿Podrías repetirme cuántos años de experiencia tienes?").replace(/Alexandra/g, 'ALEX');

    return {
        response: finalResponse,
        source: usageSource,
        tier: 'stable-v6.9',
        metrics: { tokens: { total: 0 }, cost: 0, responseTime: 0 },
        fallback: !responseText
    };
}

module.exports = { generateResponse };
