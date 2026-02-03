const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const OpenAI = require('openai');



// Initialize inside function to avoid top-level crash if env missing during load
let openai;
function getOpenAI() {
    if (!openai) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : 'dummy', // Prevent crash, fail at call time
        });
    }
    return openai;
}

// Helper to delete file
const cleanup = (filePath) => {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        console.error('Error cleaning up file:', e);
    }
};

/**
 * Orchestrates the Interpreter Flow:
 * Audio -> Text (Source) -> Text (Target) -> Audio (Target)
 */
const processTranslation = async ({ audioPath, fromLang, toLang, userId }) => {
    try {
        console.log(`🌐 Translating for ${userId} [${fromLang} -> ${toLang}]`);

        // --- 0. ROUTING CONFIG ---
        const aiRouter = require('./aiRouter');
        const routeConfig = aiRouter.getRoute(userId);

        // --- 1. STT: TRANSCRIPTION (Router -> Fallback) ---
        let originalText;
        // Try Router First (Deepgram)
        const routerSTT = await aiRouter.transcribe(audioPath, fromLang, routeConfig);

        if (routerSTT) {
            originalText = routerSTT;
            console.log(`🎤 Heard (via ${routeConfig.stt}): "${originalText}"`);
        } else {
            // Fallback: Whisper
            const formData = new FormData();
            formData.append('file', fs.createReadStream(audioPath), 'audio.m4a');
            formData.append('model', 'whisper-1');
            formData.append('language', fromLang);

            const sttResponse = await axios.post(
                'https://api.openai.com/v1/audio/transcriptions',
                formData,
                { headers: { ...formData.getHeaders(), 'Authorization': `Bearer ${process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : ''}` } }
            );
            originalText = sttResponse.data.text;
            console.log(`🎤 Heard (via Whisper): "${originalText}"`);
        }

        // --- SMART CACHE LAYER ---
        const smartCache = require('./smartCache');
        let translatedText = smartCache.checkCommon(originalText, fromLang, toLang);

        if (translatedText) {
            console.log(`⚡ [SMART-CACHE] Text Hit! "${originalText}" -> "${translatedText}"`);
        } else {
            // --- 2. LLM: TRANSLATION (Router -> Fallback) ---
            const routerLLM = await aiRouter.translate(originalText, fromLang, toLang, routeConfig);

            if (routerLLM) {
                translatedText = routerLLM;
                console.log(`🗣️ Translated (via ${routeConfig.llm}): "${translatedText}"`);
            } else {
                // Fallback: GPT-4o
                const systemPrompt = `You are a professional simultaneous interpreter. 
              Your task is to translate the user's input from ${fromLang} to ${toLang}.
              - Maintain the tone, emotion, and nuance.
              - Output ONLY the translated text. Do not add explanations or notes.
              - If the input is empty or unintelligible, reply with "..."`;

                const completion = await getOpenAI().chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: originalText }
                    ],
                });
                translatedText = completion.choices[0].message.content;
                console.log(`🗣️ Translated (via OpenAI): "${translatedText}"`);
            }
        }

        // --- 3. TTS: AUDIO (Cache -> Router -> Fallback) ---
        let audioBase64 = smartCache.getAudio(translatedText, toLang);

        if (audioBase64) {
            console.log(`⚡ [SMART-CACHE] Audio Hit! Serving from disk.`);
        } else {
            // Try Router First (Google)
            const routerTTS = await aiRouter.speak(translatedText, toLang, routeConfig);

            if (routerTTS) {
                audioBase64 = routerTTS;
                console.log(`🔊 Generated Audio (via ${routeConfig.tts})`);
                // Save to Cache (converting base64 to buffer)
                smartCache.saveAudio(translatedText, toLang, Buffer.from(audioBase64, 'base64'));
            } else {
                // Fallback: ElevenLabs
                console.log(`🔊 Generating new Audio (via ElevenLabs)`);
                const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
                const ttsResponse = await axios.post(
                    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
                    {
                        text: translatedText,
                        model_id: "eleven_multilingual_v2",
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                    },
                    { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, responseType: 'arraybuffer' }
                );

                const audioBuffer = Buffer.from(ttsResponse.data);
                audioBase64 = audioBuffer.toString('base64');
                smartCache.saveAudio(translatedText, toLang, audioBuffer);
            }
        }

        // --- 4. LOG USAGE (FIRE & FORGET) ---
        // We log async so user doesn't wait
        const UsageLogger = require('./usageLogger');
        UsageLogger.logTransaction({
            userId,
            feature: 'translator',
            providerStt: routerSTT ? (routeConfig.stt === 'deepgram' ? 'deepgram' : 'openai-whisper') : 'openai-whisper',
            providerLlm: 'openai-gpt4o', // Currently hardcoded fallback mostly
            providerTts: routeConfig.tts,
            inputTokens: originalText ? originalText.length / 4 : 0, // Approx
            outputTokens: translatedText ? translatedText.length / 4 : 0,
            cacheHit: !!smartCache.checkCommon(originalText, fromLang, toLang)
        }).catch(err => console.error('Logging Error:', err));

        return {
            originalText,
            translatedText,
            audioBase64
        };

    } catch (error) {
        console.error('Translation Service Error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = { processTranslation };
