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
    async syncUser(phone, name, email) {
        if (!this.apiKey) return null;

        try {
            let person = null;

            // 1. Search by Email
            if (email) {
                const searchEmail = await axios.post(`${this.baseUrl}/people/search`, {
                    emails: [{ email: email }]
                }, { headers: this.headers });
                person = searchEmail.data?.[0];
            }

            // 2. Search by Phone (if not found yet)
            if (!person && phone) {
                const searchPhone = await axios.post(`${this.baseUrl}/people/search`, {
                    phone_numbers: [{ number: phone }]
                }, { headers: this.headers });
                person = searchPhone.data?.[0];
            }

            // 3. Create or Update
            const payload = {
                name: name || (person ? undefined : `User ${phone || email}`),
                emails: email ? [{ email, category: 'work' }] : undefined,
                phone_numbers: phone ? [{ number: phone, category: 'mobile' }] : undefined
            };

            if (!person) {
                console.log(`👤 Creating Copper Contact: ${name || email || phone}`);
                const createRes = await axios.post(`${this.baseUrl}/people`, payload, { headers: this.headers });
                person = createRes.data;
            } else {
                console.log(`👤 Updating Copper Contact: ${person.name}`);
                // Only update if we have new info worth adding (simplified for MVP)
                // In a real app we'd merge fields. reliable update needs person_id
                if (email || phone) {
                    await axios.put(`${this.baseUrl}/people/${person.id}`, payload, { headers: this.headers });
                }
            }

            return person;

        } catch (error) {
            console.error('❌ Copper CRM Error:', error.response?.data || error.message);
            return null;
        }
    }
}

module.exports = new CopperCRM();
