const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY);

// Diagnostic Log
console.log("🔍 [aiRouter] API Status:");
console.log(`- Gemini: ${GENAI_API_KEY ? 'Present' : 'Missing'}`);
console.log(`- OpenAI: ${OPENAI_API_KEY ? 'Present' : 'Missing'}`);

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
    const systemPrompt = PERSONAS[personaKey] || personaKey;

    // 1. Try GEMINI 1.5 FLASH (Fast but fails if key is bad)
    if (GENAI_API_KEY && !GENAI_API_KEY.includes('AIzaSyBmMz50s-MqC9UhEHnwXILWAAFR5tG0Cq4')) { // Skip known bad key
        try {
            console.log("🤖 [aiRouter] Attempting Gemini...");
            responseText = await callGeminiFlash(userMessage, systemPrompt, history);
        } catch (error) {
            console.warn("⚠️ Gemini failed, jumping to fallbacks.");
        }
    }

    // 2. Fallback: OpenAI (Reliable) -> DeepSeek
    if (!responseText) {
        if (OPENAI_API_KEY) {
            try {
                console.log("🤖 [aiRouter] Fallback: OpenAI...");
                responseText = await callOpenAI(userMessage, systemPrompt, history);
            } catch (error) {
                console.error("❌ OpenAI Fallback Error:", error.message);
            }
        }

        if (!responseText && DEEPSEEK_API_KEY) {
            try {
                console.log("🤖 [aiRouter] Fallback: DeepSeek...");
                responseText = await callDeepSeek(userMessage, systemPrompt, history);
            } catch (error) { }
        }
    }

    return responseText || "Lo siento, tuve un problema técnico. ¿Podrías repetirlo?";
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
        },
        timeout: 15000 // 15s timeout
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
        },
        timeout: 15000 // 15s timeout
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

// --- Audio Generation (ElevenLabs Primary -> Google TTS Fallback) ---
async function generateAudio(text, voiceId = "21m00Tcm4TlvDq8ikWAM") { // Rachel by default
    // 1. Try ElevenLabs
    if (ELEVENLABS_API_KEY) {
        try {
            console.log("🔊 [aiRouter] Attempting ElevenLabs TTS...");
            const response = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                {
                    text: text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                },
                {
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer',
                    timeout: 10000
                }
            );
            return Buffer.from(response.data);
        } catch (err) {
            console.warn("⚠️ ElevenLabs TTS failed:", err.message);
        }
    }

    // 2. Fallback to Google TTS (Free)
    try {
        console.log("🔊 [aiRouter] Fallback: Google TTS...");
        const googleTTS = require('google-tts-api');
        const ttsUrl = googleTTS.getAudioUrl(text, {
            lang: 'es',
            slow: false,
            host: 'https://translate.google.com'
        });

        const response = await axios.get(ttsUrl, { responseType: 'arraybuffer', timeout: 5000 });
        return Buffer.from(response.data);
    } catch (err) {
        console.error('❌ Audio Generation Failed:', err.message);
        return null;
    }
}

module.exports = {
    generateResponse,
    generateAudio,
    cleanTextForTTS
};


