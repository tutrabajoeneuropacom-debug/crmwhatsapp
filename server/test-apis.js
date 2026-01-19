require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');

console.log('🔍 Testing API Keys...\n');

// Test 1: OpenAI
async function testOpenAI() {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        console.log(`OpenAI Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'Di "hola" en una palabra' }],
            max_tokens: 10
        });

        console.log('✅ OpenAI: OK');
        console.log('   Response:', response.choices[0].message.content);
        return true;
    } catch (error) {
        console.log('❌ OpenAI: FAILED');
        console.log('   Error:', error.message);
        return false;
    }
}

// Test 2: ElevenLabs
async function testElevenLabs() {
    try {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        console.log(`ElevenLabs Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING'}`);

        const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text: "Test",
                model_id: "eleven_monolingual_v1",
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            },
            {
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        console.log('✅ ElevenLabs: OK');
        console.log('   Audio size:', response.data.length, 'bytes');
        return true;
    } catch (error) {
        console.log('❌ ElevenLabs: FAILED');
        console.log('   Error:', error.response?.status, error.response?.statusText || error.message);
        return false;
    }
}

// Run tests
(async () => {
    console.log('='.repeat(50));
    const openaiOk = await testOpenAI();
    console.log('');
    const elevenOk = await testElevenLabs();
    console.log('='.repeat(50));
    console.log('\n📊 Summary:');
    console.log(`   OpenAI: ${openaiOk ? '✅' : '❌'}`);
    console.log(`   ElevenLabs: ${elevenOk ? '✅' : '❌'}`);

    if (openaiOk && elevenOk) {
        console.log('\n🎉 All APIs are working!');
    } else {
        console.log('\n⚠️ Some APIs are not working. Check the errors above.');
    }
})();
