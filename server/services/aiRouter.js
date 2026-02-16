const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

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
    // 1. SELECT PERSONA & TONE
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    const systemPrompt = `RECUERDA: Eres Alex de Alex IO. NO eres un chatbot común. Actúa como el experto asignado. ` + currentPersona.systemPrompt;

    const temperature = currentPersona.temperature || 0.7;
    const maxTokens = currentPersona.maxTokens || 500;

    // 2. HISTORY MANAGEMENT
    const previousChat = conversationMemory.get(userId) || [];
    const combinedHistory = [...previousChat, ...explicitHistory].slice(-10);

    let responseText = null;
    let usageSource = 'none';

    // Helper: Detect Technical query
    const isTechnicalQuery = (msg) => {
        const techKeywords = ['arquitectura', 'hexagonal', 'código', 'error', 'prisma', 'fastify', 'backend', 'refactor', 'clean code', 'base de datos', 'api', 'dev', 'bug', 'javascript', 'python', 'node'];
        return techKeywords.some(k => msg.toLowerCase().includes(k)) || msg.length > 400;
    };

    console.log(`🧠 [aiRouter] Procesando mensaje para ${userId} (${personaKey}). Technical: ${isTechnicalQuery(userMessage)}`);

    // --- FLUJO DE DECISIÓN (CONSTITUCIÓN v5.0) ---

    // FASE 1: GEMINI FLASH (GRATIS - PRINCIPAL)
    if (!responseText && GENAI_API_KEY) {
        try {
            console.log(`🤖 [aiRouter] Intentando Gemini Flash 1.5...`);
            const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: systemPrompt
            });

            // Convert history to Gemini format
            let chatHistory = [];
            for (const msg of combinedHistory) {
                const role = msg.role === 'user' ? 'user' : 'model';
                const text = String(msg.content || msg.body || msg.text || "");
                if (text.trim()) {
                    chatHistory.push({ role: role, parts: [{ text: text }] });
                }
            }

            // Fix: Role alternating and starting with user
            if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'model') {
                // Gemini supports this usually, but let's be safe
            }

            const chat = model.startChat({
                history: chatHistory.slice(-6), // Limit history for stability
                generationConfig: { temperature, maxOutputTokens: maxTokens }
            });

            const result = await chat.sendMessage(userMessage);
            responseText = result.response.text();
            usageSource = 'gemini-flash';
            console.log(`✅ [aiRouter] Gemini Flash respondió.`);
        } catch (error) {
            console.error(`❌ [aiRouter] Gemini Falló: ${error.message}`);
        }
    }

    // FASE 2: DEEPSEEK (GRATIS/LOW COST)
    if (!responseText && DEEPSEEK_API_KEY) {
        try {
            console.log("🔄 [aiRouter] Intentando DeepSeek...");
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
            console.log(`✅ [aiRouter] DeepSeek respondió.`);
        } catch (dsError) {
            console.error("❌ [aiRouter] DeepSeek Falló:", dsError.message);
        }
    }

    // FASE 3: ALEX-BRAIN (PRO - SOLO PARA TÉCNICO SI FALLA LO GRATIS)
    if (!responseText && BRAIN_URL && isTechnicalQuery(userMessage)) {
        try {
            console.log(`🧠 [aiRouter] Delegando a Alex-Brain PRO (Fallback técnico)...`);
            const brainRes = await axios.post(`${BRAIN_URL}/brain/chat`, {
                userId: userId,
                message: userMessage
            }, {
                headers: { 'x-api-key': BRAIN_KEY },
                timeout: 20000
            });
            responseText = brainRes.data.response;
            usageSource = 'alex-brain';
            console.log(`✅ [aiRouter] Alex-Brain respondió.`);
        } catch (brainError) {
            console.error(`❌ [aiRouter] Alex-Brain PRO Falló.`);
        }
    }

    // FASE 4: OPENAI (PAGO - ÚLTIMO RECURSO)
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("🔄 [aiRouter] Final Fallback: OpenAI GPT-4o-mini...");
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    ...combinedHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content || h.body || h.text })),
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
            console.log(`✅ [aiRouter] OpenAI respondió.`);
        } catch (oaError) {
            console.error("❌ [aiRouter] Todos los motores fallaron.");
        }
    }

    const finalResponse = responseText || "Alex IO está procesando tu solicitud, dame un momento.";

    // Update Memory
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

function cleanTextForTTS(text) {
    if (!text) return "";
    return text.replace(/[*_~`#]/g, '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[.*?\]\(.*?\)/g, '').replace(/\{.*?\}/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = { generateResponse, cleanTextForTTS, detectPersonalityFromMessage };
