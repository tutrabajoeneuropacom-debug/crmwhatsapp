const fs = require('fs');
const { createClient } = require("@deepgram/sdk");

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || 'placeholder');

const transcribeWithDeepgram = async (audioPath, language) => {
    try {
        // Deepgram expects a buffer or stream
        const audioFile = fs.readFileSync(audioPath);

        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioFile,
            {
                model: "nova-2",
                language: language, // e.g. "es"
                smart_format: true,
            }
        );

        if (error) throw error;

        // Return just the transcript text
        return result.results.channels[0].alternatives[0].transcript;

    } catch (error) {
        console.error("Deepgram Error:", error);
        throw error;
    }
};

module.exports = { transcribeWithDeepgram };
