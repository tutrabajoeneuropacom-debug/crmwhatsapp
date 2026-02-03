const OpenAI = require('openai');

let client = null;

/**
 * Create a safe stub that mirrors the minimal shape the app expects.
 * When any method is invoked it throws a clear, controlled error.
 */
function createStub() {
    const err = new Error('OpenAI API key not configured. Set OPENAI_API_KEY in environment.');
    return {
        chat: {
            completions: {
                create: async () => { throw err; }
            }
        },
        responses: {
            create: async () => { throw err; }
        }
    };
}

/**
 * Get or create OpenAI client instance.
 * If OPENAI_API_KEY missing, return a safe stub instead of throwing.
 */
function getOpenAI() {
    if (client) return client;

    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
        console.warn('⚠️ OPENAI_API_KEY not configured - returning stub client. Calls will fail with a clear error.');
        client = createStub();
        return client;
    }

    client = new OpenAI({ apiKey });
    console.log('✅ OpenAI client initialized');
    return client;
}

/**
 * Reset client (useful for tests)
 */
function resetClient() {
    client = null;
}

module.exports = { getOpenAI, resetClient };
