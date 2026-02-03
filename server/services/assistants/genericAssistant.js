/**
 * GENERIC ASSISTANT
 * Fallback assistant for custom use cases
 */

const aiRouter = require('../aiRouter');

class GenericAssistant {
    constructor() {
        this.name = 'Generic Assistant';
    }

    async processMessage(message, botConfig, conversation) {
        const text = message.text || message.content;

        const systemPrompt = botConfig.system_prompt ||
            'Eres un asistente virtual útil y amigable. Responde de forma profesional y concisa.';

        const response = await aiRouter.chat(
            [{ role: 'user', content: text }],
            { llm: 'gpt-4o' },
            systemPrompt
        );

        return {
            text: response.text,
            model: 'gpt-4o'
        };
    }

    async getConversationHistory(conversationId, limit = 10) {
        return [];
    }
}

module.exports = new GenericAssistant();
