const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
require('dotenv').config();

const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '').replace(/["']/g, '');

const GEMINI_KEY = cleanKey(process.env.GEMINI_API_KEY);
const DEEPSEEK_KEY = cleanKey(process.env.DEEPSEEK_API_KEY);

console.log("Testing Gemini Key:", GEMINI_KEY ? "EXISTS (Length: " + GEMINI_KEY.length + ")" : "MISSING");
console.log("Testing DeepSeek Key:", DEEPSEEK_KEY ? "EXISTS (Length: " + DEEPSEEK_KEY.length + ")" : "MISSING");

async function testGemini() {
    try {
        console.log("\n--- Testing Gemini ---");
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Respond 'OK' if you can read this.");
        console.log("Gemini Response:", result.response.text());
        return true;
    } catch (e) {
        console.error("Gemini Failed:", e.message);
        return false;
    }
}

async function testDeepSeek() {
    try {
        console.log("\n--- Testing DeepSeek ---");
        const res = await axios.post('https://api.deepseek.com/chat/completions', {
            model: "deepseek-chat",
            messages: [{ role: "user", content: "Respond 'OK' if you can read this." }],
            max_tokens: 10
        }, {
            headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log("DeepSeek Response:", res.data.choices[0].message.content);
        return true;
    } catch (e) {
        console.error("DeepSeek Failed:", e.message);
        return false;
    }
}

async function run() {
    await testGemini();
    await testDeepSeek();
}

run();
