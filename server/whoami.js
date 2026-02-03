require('dotenv').config();
const axios = require('axios');

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

async function debugToken() {
    console.log('🕵️‍♂️ Inspeccionando Token...');

    try {
        // debug_token endpoint requires an app access token or the same user token to inspect itself? 
        // Actually /me/accounts or /me/permissions is safer for user tokens/system user tokens.

        // Let's try /me first to see the user/entity
        const meUrl = `https://graph.facebook.com/v18.0/me`;
        const me = await axios.get(meUrl, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
        console.log('👤 Identity (GET /me):', me.data);

        // Let's try to get permissions
        const permUrl = `https://graph.facebook.com/v18.0/me/permissions`;
        const perms = await axios.get(permUrl, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
        console.log('🔑 Permissions:', JSON.stringify(perms.data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

debugToken();
