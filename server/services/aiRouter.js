// aiRouter.js: V7.2 MEMORY RECOVERY & GENDER FILTER
const axios = require('axios');
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');
const personas = require('../config/personas');

const c = (k) => (k || "").trim().replace(/["']/g, '').replace(/[\r\n\t]/g, '').replace(/\s/g, '');
const GEMINI_KEY = c(process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY || process.env.GOOGLE_API_KEY);
const OPENAI_KEY = c(process.env.OPENAI_API_KEY);

async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', userId = 'default', history = []) {
    let responseText = null;
    let usageSource = 'none';

    console.log(`📡 [ALEX AI] Memoria: ${history.length} mensajes previos.`);

    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = personaKey === 'ALEX_MIGRATION' ? MIGRATION_SYSTEM_PROMPT_V1 : currentPersona.systemPrompt;

    // Hardening the Prompt for Memory and Structure
    systemPrompt = `IDENTIDAD: Eres ALEX, asesor estratégico.\nREGLA: Máximo 2 preguntas por mensaje.\nMEMORIA: Usa el historial adjunto para no repetir preguntas.\n\n${systemPrompt}`;

    const normalizedUserMsg = String(userMessage || "").trim();

    // 1. GEMINI ULTRA-STABLE PAYLOAD
    if (GEMINI_KEY && GEMINI_KEY.length > 30) {
        const configs = [
            { v: 'v1beta', m: 'gemini-1.5-flash' },
            { v: 'v1', m: 'gemini-1.5-flash' },
            { v: 'v1beta', m: 'gemini-1.5-flash-latest' }
        ];

        for (const conf of configs) {
            if (responseText) break;
            try {
                const url = `https://generativelanguage.googleapis.com/${conf.v}/models/${conf.m}:generateContent?key=${GEMINI_KEY}`;

                let contents = [];
                // Build history correctly for Gemini
                const cleanedHistory = (history || []).slice(-10);
                for (const h of cleanedHistory) {
                    let role = (h.role === 'user' || h.role === 'assistant') ? (h.role === 'assistant' ? 'model' : 'user') : 'user';
                    let text = String(h.content || h.text || "").trim();
                    if (text) contents.push({ role, parts: [{ text }] });
                }

                // Ensure alternating roles
                let finalContents = [];
                let lastR = null;
                for (let item of contents) {
                    if (item.role !== lastR) {
                        finalContents.push(item);
                        lastR = item.role;
                    }
                }
                if (finalContents.length > 0 && finalContents[0].role !== 'user') finalContents.shift();
                finalContents.push({ role: 'user', parts: [{ text: normalizedUserMsg }] });

                const payload = {
                    contents: finalContents,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                };

                if (conf.v === 'v1beta') {
                    payload.system_instruction = { parts: [{ text: systemPrompt }] };
                }

                const res = await axios.post(url, payload, { timeout: 12000 });
                if (res.data.candidates?.[0]?.content) {
                    responseText = res.data.candidates[0].content.parts[0].text;
                    usageSource = `gemini-${conf.m}`;
                }
            } catch (e) {
                console.warn(`⚠️ [ALEX AI] Try ${conf.m} fail: ${e.response?.data?.error?.message || e.message}`);
            }
        }
    }

    // 2. OPENAI FALLBACK
    if (!responseText && OPENAI_KEY && OPENAI_KEY.length > 20) {
        try {
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...(history || []).slice(-8).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content || h.text })),
                    { role: "user", content: normalizedUserMsg }
                ]
            }, { headers: { 'Authorization': `Bearer ${OPENAI_KEY}` }, timeout: 15000 });
            responseText = res.data.choices[0].message.content;
            usageSource = 'openai-mini';
        } catch (e) { console.error("❌ OpenAI Fail"); }
    }

    const finalResponse = (responseText || "Hola, soy ALEX. Mi cerebro principal está en mantenimiento, pero sigo aquí. ¿En qué etapa de tu plan migratorio te encuentras?").replace(/Alexandra/g, 'ALEX');

    return {
        response: finalResponse,
        source: usageSource,
        tier: 'v7.2',
        metrics: { tokens: { total: 0 }, cost: 0, responseTime: 0 },
        fallback: !responseText
    };
}

module.exports = { generateResponse };
