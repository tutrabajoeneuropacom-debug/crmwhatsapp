const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const { MIGRATION_OPERATIONAL_CONSTITUTION, MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');
require('dotenv').config();

// --- Configuración de Precios (v5.1) ---
const PRICES = {
    'gemini-flash': { input: 0, output: 0 }, // FREE
    'openai-mini': { input: 0.00000015, output: 0.0000006 }, // PAID
    'deepseek': { input: 0.0000001, output: 0.0000002 }, // LOW COST
    'alex-brain': { input: 0.000001, output: 0.000002 } // PRO
};

// --- Timeouts ---
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS) || 15000;
const DEEPSEEK_TIMEOUT_MS = parseInt(process.env.DEEPSEEK_TIMEOUT_MS) || 15000;
const BRAIN_TIMEOUT_MS = parseInt(process.env.BRAIN_TIMEOUT_MS) || 20000;
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS) || 25000;

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '').replace(/["']/g, '');

const GENAI_API_KEY = cleanKey(process.env.GEMINI_API_KEY);
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);
const DEEPSEEK_API_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);
const BRAIN_URL = process.env.ALEX_BRAIN_URL;
const BRAIN_KEY = process.env.ALEX_BRAIN_KEY || process.env.API_KEY;

const personas = require('../config/personas');

// Memoria volátil y estado estructurado
const conversationMemory = new Map();
const conversationState = new Map();

/**
 * Utilidad de Timeout
 */
