// aiRouter.js: V7.3 - METRICS & STABILITY
const axios = require('axios');
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');
const personas = require('../config/personas');

const c = (k) => (k || "").trim().replace(/["']/g, '').replace(/[\r\n\t]/g, '').replace(/\s/g, '');
const GEMINI_KEY = c(process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY || process.env.GOOGLE_API_KEY);
const OPENAI_KEY = c(process.env.OPENAI_API_KEY);

async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', userId = 'default', history = []) {
    let responseText = null;
    let usageSource = 'none';
    let metrics = { tokens: { total: 0 }, cost: 0, responseTime: 0 };
    const startTime = Date.now();

    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = personaKey === 'ALEX_MIGRATION' ? MIGRATION_SYSTEM_PROMPT_V1 : currentPersona.systemPrompt;

    systemPrompt = `IDENTIDAD: Eres ALEX, asesor estratégico.\nREGLA: Máximo 2 preguntas por mensaje.\nMEMORIA: Usa el historial adjunto para no repetir preguntas.\n\n${systemPrompt}`;

    const normalizedUserMsg = String(userMessage || "").trim();

    // 1. GEMINI (FREE TIER)
    if (GEMINI_KEY && GEMINI_KEY.length > 30) {
        const configs = [{ v: 'v1beta', m: 'gemini-1.5-flash' }, { v: 'v1', m: 'gemini-1.5-flash' }];
        for (const conf of configs) {
            if (responseText) break;
            try {
                const url = `https://generativelanguage.googleapis.com/${conf.v}/models/${conf.m}:generateContent?key=${GEMINI_KEY}`;
                let contents = [];
                const cleanedHistory = (history || []).slice(-10);
                let lastR = null;
                for (const h of cleanedHistory) {
                    let role = h.role === 'assistant' ? 'model' : 'user';
                    let text = String(h.content || h.text || "").trim();
                    if (text && role !== lastR) {
                        contents.push({ role, parts: [{ text }] });
                        lastR = role;
                    }
                }
                if (contents.length > 0 && contents[0].role !== 'user') contents.shift();
                contents.push({ role: 'user', parts: [{ text: normalizedUserMsg }] });

                const payload = {
                    contents,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                };
                if (conf.v === 'v1beta') payload.system_instruction = { parts: [{ text: systemPrompt }] };

                const res = await axios.post(url, payload, { timeout: 12000 });
                if (res.data.candidates?.[0]?.content) {
                    responseText = res.data.candidates[0].content.parts[0].text;
                    usageSource = `gemini-${conf.m}`;
                }
            } catch (e) { console.warn(`⚠️ [ALEX AI] Gemini Fail: ${conf.m}`); }
        }
    }

    // 2. OPENAI FALLBACK (PAID)
    if (!responseText && OPENAI_KEY && OPENAI_KEY.length > 20) {
        try {
            console.log("🔄 [ALEX AI] Fallback a OpenAI...");
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

            if (res.data.usage) {
                const u = res.data.usage;
                metrics.tokens.total = u.total_tokens;
                // gpt-4o-mini: $0.15/1M in, $0.60/1M out
                metrics.cost = ((u.prompt_tokens / 1000000) * 0.15) + ((u.completion_tokens / 1000000) * 0.60);
            }
        } catch (e) { console.error("❌ OpenAI Fail:", e.message); }
    }

    metrics.responseTime = Date.now() - startTime;
    const finalResponse = (responseText || "Hola, soy ALEX. Mi cerebro principal está en mantenimiento, pero sigo aquí.").replace(/Alexandra/g, 'ALEX');

    return {
        response: finalResponse,
        source: usageSource,
        tier: 'v7.3',
        metrics,
        fallback: !responseText
    };
}

module.exports = { generateResponse };
