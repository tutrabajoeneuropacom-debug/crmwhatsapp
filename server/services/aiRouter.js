const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const ELEVENLABS_API_KEY = cleanKey(process.env.ELEVENLABS_API_KEY);

const personas = require('../config/personas');

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
async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', history = []) {
    let responseText = null;

    // Select Persona
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    const systemPrompt = currentPersona.systemPrompt;

    // Config values from persona
    const temperature = currentPersona.temperature || 0.7;
    const maxTokens = currentPersona.maxTokens || 300;

    console.log(`🧠 [aiRouter] Persona: ${currentPersona.name} (${personaKey})`);

    // 1. Try GEMINI 1.5 FLASH (Prioritize speed)
    if (GENAI_API_KEY && !GENAI_API_KEY.includes('AIzaSyBmMz50s-MqC9UhEHnwXILWAAFR5tG0Cq4')) {
        try {
            console.log("🤖 [aiRouter] Attempting Gemini...");
            responseText = await callGeminiFlash(userMessage, systemPrompt, history, { temperature, maxTokens });
        } catch (error) {
            console.warn("⚠️ Gemini failed, jumping to fallbacks.");
        }
    }

    // 2. Fallbacks
    if (!responseText) {
        if (OPENAI_API_KEY) {
            try {
                console.log("🤖 [aiRouter] Fallback: OpenAI...");
                responseText = await callOpenAI(userMessage, systemPrompt, history, { temperature, maxTokens });
            } catch (error) {
                console.error("❌ OpenAI Fallback Error:", error.message);
            }
        }

        if (!responseText && DEEPSEEK_API_KEY) {
            try {
                console.log("🤖 [aiRouter] Fallback: DeepSeek...");
                responseText = await callDeepSeek(userMessage, systemPrompt, history, { temperature, maxTokens });
            } catch (error) { }
        }
    }

    return responseText || "Alex está teniendo un momento de reflexión profunda... por favor, intenta de nuevo.";
}

// --- Specific AI Implementations ---

async function callGeminiFlash(message, systemPrompt, history, options = {}) {
    if (!GENAI_API_KEY) return null;

    try {
        const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt
        });

        // Use standard content generation for single messages or simple history
        const formattedHistory = formatHistoryForGemini(history);

        if (formattedHistory.length === 0) {
            // Simple single-turn generation
            const result = await model.generateContent(message);
            return result.response.text();
        } else {
            // Multi-turn chat
            const chat = model.startChat({
                history: formattedHistory,
                generationConfig: {
                    maxOutputTokens: options.maxTokens || 300,
                    temperature: options.temperature || 0.7,
                }
            });
            const result = await chat.sendMessage(message);
            return result.response.text();
        }
    } catch (err) {
        console.error("❌ Gemini API Error:", err.message);
        throw err;
    }
}

async function callOpenAI(message, systemPrompt, history, options = {}) {
    const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
        { role: "user", content: message }
    ];

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4o-mini",
        messages: messages,
        max_tokens: options.maxTokens || 300,
        temperature: options.temperature || 0.7
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        timeout: 15000 // 15s timeout
    });

    return response.data.choices[0].message.content;
}

async function callDeepSeek(message, systemPrompt, history, options = {}) {
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: systemPrompt },
            ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
            { role: "user", content: message }
        ],
        max_tokens: options.maxTokens || 300,
        temperature: options.temperature || 0.7
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
    if (!history || !Array.isArray(history) || history.length === 0) return [];

    let formatted = [];
    let lastRole = null;

    for (const msg of history) {
        // Skip system messages (handled by systemInstruction) or empty content
        if (msg.role === 'system' || !msg.content) continue;

        const role = msg.role === 'user' ? 'user' : 'model';

        // Gemini REQUIRE strictly alternating roles: user -> model -> user...
        if (role !== lastRole) {
            formatted.push({
                role: role,
                parts: [{ text: String(msg.content) }]
            });
            lastRole = role;
        } else {
            // If same role repeats, append text instead of creating new turn
            const lastMsg = formatted[formatted.length - 1];
            if (lastMsg) {
                lastMsg.parts[0].text += "\n" + String(msg.content);
            }
        }
    }

    // Must start with 'user' role
    while (formatted.length > 0 && formatted[0].role !== 'user') {
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


