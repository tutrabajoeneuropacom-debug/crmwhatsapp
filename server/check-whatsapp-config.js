require('dotenv').config();
const whatsappCloudAPI = require('./services/whatsappCloudAPI');

console.log('🔍 WhatsApp Cloud API Configuration Check\n');
console.log('='.repeat(60));

// Check environment variables
const checks = {
    'Access Token': process.env.WHATSAPP_ACCESS_TOKEN,
    'Phone Number ID': process.env.WHATSAPP_PHONE_NUMBER_ID,
    'API Version': process.env.WHATSAPP_API_VERSION,
    'Webhook Verify Token': process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
};

let allConfigured = true;

for (const [key, value] of Object.entries(checks)) {
    const status = value && value !== 'TU_TOKEN_AQUI' ? '✅' : '❌';
    const display = value && value !== 'TU_TOKEN_AQUI'
        ? (value.length > 20 ? value.substring(0, 20) + '...' : value)
        : 'NOT CONFIGURED';

    console.log(`${status} ${key}: ${display}`);

    if (!value || value === 'TU_TOKEN_AQUI') {
        allConfigured = false;
    }
}

console.log('='.repeat(60));

if (allConfigured) {
    console.log('\n✅ All configuration is set!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: node index.js');
    console.log('   2. Run ngrok: ngrok http 3000');
    console.log('   3. Configure webhook in Meta with ngrok URL');
    console.log('   4. Send a test message!');
} else {
    console.log('\n❌ Configuration incomplete!');
    console.log('\n📝 To fix:');
    console.log('   1. Go to Meta WhatsApp API page');
    console.log('   2. Click "Generate access token"');
    console.log('   3. Copy the token');
    console.log('   4. Update .env file: WHATSAPP_ACCESS_TOKEN=your_token');
    console.log('\n   Then run this script again.');
}

console.log('\n');
