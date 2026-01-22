const axios = require('axios');

async function runTest() {
    console.log('🚀 Starting Local Webhook Simulation...');
    console.log('   Target: http://localhost:3000/api/webhook/whatsapp');

    const payload = {
        object: "whatsapp_business_account",
        entry: [{
            id: "123456789",
            changes: [{
                value: {
                    messaging_product: "whatsapp",
                    metadata: {
                        display_phone_number: "1234567890",
                        phone_number_id: "1234567890"
                    },
                    contacts: [{
                        profile: {
                            name: "Gabriel Test"
                        },
                        wa_id: "5491100000000"
                    }],
                    messages: [{
                        from: "5491100000000",
                        id: "wamid.HBgMTEST123",
                        timestamp: Math.floor(Date.now() / 1000),
                        type: "text",
                        text: {
                            body: "Hola, quisiera saber precios de las visas para Europa."
                        }
                    }]
                },
                field: "messages"
            }]
        }]
    };

    try {
        const response = await axios.post('http://localhost:3000/api/webhook/whatsapp', payload);
        console.log('\n✅ Webhook Received OK');
        console.log(`   Status: ${response.status} ${response.statusText}`);
        console.log('\n👉 Check the Server Terminal to see the logs (OpenAI response, Copper Sync, etc.)');
    } catch (error) {
        console.error('\n❌ Simulation Failed');
        console.error('   Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n🔴 ERROR: The server is NOT running.');
            console.log('   Please open a new terminal and run:');
            console.log('   cd whatsapp-conversational-core/server');
            console.log('   node index-minimal.js');
        }
    }
}

runTest();
