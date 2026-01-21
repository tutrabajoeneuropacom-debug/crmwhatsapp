const axios = require('axios');

class CopperCRM {
    constructor() {
        this.apiKey = process.env.COPPER_API_KEY;
        this.userEmail = process.env.COPPER_USER_EMAIL || 'tutrabajoeneuropacom@gmail.com';
        this.baseUrl = 'https://api.copper.com/developer_api/v1';
    }

    get headers() {
        return {
            'X-PW-AccessToken': this.apiKey,
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': this.userEmail,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Find or create a person by phone number
     */
    async syncUser(phone, name) {
        if (!this.apiKey) {
            console.warn('⚠️ Copper CRM API Key missing');
            return null;
        }

        try {
            // 1. Search for existing person
            const searchRes = await axios.post(`${this.baseUrl}/people/search`, {
                phone_numbers: [{ number: phone }]
            }, { headers: this.headers });

            let person = searchRes.data?.[0];

            // 2. If not found, create new person
            if (!person) {
                console.log(`👤 Creating new Copper Contact: ${name || phone}`);
                const createRes = await axios.post(`${this.baseUrl}/people`, {
                    name: name || `WhatsApp User ${phone}`,
                    phone_numbers: [{ number: phone, category: 'mobile' }]
                }, { headers: this.headers });
                person = createRes.data;
            } else {
                console.log(`👤 Found existing Copper Contact: ${person.name} (${person.id})`);
            }

            // 3. Log activity (Optional: Add a Note or ActivityType)
            await this.logActivity(person.id, `WhatsApp interaction`);

            return person;

        } catch (error) {
            console.error('❌ Copper CRM Error:', error.response?.data || error.message);
            return null;
        }
    }

    async logActivity(personId, details) {
        // Copper "Activity" implementation would go here
        // For MVP, we just ensure the user exists
    }
}

module.exports = new CopperCRM();
