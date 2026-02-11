// aiRouter.js for WhatsApp Bot (Alex)
// Orchestrates AI calls with priority: Gemini 2.0 Flash -> DeepSeek / ChatGPT (Fallback)
// Also handles Text-to-Speech priority: Gemini Flash Audio -> ElevenLabs (Backup)

const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

// --- Configuration ---
const GENAI_API_KEY = process.env.GEMINI_API_KEY; // Google AI Studio Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Check mandatory key
if (!GENAI_API_KEY) {
    console.warn("⚠️ WARNING: GEMINI_API_KEY is missing. Gemini Fallback will not work.");
}

// System Prompts & Personas
const PERSONAS = {
    ALEX_MIGRATION: `Eres Alex, un asistente experto en migración y recolocación internacional de Puentes Globales.
    Tu objetivo es empatizar con los dolores del usuario al emigrar (burocracia, soledad, idioma, trabajo) y ofrecer soluciones sutilmente.
    Hablas con un tono profesional pero cercano, empático y alentador.
    
    Servicios clave de Puentes Globales que puedes mencionar si es relevante:
    1. Trámites de Visas y Ciudadanía.
    2. Búsqueda de Empleo Internacional (Career Mastery).
    3. Idiomas (TalkMe) para superar la barrera lingüística.
    4. Comunidad y Soporte en destino.
    
    NO vendas agresivamente. Escucha primero, valida sus sentimientos, y luego sugiere cómo Puentes Globales puede aliviar ese dolor.
    Responde en español latino neutro.`
};

// --- Main Text Generation Function ---
async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', history = []) {
    let responseText = null;

    // 1. Try GEMINI 1.5 FLASH (Standard Stability)
    try {
        if (GENAI_API_KEY) {
            responseText = await callGeminiFlash(userMessage, PERSONAS[personaKey], history);
        }
    } catch (error) {
        console.error("❌ Gemini Flash Error:", error.message);
    }

    // 2. Fallback: DeepSeek (Cost effective) or ChatGPT (Reliable)
    if (!responseText) {
        console.log("⚠️ Falling back to Secondary AI Provider...");
        try {
            // Try DeepSeek if key exists, otherwise OpenAI
            if (DEEPSEEK_API_KEY) {
                responseText = await callDeepSeek(userMessage, PERSONAS[personaKey], history);
            } else if (OPENAI_API_KEY) {
                responseText = await callOpenAI(userMessage, PERSONAS[personaKey], history);
            }
        } catch (error) {
            console.error("❌ Secondary AI Error:", error.message);
        }
    }

    return responseText || "Lo siento, estoy teniendo problemas de conexión. ¿Podrías repetirme eso?";
}

// --- Specific AI Implementations ---

async function callGeminiFlash(message, systemPrompt, history) {
    if (!GENAI_API_KEY) return null;

    try {
        const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt
        });

        const chat = model.startChat({
            history: formatHistoryForGemini(history),
            generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.7,
            }
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        return response.text();
    } catch (err) {
        console.error("❌ Gemini API Error:", err.message);
        throw err;
    }
}

async function callOpenAI(message, systemPrompt, history) {
    const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
        { role: "user", content: message }
    ];

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: 300
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
    });

    return response.data.choices[0].message.content;
}

async function callDeepSeek(message, systemPrompt, history) {
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: systemPrompt },
            ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
            { role: "user", content: message }
        ]
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
    });
    return response.data.choices[0].message.content;
}

// --- Helper: Format History ---
function formatHistoryForGemini(history) {
    if (!history || !Array.isArray(history)) return [];

    let formatted = [];
    let lastRole = null;

    for (const msg of history) {
        if (msg.role === 'system') continue;
        const role = msg.role === 'user' ? 'user' : 'model';

        if (role !== lastRole) {
            formatted.push({
                role: role,
                parts: [{ text: msg.content || "" }]
            });
            lastRole = role;
        }
    }

    if (formatted.length > 0 && formatted[0].role !== 'user') {
        formatted.shift();
    }

    return formatted;
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

// --- Audio Generation (Google TTS - Free) ---
async function generateAudio(text, voiceId = "gemini_standard") {
    try {
        const googleTTS = require('google-tts-api');
        const ttsUrl = googleTTS.getAudioUrl(text, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com'
        });

        const axios = require('axios');
        const response = await axios.get(ttsUrl, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (err) {
        console.error('[ERROR] Google TTS Failed:', err.message);
        return null;
    }
}

module.exports = {
    generateResponse,
    generateAudio,
    cleanTextForTTS
};


