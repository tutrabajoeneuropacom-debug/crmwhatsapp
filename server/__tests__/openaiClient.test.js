describe('services/openaiClient', () => {
    afterEach(() => {
        jest.resetModules();
        delete process.env.OPENAI_API_KEY;
    });

    test('returns a stub client when OPENAI_API_KEY is missing and the stub throws a clear error', async () => {
        delete process.env.OPENAI_API_KEY;
        jest.resetModules();
        const { getOpenAI } = require('../services/openaiClient');

        const client = getOpenAI();
        await expect(client.chat.completions.create()).rejects.toThrow('OpenAI API key not configured');
    });
});
