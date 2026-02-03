const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const util = require('util');

// Client will look for GOOGLE_APPLICATION_CREDENTIALS env var automatically
// or we can pass { keyFilename: 'path/to/key.json' } config.
const client = new textToSpeech.TextToSpeechClient();

const speakWithGoogle = async (text, langCode) => {
    try {
        // Map simplified lang codes (es, en) to Google Voice codes
        const voiceParams = langCode === 'es'
            ? { languageCode: 'es-US', name: 'es-US-Neural2-A' }
            : { languageCode: 'en-US', name: 'en-US-Neural2-J' }; // Neural2 is the premium-sounding (but cheaper than Eleven) tier

        const request = {
            input: { text: text },
            voice: voiceParams,
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await client.synthesizeSpeech(request);

        // Return base64 string directly
        return response.audioContent.toString('base64');

    } catch (error) {
        console.error("Google TTS Error:", error);
        throw error;
    }
};

module.exports = { speakWithGoogle };
