// aiRouter.js for WhatsApp Bot (CommonJS) - V6.6 FINAL STABILITY
const axios = require('axios');
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

    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = personaKey === 'ALEX_MIGRATION' ? MIGRATION_SYSTEM_PROMPT_V1 : currentPersona.systemPrompt;

    // Force identity
    systemPrompt = `IDENTIDAD: Eres ALEX, asesor estratégico.\n\n${systemPrompt}`;

    const normalizedUserMsg = String(userMessage || "").trim();

    // 1. INTENTO GEMINI (REST) - FORMATO CEREBRO (STABLE)
    if (GENAI_API_KEY) {
        const configs = [
            { ver: 'v1beta', name: 'gemini-1.5-flash' },
            { ver: 'v1beta', name: 'gemini-1.5-flash-latest' },
            { ver: 'v1', name: 'gemini-1.5-flash' }, // v1 doesn't always support system_instruction
            { ver: 'v1beta', name: 'gemini-pro' }
        ];

        for (const config of configs) {
            if (responseText) break;
            try {
                const url = `https://generativelanguage.googleapis.com/${config.ver}/models/${config.name}:generateContent?key=${GENAI_API_KEY}`;

                let contents = [];
                let lastRole = null;

                // Gemini requires user -> model alternating
                const historySlice = (history || []).slice(-8);

                for (const msg of historySlice) {
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
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                };

                // system_instruction is only for v1beta in some regions
                if (config.ver === 'v1beta') {
                    payload.system_instruction = { parts: [{ text: systemPrompt }] };
                } else {
                    // Prepend to the first message if no system_instruction support
                    if (contents.length > 0) {
                        contents[0].parts[0].text = `INSTRUCCIONES: ${systemPrompt}\n\nMENSAJE: ${contents[0].parts[0].text}`;
                    }
                }

                const response = await axios.post(url, payload, { timeout: GEMINI_TIMEOUT });
                if (response.data.candidates?.[0]?.content) {
                    responseText = response.data.candidates[0].content.parts[0].text;
                    usageSource = 'gemini-flash';
                    console.log(`✅ [ALEX AI] Gemini OK (${config.ver}/${config.name})`);
                }
            } catch (err) {
                const errMsg = err.response?.data?.error?.message || err.message;
                console.warn(`⚠️ [ALEX AI] Gemini fail (${config.ver}/${config.name}): ${errMsg}`);
            }
        }
    }

    // 2. FALLBACK OPENAI
    if (!responseText && OPENAI_API_KEY) {
        try {
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
        } catch (e) { console.error("❌ OpenAI Fail"); }
    }

    // 3. FALLBACK DEEPSEEK
    if (!responseText && DEEPSEEK_API_KEY) {
        try {
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

    // FINAL
    const finalResponse = (responseText || "Hola, soy ALEX. Mi conexión está saturada, pero sigo aquí. ¿En qué puedo ayudarte?").replace(/Alexandra/g, 'ALEX');

    return {
        response: finalResponse,
        source: usageSource,
        tier: 'stable',
        metrics: { tokens: { total: 0 }, cost: 0, responseTime: 0 },
        fallback: !responseText
    };
}

module.exports = { generateResponse };
