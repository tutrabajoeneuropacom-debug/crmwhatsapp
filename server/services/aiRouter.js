// aiRouter.js: Logic for AI Routing and Multi-Provider Fallbacks
const axios = require('axios');
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');
const personas = require('../config/personas');

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '').replace(/["']/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);

// Timeouts
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS) || 15000;
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS) || 25000;
const DEEPSEEK_TIMEOUT_MS = parseInt(process.env.DEEPSEEK_TIMEOUT_MS) || 15000;

/**
 * Main AI Router: 
 * Tries Gemini -> OpenAI -> DeepSeek -> Alex-Brain (Future)
 */
async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', userId = 'default', history = []) {
    let responseText = null;
    let usageSource = 'none';
    let fallbackUsed = false;

    // 1. Get Persona Profile
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = personaKey === 'ALEX_MIGRATION' ? MIGRATION_SYSTEM_PROMPT_V1 : currentPersona.systemPrompt;

    const temperature = currentPersona.temperature || 0.7;
    const maxTokens = currentPersona.maxTokens || 500;
    const normalizedUserMsg = String(userMessage || "").trim();

    // Memory Context (Simplified for WhatsApp)
    const memoryContext = `\n[USUARIO_ID: ${userId}]`;

    // History Pre-processing
    const combinedHistory = (history || []).map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.content || h.body || h.text || "").trim() }]
    })).filter(h => h.parts[0].text.length > 0);

    console.log(`🧠 [ALEX IO] Procesando para ${userId} usando ${personaKey}.`);

    // FASE 1: GEMINI FLASH (GRATIS) - USANDO REST API ROBUSTA
    if (!responseText && GENAI_API_KEY) {
        console.log(`🔑 [ALEX AI] Validando Key (Comienza con: ${GENAI_API_KEY.substring(0, 5)}...)`);
        const endpoints = [
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GENAI_API_KEY}`,
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GENAI_API_KEY}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GENAI_API_KEY}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GENAI_API_KEY}`
        ];

        for (const url of endpoints) {
            if (responseText) break;
            try {
                let contents = [];
                let lastRole = null;

                // Gemini requires user -> model alternating
                for (const msg of (history || []).slice(-8)) {
                    let currentRole = (msg.role === 'user' || msg.role === 'model' || msg.role === 'assistant') ? (msg.role === 'assistant' ? 'model' : msg.role) : 'user';
                    const text = String(msg.content || msg.body || msg.text || "").trim();
                    if (text && currentRole !== lastRole) {
                        contents.push({ role: currentRole, parts: [{ text: text }] });
                        lastRole = currentRole;
                    }
                }

                if (contents.length > 0 && contents[0].role !== 'user') contents.shift();
                if (contents.length > 0 && contents[contents.length - 1].role !== 'model') contents.pop();

                contents.push({ role: 'user', parts: [{ text: normalizedUserMsg }] });

                const payload = {
                    contents: contents,
                    system_instruction: { parts: [{ text: systemPrompt + memoryContext }] },
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                };

                const response = await axios.post(url, payload, { timeout: GEMINI_TIMEOUT_MS });

                if (response.data.candidates && response.data.candidates[0].content) {
                    responseText = response.data.candidates[0].content.parts[0].text;
                    usageSource = 'gemini-flash';
                    console.log(`✅ [ALEX AI] Exitazo con Gemini via ${url.includes('v1beta') ? 'v1beta' : 'v1'}`);
                }
            } catch (error) {
                const errorData = error.response?.data?.error || {};
                console.warn(`⚠️ [ALEX AI] Gemini URL fallida: ${url.split('models/')[1].split(':')[0]} | ${errorData.message || error.message}`);
                if (error.response?.status === 429) break;
            }
        }
    }

    // FASE 2: OPENAI GPT-4o-mini (FALLBACK)
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("🔄 [ALEX IO] Fallback a OpenAI...");
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt + memoryContext },
                    ...(history || []).slice(-10).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.content || h.body || h.text || "") })),
                    { role: "user", content: normalizedUserMsg }
                ],
                temperature,
                max_tokens: maxTokens
            }, {
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                timeout: OPENAI_TIMEOUT_MS
            });
            responseText = res.data.choices[0].message.content;
            usageSource = 'openai-mini';
        } catch (oaError) {
            console.error("❌ OpenAI falló:", oaError.message);
            fallbackUsed = true;
        }
    }

    // FASE 3: DEEPSEEK (FALLBACK)
    if (!responseText && DEEPSEEK_API_KEY) {
        try {
            console.log("🔄 [ALEX IO] Fallback a DeepSeek...");
            const res = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt + memoryContext },
                    ...(history || []).slice(-10).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.content || h.body || h.text || "") })),
                    { role: "user", content: normalizedUserMsg }
                ],
                temperature,
                max_tokens: maxTokens
            }, {
                headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
                timeout: DEEPSEEK_TIMEOUT_MS
            });
            responseText = res.data.choices[0].message.content;
            usageSource = 'deepseek';
        } catch (dsError) {
            console.error("❌ DeepSeek falló:", dsError.message);
            fallbackUsed = true;
        }
    }

    // FINAL EMERGENCY FALLBACK
    let finalResponse = (responseText || "Hola, soy ALEX. Mi cerebro principal está en mantenimiento, pero puedo ayudarte con tu diagnóstico. ¿Podrías decirme cuántos años de experiencia tienes?").replace(/Alexandra/g, 'ALEX');

    // Stats for Dashboard
    const metrics = {
        tokens: { total: 0 },
        cost: 0,
        responseTime: 0
    };

    return {
        response: finalResponse,
        source: usageSource,
        tier: 'free/fallback',
        metrics,
        fallback: fallbackUsed
    };
}

module.exports = {
    generateResponse
};
