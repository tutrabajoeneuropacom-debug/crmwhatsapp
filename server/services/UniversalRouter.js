/**
 * -------------------------------------------------------------------------------------
 * 🏗️ Universal AI Router - The "Brain" of Latam Coaching T1
 * 
 * Implementa el patrón "Circuit Breaker" para gestionar Modelos Titulares y Suplentes.
 * Maneja Alex, TalkMe y Roleplay con lógica de fallbacks automáticos.
 * -------------------------------------------------------------------------------------
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

// --- CONFIGURACIÓN DE MODELOS ---
const MODELS = {
    ALEX: {
        PRIMARY: { provider: 'GOOGLE', model: 'gemini-1.5-flash', timeout: 4000 },
        BACKUP: { provider: 'GOOGLE', model: 'gemini-1.5-pro' } // Misma API, diferente modelo
    },
    TALKME: {
        PRIMARY: { provider: 'GOOGLE', model: 'gemini-1.5-flash', timeout: 3500 },
        BACKUP: { provider: 'OPENAI', model: 'gpt-4o-mini' } // Simulation: using OpenAI as DeepSeek proxy usually follows same structure
        // NOTE: DeepSeek usually compatible with OpenAI SDK by changing baseURL
    },
    ROLEPLAY: {
        PRIMARY: { provider: 'GOOGLE', model: 'gemini-1.5-pro', timeout: 5000 }, // Needs time to think deep
        BACKUP: { provider: 'OPENAI', model: 'gpt-4o' } // The big gun
    }
};

class UniversalRouter {
    constructor() {
        // Initialize Providers
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }

        // DeepSeek would be initialized here similarly if specific SDK used, or via OpenAI compatible endpoint
    }

    /**
     * The Core Router Function (Circuit Breaker)
     */
    async routeRequest(persona, prompt, systemInstruction) {
        const config = MODELS[persona.toUpperCase()];
        if (!config) throw new Error(`Persona ${persona} not configured in Router.`);

        console.log(`[ROUTER] Request for ${persona}. Attempting Primary: ${config.PRIMARY.model}`);

        try {
            // 1. INTENTO "TITULAR" CON TIMEOUT
            return await this._callWithTimeout(
                () => this._callProvider(config.PRIMARY, prompt, systemInstruction),
                config.PRIMARY.timeout
            );

        } catch (error) {
            // 2. ACTIVACIÓN DEL "BACKUP"
            console.warn(`[ROUTER] ⚠️ Primary Failed/Timeout (${error.message}). Switching to Backup: ${config.BACKUP.model}`);

            try {
                return await this._callProvider(config.BACKUP, prompt, systemInstruction);
            } catch (backupError) {
                console.error(`[ROUTER] ❌ CRITICAL: Both Primary and Backup failed for ${persona}.`);
                throw backupError;
            }
        }
    }

    /**
     * Helper to enforce timeouts
     */
    _callWithTimeout(promiseFactory, ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout after ${ms}ms`));
            }, ms);

            promiseFactory()
                .then(value => {
                    clearTimeout(timer);
                    resolve(value);
                })
                .catch(reason => {
                    clearTimeout(timer);
                    reject(reason);
                });
        });
    }

    /**
     * Provider Adapter (Standardizes output to simple text)
     */
    async _callProvider(config, prompt, systemInstruction) {
        if (config.provider === 'GOOGLE') {
            const model = this.genAI.getGenerativeModel({
                model: config.model,
                systemInstruction: systemInstruction
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        }
        else if (config.provider === 'OPENAI') {
            const response = await this.openai.chat.completions.create({
                model: config.model,
                messages: [
                    { role: "system", content: systemInstruction || "You are a helpful assistant." },
                    { role: "user", content: prompt }
                ],
            });
            return response.choices[0].message.content;
        }
        // Add DeepSeek specific logic here if endpoints differ significantly
        throw new Error(`Provider ${config.provider} not implemented.`);
    }

    // --- MÉTODOS PÚBLICOS PARA CADA PERSONA ---

    async chatWithAlex(userMessage, salesContext) {
        const systemPrompt = `
        Eres ALEX, un asistente de ventas experto y eficiente.
        Tu objetivo: Responder rápido y con datos precisos.
        Contexto de Ventas: ${JSON.stringify(salesContext || {})}
        `;
        return this.routeRequest('ALEX', userMessage, systemPrompt);
    }

    async chatWithTalkMe(userMessage, history) {
        // Simple context for now
        const systemPrompt = `
        Eres TALKME, un compañero de idiomas paciente y divertido.
        Corrige sutilmente pero mantén la conversación fluyendo.
        `;
        return this.routeRequest('TALKME', userMessage, systemPrompt);
    }

    async startRoleplay(cvText, jobDescription) {
        const systemPrompt = `
        Eres un Reclutador Senior (Roleplay Mode).
        Estás entrevistando a un candidato para el puesto: ${jobDescription}.
        Su CV: ${cvText.substring(0, 1000)}...
        Sé duro pero profesional. Haz una pregunta a la vez.
        `;
        return this.routeRequest('ROLEPLAY', "Inicia la entrevista ahora.", systemPrompt);
    }
}

module.exports = new UniversalRouter();
