// Test script to verify AI auto-response logic
const OpenAI = require('openai');

// Simulate Render environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🔍 Diagnostic Test for WhatsApp AI Auto-Response\n');
console.log('1. Checking OpenAI API Key...');
console.log(`   Key present: ${!!OPENAI_API_KEY}`);
console.log(`   Key length: ${OPENAI_API_KEY ? OPENAI_API_KEY.length : 0}`);
console.log(`   Key preview: ${OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) + '...' : 'MISSING'}\n`);

if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set!');
    console.log('\n⚠️  This is likely the issue on Render.');
    console.log('   Solution: Add OPENAI_API_KEY to Render Environment Variables');
    process.exit(1);
}

// Test OpenAI connection
async function testOpenAI() {
    try {
        console.log('2. Testing OpenAI connection...');
        const openai = new OpenAI({ apiKey: OPENAI_API_KEY.trim() });

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Say "test successful" if you can read this.' }
            ],
            max_tokens: 20
        });

        console.log('   ✅ OpenAI API is working!');
        console.log(`   Response: ${response.choices[0].message.content}\n`);

        console.log('3. Testing AI Router (same as WhatsApp bot uses)...');
        const aiRouter = require('./services/aiRouter');

        const testResponse = await aiRouter.chat(
            [{ role: 'user', content: 'Hola' }],
            { llm: 'gpt-4o' },
            'Eres un asistente virtual. Responde brevemente.'
        );

        console.log('   ✅ AI Router is working!');
        console.log(`   Response: ${testResponse.text}\n`);

        console.log('✅ ALL TESTS PASSED!');
        console.log('   The code should work on Render if API keys are configured correctly.');

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.log('\n⚠️  This error is likely happening on Render too.');

        if (error.message.includes('API key')) {
            console.log('   Solution: Verify OPENAI_API_KEY is correct in Render');
        } else if (error.message.includes('openai is not defined')) {
            console.log('   Solution: Ensure openai package is installed on Render');
        } else {
            console.log('   Details:', error);
        }
    }
}

testOpenAI();
