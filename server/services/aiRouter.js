const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
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

    // PRIORIDAD 0: Cerebro Programador Externo (ALEX-DEV-v1)
    // EFICIENCIA DE COSTOS: Solo llamamos al Cerebro si la consulta es técnica o compleja.
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
            console.log(`✅ [aiRouter] Respuesta obtenida del Cerebro Programador`);
            if (responseText) return responseText;
        } catch (brainError) {
            console.warn(`⚠️ [aiRouter] Falló el Cerebro Programador (${brainError.message}). Usando lógica local...`);
        }
    } else if (personaKey === 'ALEX_DEV') {
        console.log(`🍃 [aiRouter] Consulta simple/no-técnica. Resolviendo localmente con Gemini Flash para ahorrar tokens.`);
    }

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

            // --- FIX: Formateo estricto y alternancia de roles para Gemini ---
            let chatHistory = [];
            let lastRole = null;

            for (const msg of combinedHistory) {
                const role = msg.role === 'user' ? 'user' : 'model';
                const text = String(msg.content || msg.body || msg.text || "");
                if (!text.trim()) continue;

                if (role === lastRole) {
                    // Combinar mensajes consecutivos del mismo rol
                    chatHistory[chatHistory.length - 1].parts[0].text += "\n" + text;
                } else {
                    chatHistory.push({ role: role, parts: [{ text: text }] });
                    lastRole = role;
                }
            }

            // REGLA 1: Debe empezar con 'user'
            while (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
                chatHistory.shift();
            }

            // REGLA 2: Debe terminar con 'model' (porque el siguiente es 'user' en sendMessage)
            while (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
                chatHistory.pop();
            }

            const chat = model.startChat({
                history: chatHistory,
                generationConfig: { temperature, maxOutputTokens: maxTokens }
            });

            const result = await chat.sendMessage(userMessage);
            responseText = result.response.text();
            console.log(`✅ [aiRouter] Éxito con Gemini 1.5 Flash`);

        } catch (error) {
            console.error(`⚠️ [aiRouter] Gemini falló (Status ${error.status || 'ERR'}): ${error.message}`);

            // Reintento rápido con modelo alternativo si es 404
            if (error.message.includes('not found') || error.status === 404) {
                console.log("🔄 [aiRouter] Reintentando con gemini-1.5-pro...");
                try {
                    const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
                    const modelAlt = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
                    const result = await modelAlt.generateContent(userMessage);
                    responseText = result.response.text();
                    console.log(`✅ [aiRouter] Éxito con Gemini (Modelo Pro)`);
                } catch (e2) {
                    console.error("❌ [aiRouter] Reintento fallido:", e2.message);
                }
            }
            console.error("❌ [aiRouter] Reintento fallido:", e2.message);
        }
    }
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
            timeout: 25000
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