async function withTimeout(promise, ms, name = "Task") {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`TIMEOUT: ${name} superó los ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

/**
 * Extrae variables del usuario para el estado estructurado
 */
function extractUserState(message, userId) {
    if (!message) return;
    const state = conversationState.get(userId) || { variables: {} };
    const messageLC = message.toLowerCase();

    // Mapeo simple de variables mencionadas
    const keywords = {
        tecnico: ['tecnico', 'programador', 'developer', 'senior', 'junior'],
        ingles: ['ingles', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'],
        destino: ['españa', 'alemania', 'portugal', 'italia', 'europa'],
        motivacion: ['familia', 'crecer', 'dinero', 'seguridad', 'vivienda']
    };

    for (const [variable, keys] of Object.entries(keywords)) {
        if (keys.some(k => messageLC.includes(k))) {
            state.variables[variable] = keys.find(k => messageLC.includes(k));
        }
    }

    conversationState.set(userId, state);
}

/**
 * Construye el contexto de memoria basado en el estado
 */
function buildMemoryContext(userId) {
    const state = conversationState.get(userId);
    if (!state || Object.keys(state.variables).length === 0) return "";

    let context = "\n--- VARIABLES DETECTADAS ---\n";
    for (const [key, val] of Object.entries(state.variables)) {
        context += `${key.toUpperCase()}: ${val}\n`;
    }
    return context;
}

/**
 * Estimación de Tokens
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
    const normalizedUserMsg = userMessage || "";
    let responseText = null;
    let usageSource = 'none';
    let retryCount = 0;
    let fallbackUsed = false;
    let inputTokens = estimateTokens(normalizedUserMsg);
    let outputTokens = 0;

    // 1. SELECT PERSONA & GOVERNANCE
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    let systemPrompt = `RECUERDA: Eres ALEX. Tu identidad es fija. ` + currentPersona.systemPrompt;

    if (personaKey === 'ALEX_MIGRATION') {
        systemPrompt = MIGRATION_SYSTEM_PROMPT_V1 + "\n\n" + MIGRATION_OPERATIONAL_CONSTITUTION;
    }

    // 2. MEMORY & CONTEXT
    extractUserState(normalizedUserMsg, userId);
    const memoryContext = buildMemoryContext(userId);

    const previousChat = conversationMemory.get(userId) || [];
    const combinedHistory = [...previousChat, ...explicitHistory].slice(-10);

    const temperature = currentPersona.temperature || 0.7;
    const maxTokens = currentPersona.maxTokens || 500;

    console.log(`🧠 [ALEX IO] Procesando para ${userId} usando ${personaKey}.`);

    // --- FLUJO OFICIAL DE RUTEIO (Gemini -> OpenAI -> DeepSeek -> Brain) ---

    // FASE 1: GEMINI FLASH (GRATIS)
    if (!responseText && GENAI_API_KEY) {
        try {
            console.log(`🤖 [ALEX IO] Intentando Gemini Flash...`);
            const genAI = new GoogleGenerativeAI(GENAI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: systemPrompt + memoryContext
            });

            await withTimeout(async () => {
                let chatHistory = [];
                let lastRole = null;

                // Gemini REQUIRES alternating roles: user -> model -> user -> model
                for (const msg of combinedHistory) {
                    const currentRole = (msg.role === 'user' || msg.role === 'model') ? msg.role : (msg.role === 'assistant' ? 'model' : 'user');
                    const text = String(msg.content || msg.body || msg.text || "").trim();

                    if (text && currentRole !== lastRole) {
                        chatHistory.push({ role: currentRole, parts: [{ text: text }] });
                        lastRole = currentRole;
                    }
                }

                // Ensure history starts with 'user' (Gemini requirement)
                if (chatHistory.length > 0 && chatHistory[0].role !== 'user') {
                    chatHistory.shift();
                }

                const chat = model.startChat({
                    history: chatHistory.slice(-10), // Increased history window
                    generationConfig: { temperature, maxOutputTokens: maxTokens }
                });

                const result = await chat.sendMessage(normalizedUserMsg);
                responseText = result.response.text();
            }, GEMINI_TIMEOUT_MS, "Gemini");

            usageSource = 'gemini-flash';
        } catch (error) {
            console.error(`❌ [ALEX AI] Gemini Flash Error: ${error.message}`);
            // If it's a 429 or quota error, the fallback is expected. 
            // If it's a validation error, we need to know.
            fallbackUsed = true;
        }
    }

    // FASE 2: OPENAI GPT-4o-mini (PAGO/FALLBACK RÁPIDO)
    if (!responseText && OPENAI_API_KEY) {
        try {
            console.log("🔄 [ALEX IO] Fallback a OpenAI (gpt-4o-mini)...");
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt + memoryContext },
                    ...combinedHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.content || h.body || h.text || "") })),
                    { role: "user", content: normalizedUserMsg }
                ],
                temperature,
                max_tokens: maxTokens
            }, {
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                timeout: OPENAI_TIMEOUT_MS
            });
            responseText = res.data.choices[0].message.content;
            usageSource = 'openai-mini';
        } catch (oaError) {
            console.error("❌ OpenAI falló:", oaError.message);
            fallbackUsed = true;
        }
    }

    // FASE 3: DEEPSEEK (LOW COST)
    if (!responseText && DEEPSEEK_API_KEY) {
        try {
            console.log("🔄 [ALEX IO] Fallback a DeepSeek...");
            const res = await axios.post('https://api.deepseek.com/chat/completions', {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt + memoryContext },
                    ...combinedHistory.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: String(h.content || h.body || h.text || "") })),
                    { role: "user", content: normalizedUserMsg }
                ],
                temperature,
                max_tokens: maxTokens
            }, {
                headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
                timeout: DEEPSEEK_TIMEOUT_MS
            });
            responseText = res.data.choices[0].message.content;
            usageSource = 'deepseek';
        } catch (dsError) {
            console.error("❌ DeepSeek falló:", dsError.message);
            fallbackUsed = true;
        }
    }

    // FASE 4: ALEX-BRAIN (PRO)
    if (!responseText && BRAIN_URL) {
        try {
            console.log(`🧠 [ALEX IO] Escalando a Alex-Brain PRO...`);
            const brainRes = await axios.post(`${BRAIN_URL}/brain/chat`, {
                userId: userId,
                message: normalizedUserMsg,
                context: memoryContext
            }, {
                headers: { 'x-api-key': BRAIN_KEY },
                timeout: BRAIN_TIMEOUT_MS
            });
            responseText = brainRes.data.response;
            usageSource = 'alex-brain';
        } catch (brainError) {
            console.error(`❌ Alex-Brain PRO falló.`);
            fallbackUsed = true;
        }
    }

    // NORMALIZACIÓN DE BRANDING FINAL
    let finalResponse = (responseText || "ALEX está optimizando su conexión...").replace(/Alexandra/g, 'ALEX');

    outputTokens = estimateTokens(finalResponse);
    const responseTime = Date.now() - startTime;

    const pricing = PRICES[usageSource] || { input: 0, output: 0 };
    const cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);

    // Update Memory
    if (responseText) {
        const newHistory = [...combinedHistory];
        newHistory.push({ role: 'user', content: normalizedUserMsg });
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

function getProviderConfigStatus() {
    return {
        order: ["gemini-flash", "openai-mini", "deepseek", "alex-brain"],
        configured: {
            gemini: !!GENAI_API_KEY,
            openai: !!OPENAI_API_KEY,
            deepseek: !!DEEPSEEK_API_KEY,
            alexBrain: !!BRAIN_URL
        },
        timeouts: {
            gemini: GEMINI_TIMEOUT_MS,
            openai: OPENAI_TIMEOUT_MS,
            deepseek: DEEPSEEK_TIMEOUT_MS,
            alexBrain: BRAIN_TIMEOUT_MS
        }
    };
}

async function generateAudio(text) {
    if (!text) return null;
    const voice = process.env.TTS_VOICE || "onyx";

    // 1. Google Fallback (Free/Stable - User Priority)
    try {
        const googleTTS = require('google-tts-api');
        const url = googleTTS.getAudioUrl(text, { lang: 'es', host: 'https://translate.google.com' });
        const audioRes = await axios.get(url, { responseType: 'arraybuffer' });
        if (audioRes.data) {
            console.log("🔊 Usando Voz de Google (Gratis)...");
            return Buffer.from(audioRes.data).toString('base64');
        }
    } catch (e) {
        console.warn(`⚠️ [aiRouter] Google TTS failed, following to OpenAI...`);
    }

    // 2. OpenAI TTS (High Quality - Fallback)
    if (OPENAI_API_KEY) {
        try {
            console.log("🎙️ Usando Voz de OpenAI (Onyx/Premiun)...");
            const response = await axios({
                method: 'post',
                url: 'https://api.openai.com/v1/audio/speech',
                data: { model: "tts-1", input: text, voice: voice },
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                responseType: 'arraybuffer',
                timeout: 15000
            });
            return Buffer.from(response.data).toString('base64');
        } catch (e) {
            console.warn(`⚠️ [aiRouter] OpenAI TTS failed: ${e.message}`);
        }
    }

    return null;
}

function cleanTextForTTS(text) {
    if (!text) return "";
    return text.replace(/[*_~`#]/g, '').replace(/Alex/g, 'Alex').replace(/Alexandra/g, 'Alex').trim();
}

module.exports = {
    generateResponse,
    generateAudio,
    cleanTextForTTS,
    detectPersonalityFromMessage,
    getProviderConfigStatus
};
