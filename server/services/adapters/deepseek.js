const OpenAI = require('openai');

// DeepSeek is API-compatible with OpenAI!
// We can use the same SDK, just pointing to a different base URL.
const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-placeholder', // User needs to provide this
});

const translateWithDeepSeek = async (text, fromLang, toLang) => {
    try {
        const response = await deepseek.chat.completions.create({
            model: "deepseek-chat", // or deepseek-v3
            messages: [
                {
                    role: "system",
                    content: `You are a professional simultaneous interpreter. Translate from ${fromLang} to ${toLang}. Output ONLY the translation.`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            temperature: 1.3, // DeepSeek recommends slightly higher temp
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("DeepSeek Error:", error);
        throw error;
    }
};

const chatWithDeepSeek = async (messages, options = {}) => {
    try {
        const response = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: messages,
            temperature: options.temperature || 1.3,
            max_tokens: options.max_tokens,
            response_format: options.response_format
        });

        return {
            text: response.choices[0].message.content,
            raw: response
        };
    } catch (error) {
        console.error("DeepSeek Chat Error:", error);
        throw error;
    }
};

module.exports = { translateWithDeepSeek, chatWithDeepSeek };
