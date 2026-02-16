const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Configuración de Precios (v5.1) ---
const PRICES = {
    'gemini-flash': { input: 0, output: 0 }, // FREE
    'deepseek': { input: 0.0000001, output: 0.0000002 }, // LOW COST (Estimado)
    'openai-mini': { input: 0.00000015, output: 0.0000006 }, // PAID
    'alex-brain': { input: 0.000001, output: 0.000002 } // PRO
};

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '').replace(/["']/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const BRAIN_URL = process.env.ALEX_BRAIN_URL;
const BRAIN_KEY = process.env.ALEX_BRAIN_KEY || process.env.API_KEY;

const personas = require('../config/personas');

// Memoria volátil
const conversationMemory = new Map();

/**
 * Estimación de Tokens (1 token ≈ 4 caracteres según Constitución v5.1)
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

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

async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', userId = 'default', explicitHistory = []) {
    const startTime = Date.now();
    let responseText = null;
    let usageSource = 'none';
    let retryCount = 0;
    let fallbackUsed = false;
    let inputTokens = estimateTokens(userMessage);
    let outputTokens = 0;

    // 1. SELECT PERSONA & TONE
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    const systemPrompt = `RECUERDA: Eres Alex de Alex IO. NO eres un chatbot común. Actúa como el experto asignado. ` + currentPersona.systemPrompt;

    const temperature = currentPersona.temperature || 0.7;
    const maxTokens = currentPersona.maxTokens || 500;

    // 2. HISTORY MANAGEMENT
    const previousChat = conversationMemory.get(userId) || [];
    const combinedHistory = [...previousChat, ...explicitHistory].slice(-10);

    // Helper: Detect Technical query
    const isTechnicalQuery = (msg) => {
        const techKeywords = ['arquitectura', 'hexagonal', 'código', 'error', 'prisma', 'fastify', 'backend', 'refactor', 'clean code', 'base de datos', 'api', 'dev', 'bug', 'javascript', 'python', 'node'];
        return techKeywords.some(k => msg.toLowerCase().includes(k)) || msg.length > 400;
    };

    console.log(`🧠 [Alex IO] Procesando mensaje para ${userId}.`);

    // --- FLUJO OFICIAL DE DECISIÓN (v5.1) ---

    // FASE 1: GEMINI FLASH (GRATIS)
    if (!responseText && GENAI_API_KEY) {
        const tryGemini = async (isRetry = false) => {
            try {
                console.log(`🤖 [Alex IO] Intentando Gemini Flash 1.5${isRetry ? ' (RETRY)' : ''}...`);
                const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
                const model = genAI.getGenerativeModel({
                    model: "gemini-1.5-flash",
                    systemInstruction: systemPrompt
                });

                let chatHistory = [];
                for (const msg of combinedHistory) {
                    const role = msg.role === 'user' ? 'user' : 'model';
                    const text = String(msg.content || msg.body || msg.text || "");
                    if (text.trim()) chatHistory.push({ role: role, parts: [{ text: text }] });
                }

                const chat = model.startChat({
                    history: chatHistory.slice(-6),
                    generationConfig: { temperature, maxOutputTokens: maxTokens }
                });

                const result = await chat.sendMessage(userMessage);
                responseText = result.response.text();
                usageSource = 'gemini-flash';
                return true;
            } catch (error) {
                console.error(`❌ [Alex IO] Gemini falló: ${error.message}`);
                return false;
            }
        };

        if (!(await tryGemini())) {
            retryCount++;
            if (!(await tryGemini(true))) {
                fallbackUsed = true;
            }
        }
    }

    // FASE 2: DEEPSEEK (LOW COST)
    if (!responseText && DEEPSEEK_API_KEY) {
        try {
            console.log("🔄 [Alex IO] Fallback a DeepSeek...");
            const res = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...combinedHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content || h.body || h.text })),
                    { role: "user", content: userMessage }
                ],
                temperature,
                max_tokens: maxTokens
            }, {
                headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
                timeout: 15000
            });
            responseText = res.data.choices[0].message.content;
            usageSource = 'deepseek';
        } catch (dsError) {
            console.error("❌ [Alex IO] DeepSeek falló:", dsError.message);
            fallbackUsed = true;
        }
    }

    // FASE 3: ALEX-BRAIN (PRO - SOLO TÉCNICO)
    if (!responseText && BRAIN_URL && isTechnicalQuery(userMessage)) {
        try {
            console.log(`🧠 [Alex IO] Escalando a Alex-Brain PRO...`);
            const brainRes = await axios.post(`${BRAIN_URL}/brain/chat`, {
                userId: userId,
                message: userMessage
            }, {
                headers: { 'x-api-key': BRAIN_KEY },
                timeout: 20000
            });
            responseText = brainRes.data.response;
            usageSource = 'alex-brain';
        } catch (brainError) {
            console.error(`❌ [Alex IO] Alex-Brain PRO falló.`);
            fallbackUsed = true;
        }
    }

    // FASE 4: OPENAI (PAGO - GARANTÍA FINAL)
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("🔄 [Alex IO] Último Recurso: OpenAI GPT-4o-mini...");
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...combinedHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content || h.body || h.text || "" })),
                    { role: "user", content: userMessage }
                ],
                temperature,
                max_tokens: maxTokens
            }, {
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                timeout: 25000
            });
            responseText = res.data.choices[0].message.content;
            usageSource = 'openai-mini';
        } catch (oaError) {
            console.error("❌ [Alex IO] Todos los motores fallaron.");
        }
    }

    const finalResponse = responseText || "Alex IO está procesando tu solicitud, dame un momento.";
    outputTokens = estimateTokens(finalResponse);
    const responseTime = Date.now() - startTime;

    // Cálculo de Costo (v5.1)
    const pricing = PRICES[usageSource] || { input: 0, output: 0 };
    const cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);

    // Update Memory
    if (responseText) {
        const newHistory = [...combinedHistory];
        newHistory.push({ role: 'user', content: userMessage });
        newHistory.push({ role: 'assistant', content: finalResponse });
        conversationMemory.set(userId, newHistory.slice(-10));
    }

    let tierLabel = '🍃 GRATIS';
    if (usageSource === 'deepseek') tierLabel = '🍃 LOW COST';
    if (usageSource === 'openai-mini') tierLabel = '💸 PAGO';
    if (usageSource === 'alex-brain') tierLabel = '🚀 PRO';

    return {
        response: finalResponse,
        source: usageSource,
        tier: tierLabel,
        metrics: {
            tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
            cost: cost.toFixed(6),
            responseTime: responseTime,
            retryCount: retryCount,
            fallbackUsed: fallbackUsed
        }
    };
}

function cleanTextForTTS(text) {
    if (!text) return "";
    return text.replace(/[*_~`#]/g, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[.*?\]\(.*?\)/g, '').replace(/\{.*?\}/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { generateResponse, cleanTextForTTS, detectPersonalityFromMessage };
