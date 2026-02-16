const axios = require('axios');
require('dotenv').config();

const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '').replace(/["']/g, '');
const GEMINI_KEY = cleanKey(process.env.GEMINI_API_KEY);

async function testGeminiRest() {
    try {
        console.log("Testing Gemini via REST API...");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
        const res = await axios.post(url, {
            contents: [{ parts: [{ text: "hi" }] }]
        });
        console.log("Gemini REST Success:", JSON.stringify(res.data, null, 2));
    } catch (e) {
        if (e.response) {
            console.error("Gemini REST Failed:", e.response.status, JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Gemini REST Failed:", e.message);
        }
    }
}

testGeminiRest();
