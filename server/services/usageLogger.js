const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role for admin writes
const supabase = createClient(supabaseUrl, supabaseKey);

// Pricing Constants (Approximate USD) can be moved to DB
const PRICING = {
    'gpt-4o': { input: 0.000005, output: 0.000015 }, // Per char approx
    'deepseek-chat': { input: 0.0000001, output: 0.0000002 }, // ~50x cheaper
    'openai-whisper': 0.006, // Per minute
    'deepgram': 0.004, // Per minute
    'elevenlabs': 0.0003, // Per char
    'google-neural': 0.000016 // Per char (~20x cheaper)
};

const UsageLogger = {
    async logTransaction({
        userId,
        inputText,
        translatedText,
        fromLang,
        toLang,
        providers, // { stt, llm, tts }
        latencyMs,
        isCacheHit,
        isChallenger
    }) {
        try {
            // 1. Calculate Estimated Cost
            let cost = 0;

            if (!isCacheHit) {
                // STT Cost (Assuming avg 5s audio for typical phrase)
                const audioDurationMin = 5 / 60;
                cost += (PRICING[providers.stt] || 0) * audioDurationMin;

                // LLM Cost
                const inputLen = inputText?.length || 0;
                const outputLen = translatedText?.length || 0;
                const llmPrice = PRICING[providers.llm] || PRICING['gpt-4o'];
                cost += (inputLen * llmPrice.input) + (outputLen * llmPrice.output);

                // TTS Cost
                const ttsPrice = PRICING[providers.tts] || PRICING['elevenlabs'];
                cost += outputLen * ttsPrice;
            }

            // 2. Insert Log
            const { error } = await supabase
                .from('usage_logs')
                .insert({
                    user_id: userId,
                    input_text: inputText,
                    translated_text: translatedText,
                    from_lang: fromLang,
                    to_lang: toLang,
                    provider_stt: providers.stt,
                    provider_llm: providers.llm,
                    provider_tts: providers.tts,
                    latency_ms: latencyMs,
                    cost_estimated: cost,
                    is_cache_hit: isCacheHit,
                    is_challenger: isChallenger
                });

            if (error) console.error("Stats Log Error:", error);
            else console.log(`📊 Logged Transaction. Cost: $${cost.toFixed(5)}`);

        } catch (err) {
            console.error("UsageLogger Exception:", err);
        }
    }
};

module.exports = UsageLogger;
