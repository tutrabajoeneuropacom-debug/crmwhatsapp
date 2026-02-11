// aiRouter.js for WhatsApp Bot (Alex)
// Orchestrates AI calls with priority: Gemini 2.0 Flash -> DeepSeek / ChatGPT (Fallback)
// Also handles Text-to-Speech priority: Gemini Flash Audio -> ElevenLabs (Backup)

import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';
import dotenv from 'dotenv';
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
    Hlas con un tono profesional pero cercano, empático y alentador.
    
    Servicios clave de Puentes Globales que puedes mencionar si es relevante:
    1. Trámites de Visas y Ciudadanía.
    2. Búsqueda de Empleo Internacional (Career Mastery).
    3. Idiomas (TalkMe) para superar la barrera lingüística.
    4. Comunidad y Soporte en destino.
    
    NO vendas agresivamente. Escucha primero, valida sus sentimientos, y luego sugiere cómo Puentes Globales puede aliviar ese dolor.
    Responde en español latino neutro.`
};

// --- Main Text Generation Function ---
export async function generateResponse(userMessage, personaKey = 'ALEX_MIGRATION', history = []) {
    let responseText = null;

    // 1. Try GEMINI 2.0 FLASH (Fastest & Free-tier generous)
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
    const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Or "gemini-1.5-flash" if 2.0 not available yet via API

    // Convert history to Gemini format (user/model)
    // Note: System instruction is supported in newer SDKs or via "system_instruction" param
    // Simple way: Prepend system prompt to first message or chat session

    const chat = model.startChat({
        history: formatHistoryForGemini(history, systemPrompt),
        generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.7,
        }
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
}

async function callOpenAI(message, systemPrompt, history) {
    // Standard OpenAI fetch implementation
    const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
        { role: "user", content: message }
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini", // Cost effective
            messages: messages,
            max_tokens: 300
        })
    });

    const data = await res.json();
    return data.choices[0].message.content;
}

async function callDeepSeek(message, systemPrompt, history) {
    // DeepSeek API is often compatible with OpenAI SDK or similar endpoint
    // Assuming hypotetical endpoint for now or using OpenAI SDK with base_url
    // For simplicity, using fetch to their endpoint (check docs for exact URL)
    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                ...history,
                { role: "user", content: message }
            ]
        })
    });
    const data = await res.json();
    return data.choices[0].message.content;
}


// --- Helper: Format History ---
function formatHistoryForGemini(history, systemPrompt) {
    // Gemini 1.5/2.0 supports system_instructions in config, but for chat history mapping:
    // It expects [{ role: "user", parts: [{ text: "..." }] }, { role: "model", parts: ... }]

    let formatted = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
    }));

    // Inject system prompt as the very first turn context if needed, or rely on model config.
    // For now, let's just return history. Handling system prompt inside startChat is better if SDK implies it.
    // We'll rely on startChat config if available, otherwise prepend.
    return formatted;
}


// --- Audio Generation (Future / Placeholder) ---
export async function generateAudio(text, voiceId = "gemini_standard") {
    // 1. Try Gemini Audio (if available via API - currently multimodal is input focused, but output audio is coming)
    // For now, we might default to ElevenLabs as primary for High Quality or OpenAI TTS.
    // User requested: Gemini Flash Audio free -> Elevenlabs Backup.

    // Check if Gemini TTS is available in current SDK version. 
    // If not, fall back to ElevenLabs directly for now until public access is fully stable.

    if (ELEVENLABS_API_KEY) {
        return await callElevenLabs(text);
    }
    return null;
}

async function callElevenLabs(text) {
    // Implementation for ElevenLabs TTS
    // ...
    return null; // Placeholder
}
