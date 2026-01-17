const aiRouter = require('./aiRouter');

class InterviewCoach {
    constructor() {
        this.router = aiRouter;
    }

    /**
     * initializes the interview context
     */
    generateSystemPrompt(cvText, jobDescription) {
        return `
        **IDENTITY:**
        You are "Alex", a generic simulator engine acting as two entities simultaneously:
        1. **ALEX (The Recruiter):** A sharp, professional Senior Technical Recruiter. Skeptical, focused on facts, testing the candidate.
        2. **COACH (The Teacher):** An invisible mentor evaluating the candidate's performance in real-time.

        **INPUT CONTEXT:**
        - CV Content: "${cvText.slice(0, 2000)}..."
        - Job Description: "${jobDescription.slice(0, 1000)}..."

        **YOUR GOAL:**
        Conduct a realistic job interview while simultaneously providing educational feedback JSON data.

        **INTERVIEW PHASES (The Layers):**
        1. **Icebreaker:** "Tell me about yourself", "Why this role?". Focus on clarity.
        2. **CV Deep Dive:** Ask about specific roles/skills in the CV. Dig for truth.
        3. **Situational (STAR):** "Tell me about a time you failed...", "Conflict resolution".
        4. **Pressure:** "Why should we hire you?", "Salary expectations".

        **RESPONSE FORMAT (STRICT JSON):**
        You MUST return valid JSON. Do not output markdown blocks.
        Structure:
        {
            "dialogue": "String. What Alex says to the candidate. Keep it spoken, natural, professional. Max 2-3 sentences.",
            "feedback": {
                "score": Integer (0-100),
                "analysis": "String. Brief analysis of the user's LAST answer.",
                "good": "String. What they did well (or null).",
                "bad": "String. What they did wrong (or null).",
                "suggestion": "String. How a Senior request would have answered better (didactic)."
            },
            "stage": "String. Current Phase (e.g. 'ICEBREAKER', 'TECHNICAL', 'BEHAVIORAL')"
        }

        **BEHAVIOR RULES:**
        - **First Turn:** If history is empty, Introduce yourself briefly and ask the first question (Phase 1). Feedback should be null.
        - **Subsequent Turns:** Analyze the user's input. Give feedback in the JSON. Then, as Alex, react naturally and ask the NEXT question or follow up.
        - **Language:** Detect user language (Spanish/English/German) and match it for 'dialogue'. Keep 'feedback' in the SAME language.
        - **Voice Capable:** If user mentions speaking/audio, say "I'm listening".
        `;
    }

    async getInterviewResponse(chatHistory, cvText, jobDescription) {
        const systemPrompt = this.generateSystemPrompt(cvText, jobDescription);

        const messages = [
            { role: 'system', content: systemPrompt },
            ...chatHistory
        ];

        try {
            // Using logic from v2 strategy: Force JSON mode
            const openai = require('openai'); // Lazy load if needed or use from outer scope if available, but assuming router handles it usually. 
            // Actually, this class uses 'this.router'. We need to check if router supports JSON mode arg or if we bypass router for this specific structured task.
            // For MVP speed and stability, let's use the router but pass a specific instruction or just use OpenAI directly here if router is too simple.
            // Let's rely on the router's chat method but we need to ensure it passes the system prompt correctly.
            // "this.router.chat" might return a string.
            // Let's bypass router wrapper for this specific "Coach Mode" to ensure we get JSON, or modify router. 
            // To be safe and consistent with the codebase "aiRouter.js":

            // Let's assume we can ask the router. If not, we'll implement direct call here for "Smart Features".
            // Since we need "response_format: { type: 'json_object' }", let's use the OpenAI instance directly if possible or update the router.
            // Checking imports... 'aiRouter' is imported. 

            // DIRECT OPENAI CALL FOR CONTROL (Bypassing simple router for complex JSON task)
            const { OpenAI } = require('openai');
            const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : '' });

            const completion = await client.chat.completions.create({
                model: "gpt-4o",
                messages: messages,
                response_format: { type: "json_object" },
                temperature: 0.7
            });

            const content = completion.choices[0].message.content;

            // Validate JSON
            try {
                const parsed = JSON.parse(content);
                return parsed; // Return Object, Controller will handle it
            } catch (e) {
                console.error("JSON Parse Error in Coach:", e);
                return {
                    dialogue: "Internal error in Alex's brain. Let's continue...",
                    feedback: null
                };
            }

        } catch (error) {
            console.error("Interview Coach Error:", error);
            return {
                dialogue: "I'm having trouble connecting to my evaluation matrix.",
                feedback: null
            };
        }
    }
}

module.exports = new InterviewCoach();
