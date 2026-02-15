const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);

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

    // Select Persona
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = `RECUERDA: Eres Alexandra v2.0 de Puentes Globales. NO eres un chatbot común. ` + currentPersona.systemPrompt;

    // Config values from persona
    const temperature = currentPersona.temperature || 0.7;
    const maxTokens = currentPersona.maxTokens || 500;

    // 1. GESTIÓN DE MEMORIA (Recuperar hilo anterior)
    const previousChat = conversationMemory.get(userId) || [];

    // Combinar historial explícito con memoria interna (limitar a 10 para ahorrar tokens)
    const combinedHistory = [...previousChat, ...explicitHistory].slice(-10);

    console.log(`🧠 [aiRouter] Persona: ${currentPersona.name} (${personaKey}) | Usuario: ${userId}`);

    // 2. PRIORIDAD 1: Gemini 1.5 Flash (Gratuito)
    if (GENAI_API_KEY && GENAI_API_KEY.length > 10) {
        try {
            console.log(`🤖 [aiRouter] Intentando Gemini Flash 1.5 (PRINCIPAL)...`);
            const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: systemPrompt
            });

            // CORRECCIÓN STATUS 400: Formateo estricto para Gemini (role 'model' no 'assistant')
            const chatHistory = combinedHistory.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: String(msg.content || msg.body || "") }],
            })).filter(msg => msg.parts[0].text);

            const chat = model.startChat({
                history: chatHistory,
                generationConfig: { temperature, maxOutputTokens: maxTokens }
            });

            const result = await chat.sendMessage(userMessage);
            responseText = result.response.text();
            console.log(`✅ [aiRouter] Éxito con Gemini 1.5 Flash`);

        } catch (error) {
            console.error(`⚠️ [aiRouter] Gemini falló (Status ${error.status || 'ERR'}): ${error.message}`);
        }
    }

    // 3. FALLBACK: OpenAI (Si Gemini falla o no hay Key)
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("🔄 [aiRouter] Backup: Usando OpenAI...");
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
                timeout: 10000
            });
            responseText = res.data.choices[0].message.content;
            console.log(`✅ [aiRouter] Éxito con OpenAI Backup`);
        } catch (openaiError) {
            console.error("❌ [aiRouter] Backup OpenAI también falló:", openaiError.message);
        }
    }

    if (responseText) {
        // Guardar en memoria para el siguiente mensaje
        const newHistory = [...combinedHistory];
        newHistory.push({ role: 'user', content: userMessage });
        newHistory.push({ role: 'assistant', content: responseText });
        conversationMemory.set(userId, newHistory.slice(-10));
    }

    return responseText || "Alex está teniendo un momento de reflexión técnica. Dame un minuto y volvemos.";
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


