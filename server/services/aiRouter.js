const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const BRAIN_URL = process.env.ALEX_BRAIN_URL; // URL del nuevo cerebro ALEX-DEV-v1
const BRAIN_KEY = process.env.ALEX_BRAIN_KEY || process.env.API_KEY;

const personas = require('../config/personas');

// Memoria volátil para evitar la amnesia en cada mensaje
const conversationMemory = new Map();

/**
 * Automagically detects if the user is asking about a specific topic 
 * that matches a persona's keywords.
 */
function detectPersonalityFromMessage(message) {
    if (!message) return null;
    const messageLC = message.toLowerCase();

    for (const [key, persona] of Object.entries(personas)) {
        if (persona.keywords && persona.keywords.some(keyword => messageLC.includes(keyword))) {
            return key;
        }
    }
    return null;
}

// --- Main Text Generation Function ---
async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', userId = 'default', explicitHistory = []) {
    let responseText = null;
    let usageSource = 'none';

    // PRIORIDAD 0: Cerebro Programador Externo (ALEX-DEV-v1)
    const isTechnicalQuery = (msg) => {
        const techKeywords = ['arquitectura', 'hexagonal', 'código', 'error', 'prisma', 'fastify', 'backend', 'refactor', 'clean code', 'base de datos', 'api'];
        return techKeywords.some(k => msg.toLowerCase().includes(k)) || msg.length > 100;
    };

    if (personaKey === 'ALEX_DEV' && BRAIN_URL && isTechnicalQuery(userMessage)) {
        try {
            console.log(`🧠 [aiRouter] Consulta técnica detectada. Delegando al Cerebro: ${BRAIN_URL}`);
            const brainRes = await axios.post(`${BRAIN_URL}/brain/chat`, {
                userId: userId,
                message: userMessage
            }, {
                headers: { 'x-api-key': BRAIN_KEY },
                timeout: 15000
            });
            responseText = brainRes.data.response;
            usageSource = 'alex-brain';
            console.log(`✅ [aiRouter] Respuesta obtenida del Cerebro Programador`);
            if (responseText) return { response: responseText, source: usageSource, tier: '🚀 PRO' };
        } catch (brainError) {
            console.warn(`⚠️ [aiRouter] Falló el Cerebro Programador (${brainError.message}). Usando lógica local...`);
        }
    }

    // Select Persona
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = `RECUERDA: Eres Alex de Alex IO. NO eres un chatbot común. ` + currentPersona.systemPrompt;

    // Config values from persona
    const temperature = currentPersona.temperature || 0.7;
    const maxTokens = currentPersona.maxTokens || 500;

    // 1. GESTIÓN DE MEMORIA
    const previousChat = conversationMemory.get(userId) || [];
    const combinedHistory = [...previousChat, ...explicitHistory].slice(-10);

    // 2. PRIORIDAD 1: Gemini 1.5 Flash (Gratuito)
    if (GENAI_API_KEY && GENAI_API_KEY.length > 10) {
        try {
            console.log(`🤖 [aiRouter] Intentando Gemini Flash 1.5 (PRINCIPAL)...`);
            const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: systemPrompt
            });

            let chatHistory = [];
            let lastRole = null;

            for (const msg of combinedHistory) {
                const role = msg.role === 'user' ? 'user' : 'model';
                const text = String(msg.content || msg.body || msg.text || "");
                if (!text.trim()) continue;

                if (role === lastRole) {
                    chatHistory[chatHistory.length - 1].parts[0].text += "\n" + text;
                } else {
                    chatHistory.push({ role: role, parts: [{ text: text }] });
                    lastRole = role;
                }
            }

            while (chatHistory.length > 0 && chatHistory[0].role !== 'user') chatHistory.shift();
            while (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') chatHistory.pop();

            const chat = model.startChat({
                history: chatHistory,
                generationConfig: { temperature, maxOutputTokens: maxTokens }
            });

            const result = await chat.sendMessage(userMessage);
            responseText = result.response.text();
            usageSource = 'gemini-flash';
            console.log(`✅ [aiRouter] Éxito con Gemini 1.5 Flash (Gratis)`);

        } catch (error) {
            console.error(`⚠️ [aiRouter] Gemini falló: ${error.message}`);
        }
    }

    // 3. PRIORIDAD 2: DeepSeek (Gratuito/Económico)
    if (!responseText && DEEPSEEK_API_KEY) {
        try {
            console.log("🔄 [aiRouter] Intentando DeepSeek...");
            const res = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...combinedHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content || h.body })),
                    { role: "user", content: userMessage }
                ],
                temperature,
                max_tokens: maxTokens
            }, {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            });
            responseText = res.data.choices[0].message.content;
            usageSource = 'deepseek';
            console.log(`✅ [aiRouter] Éxito con DeepSeek (Gratis)`);
        } catch (deepSeekError) {
            console.error("❌ DeepSeek falló:", deepSeekError.message);
        }
    }

    // 4. FALLBACK: OpenAI (Si Gemini/DeepSeek falla o no hay Key)
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("🔄 [aiRouter] Backup: Usando OpenAI (PAGO)...");
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...combinedHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content || h.body })),
                    { role: "user", content: userMessage }
                ],
                temperature,
                max_tokens: maxTokens
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 25000
            });
            responseText = res.data.choices[0].message.content;
            usageSource = 'openai-mini';
            console.log(`✅ [aiRouter] Éxito con OpenAI Backup (Pago)`);
        } catch (openaiError) {
            console.error("❌ [aiRouter] Backup OpenAI también falló:", openaiError.message);
        }
    }

    const finalResponse = responseText || "Alex IO está procesando tu solicitud...";

    if (responseText) {
        const newHistory = [...combinedHistory];
        newHistory.push({ role: 'user', content: userMessage });
        newHistory.push({ role: 'assistant', content: finalResponse });
        conversationMemory.set(userId, newHistory.slice(-10));
    }

    let tierLabel = '🍃 GRATIS';
    if (usageSource === 'openai-mini') tierLabel = '💸 PAGO';
    if (usageSource === 'alex-brain') tierLabel = '🚀 PRO';

    return {
        response: finalResponse,
        source: usageSource,
        tier: tierLabel
    };
}

/**
 * Cleans Markdown and special characters for TTS engines.
 */
function cleanTextForTTS(text) {
    if (!text) return "";
    return text
        .replace(/[*_~`#]/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/\{.*?\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = {
    generateResponse,
    cleanTextForTTS,
    detectPersonalityFromMessage
};
