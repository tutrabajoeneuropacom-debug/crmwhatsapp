// aiRouter.js: V7.0 ULTRA-DIAGNOSTIC & MULTI-MODEL
const axios = require('axios');
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');
const personas = require('../config/personas');

// --- Deep Key Cleaning ---
const clean = (k) => (k || "").trim().replace(/["']/g, '').replace(/[\r\n\t]/g, '').replace(/\s/g, '');

// Scan for any possible name variant
const GENAI_API_KEY = clean(process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY);
const OPENAI_API_KEY = clean(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = clean(process.env.DEEPSEEK_API_KEY);

async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', userId = 'default', history = []) {
    let responseText = null;
    let usageSource = 'none';

    console.log(`🔍 [ALEX AI] Diagnóstico de Llaves: 
       - Gemini: ${GENAI_API_KEY ? `ENCONTRADA (${GENAI_API_KEY.substring(0, 6)}...)` : 'VACÍA'}
       - OpenAI: ${OPENAI_API_KEY ? 'ENCONTRADA' : 'VACÍA'}
       - DeepSeek: ${DEEPSEEK_API_KEY ? 'ENCONTRADA' : 'VACÍA'}`);

    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = personaKey === 'ALEX_MIGRATION' ? MIGRATION_SYSTEM_PROMPT_V1 : currentPersona.systemPrompt;
    systemPrompt = `Eres ALEX, asesor estratégico jefe de Puentes Globales.\n\n${systemPrompt}`;

    const normalizedUserMsg = String(userMessage || "").trim();

    // 1. INTENTO GEMINI (REST)
    if (GENAI_API_KEY && GENAI_API_KEY.length > 20) {
        const configs = [
            { ver: 'v1beta', mod: 'gemini-1.5-flash', useSys: true },
            { ver: 'v1beta', mod: 'gemini-1.5-flash-latest', useSys: true },
            { ver: 'v1', mod: 'gemini-1.5-flash', useSys: false }, // v1 is picky
            { ver: 'v1beta', mod: 'gemini-pro', useSys: true }
        ];

        for (const c of configs) {
            if (responseText) break;
            try {
                const url = `https://generativelanguage.googleapis.com/${c.ver}/models/${c.mod}:generateContent?key=${GENAI_API_KEY}`;

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
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                };

                if (c.useSys) {
                    payload.system_instruction = { parts: [{ text: systemPrompt }] };
                } else if (contents.length > 0) {
                    contents[0].parts[0].text = `INSTRUCTIONS: ${systemPrompt}\n\nUSER: ${contents[0].parts[0].text}`;
                }

                const response = await axios.post(url, payload, { timeout: 15000 });
                if (response.data.candidates?.[0]?.content) {
                    responseText = response.data.candidates[0].content.parts[0].text;
                    usageSource = `gemini-${c.mod}`;
                    console.log(`✅ [ALEX AI] Gemini Exitazo (${c.ver}/${c.mod})`);
                }
            } catch (err) {
                console.warn(`⚠️ [ALEX AI] Fail ${c.mod}: ${err.response?.data?.error?.message || err.message}`);
            }
        }
    }

    // 2. FALLBACKS
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("🔄 [ALEX AI] Fallback a OpenAI...");
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: systemPrompt }, ...history.slice(-6).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })), { role: "user", content: normalizedUserMsg }]
            }, { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, timeout: 15000 });
            responseText = res.data.choices[0].message.content;
            usageSource = 'openai-mini';
        } catch (e) { console.error("❌ OpenAI Falló"); }
    }

    // FINAL RESPONSE
    const fallbackText = "Hola, soy ALEX. Mi cerebro está en mantenimiento preventivo pero sigo aquí para ti. ¿Podrías decirme tu stack tecnológico actual?";
    return {
        response: (responseText || fallbackText).replace(/Alexandra/g, 'ALEX'),
        source: usageSource,
        tier: 'v7.0',
        metrics: { tokens: { total: 0 }, cost: 0, responseTime: 0 },
        fallback: !responseText
    };
}

module.exports = { generateResponse };
