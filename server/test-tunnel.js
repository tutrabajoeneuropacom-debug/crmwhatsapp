const axios = require('axios');
require('dotenv').config();

const TUNNEL_URL = 'https://tackle-cubic-asn-falling.trycloudflare.com/api/webhook/whatsapp';

async function testTunnel() {
    console.log(`📡 Probando el túnel desde fuera: ${TUNNEL_URL}`);
    try {
        const response = await axios.post(TUNNEL_URL, {
            object: 'whatsapp_business_account',
            entry: [{
                id: 'TEST_ENTRY',
                changes: [{
                    value: {
                        messages: [{
                            from: 'TunnelTester',
                            id: 'wamid.TEST',
                            timestamp: Date.now(),
                            text: { body: 'Tunnel Check 1-2-3' },
                            type: 'text'
                        }]
                    },
                    field: 'messages'
                }]
            }]
        });
        console.log(`✅ Túnel responde: ${response.status} ${response.statusText}`);
    } catch (error) {
        console.error(`❌ El túnel falló:`, error.message);
        if (error.response) console.error('Data:', error.response.data);
    }
}

testTunnel();
