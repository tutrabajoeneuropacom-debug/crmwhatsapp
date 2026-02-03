const { translateWithDeepSeek } = require('./adapters/deepseek');
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '',
});
// Lazy load these to avoid crashing if deps/keys are missing immediately
const getDeepgram = () => require('./adapters/deepgram');
const getGoogle = () => require('./adapters/google');

// --- PROVIDER CONFIGURATION ---
const PROVIDERS = {
    PREMIUM: {
        id: 'premium',
        stt: 'openai-whisper',
        llm: 'gpt-4o',
        tts: 'elevenlabs'
    },
    CHALLENGER: {
        id: 'challenger',
        stt: 'deepgram',
        llm: 'deepseek-chat',
        tts: 'google-neural'
    }
};

/**
 * AI ROUTER
 * Decides which provider stack to use based on user segment or A/B logic.
 */
class AIRouter {
    constructor() {
        this.abRatio = parseFloat(process.env.AB_TEST_RATIO || '0');
        this.override = null; // 'premium' | 'challenger' | null
    }

    setOverride(providerId) {
        console.log(`[AI-ROUTER] Override set to: ${providerId}`);
        this.override = providerId === 'null' ? null : providerId;
    }

    getRoute(userId) {
        // 1. Manual Override (Admin Force)
        if (this.override && PROVIDERS[this.override.toUpperCase()]) {
            return PROVIDERS[this.override.toUpperCase()];
        }

        if (!userId) return PROVIDERS.PREMIUM;

        // 2. A/B Logic
        const userHash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const normalizedHash = (userHash % 100) / 100;

        if (normalizedHash < this.abRatio) {
            console.log(`[AI-ROUTER] Routing ${userId} to CHALLENGER (DeepSeek/Deepgram/Google)`);
            return PROVIDERS.CHALLENGER;
        } else {
            console.log(`[AI-ROUTER] Routing ${userId} to PREMIUM (OpenAI/ElevenLabs)`);
            return PROVIDERS.PREMIUM;
        }
    }

    // --- METHODS ---

    async routeRequest(params, options = {}) {
        const { prompt, complexity, providerOverride, system_instruction } = params;

        // 1. Determine Provider
        // If complexity is 'hard', prefer Premium.
        // If override is implicit 'auto', we could use AB testing or complexity.
        let providerConfig = PROVIDERS.PREMIUM; // Default

        if (complexity === 'simple' && !providerOverride) {
            // potentially use Challenger
        }

        // 2. Construct Messages
        const messages = [{ role: 'user', content: prompt }];

        // 3. Call Chat
        // We pass system_instruction separately or as part of messages?
        // chat() handles systemInstruction arg.
        return await this.chat(messages, providerConfig, system_instruction, options);
    }

    async transcribe(audioPath, lang, providerConfig) {
        if (providerConfig.stt === 'deepgram') {
            try {
                const { transcribeWithDeepgram } = getDeepgram();
                return await transcribeWithDeepgram(audioPath, lang);
            } catch (e) {
                console.error("Deepgram Error (Falling back to default):", e.message);
                return null; // Return null to trigger fallback
            }
        }
        return null; // Default (Whisper)
    }

    async translate(text, fromLang, toLang, providerConfig) {
        if (providerConfig.llm === 'deepseek-chat') {
            try {
                return await translateWithDeepSeek(text, fromLang, toLang);
            } catch (e) {
                console.error("DeepSeek Error (Fallback):", e.message);
                return null;
            }
        }
        return null; // Default (OpenAI)
    }

    async speak(text, lang, providerConfig) {
        if (providerConfig.tts === 'google-neural') {
            try {
                const { speakWithGoogle } = getGoogle();
                return await speakWithGoogle(text, lang);
            } catch (e) {
                console.error("Google TTS Error (Fallback):", e.message);
                return null;
            }
        }
        return null; // Default (ElevenLabs)
    }

    async chat(messages, providerConfig, systemInstruction, options = {}) {
        // DeepSeek / Challenger Path
        if (providerConfig.llm === 'deepseek-chat') {
            try {
                console.log("🚀 Routing to DeepSeek V3...");
                return await chatWithDeepSeek(messages, options);
            } catch (e) {
                console.error("DeepSeek Chat Error:", e);
                // Fallback will naturally happen if we don't return here?
                // No, we should probably throw or handle fallback specifically
                console.log("⚠️ DeepSeek Failed, falling back to OpenAI.");
            }
        }

        // Premium / Default Path (OpenAI)
        try {
            // Ensure system instruction is in messages if provided separately
            const finalMessages = [...messages];
            if (systemInstruction) {
                if (!finalMessages.some(m => m.role === 'system')) {
                    finalMessages.unshift({ role: 'system', content: systemInstruction });
                }
            }

            const completion = await openai.chat.completions.create({
                model: providerConfig.llm === 'gpt-4o' ? 'gpt-4o' : 'gpt-3.5-turbo',
                messages: finalMessages,
                response_format: options.response_format,
                temperature: options.temperature,
                max_tokens: options.max_tokens
            });

            return {
                text: completion.choices[0].message.content,
                raw: completion
            };
        } catch (error) {
            console.error("AIRouter Chat Error:", error);
            throw error;
        }
    }
}

module.exports = new AIRouter();
