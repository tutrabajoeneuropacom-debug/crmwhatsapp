/**
 * Profile Rules Engine
 * Maps user profile data (Goals, Level, Interests) to:
 * 1. Teaching Strategy (System Prompt)
 * 2. Plan Limits (Freemium/Pro)
 */

const getPlanConfig = (profile) => {
    // Default Config
    let config = {
        planId: 'basic_general',
        systemPrompt: {
            role: 'system',
            content: 'You are a helpful language tutor.'
        },
        limits: {
            dailyMessages: 10, // Increased from 2 for "Magic" demo
            features: ['chat', 'pronunciation']
        }
    };

    if (!profile) return config;

    // 1. Determine Teaching Style based on Goal
    let teachingFocus = '';
    switch (profile.goal) {
        case 'trabajo_remoto':
            teachingFocus = 'Focus on business english, interview preparation, email etiquette, and remote work vocabulary.';
            config.planId = 'remote_pro';
            break;
        case 'viajar':
            teachingFocus = 'Focus on travel survival skills, asking for directions, ordering food, and social small talk.';
            config.planId = 'travel_explorer';
            break;
        case 'estudio_examen':
            teachingFocus = 'Focus on academic language, formal grammar, structure, and exam preparation tips (TOEFL/IELTS style).';
            config.planId = 'academic_scholar';
            break;
        case 'migrar':
            teachingFocus = 'Focus on daily life integration, bureaucracy, renting apartments, and understanding local culture.';
            config.planId = 'expat_life';
            break;
        default:
            teachingFocus = 'Focus on general conversation and fluency.';
    }

    // 2. Adjust Complexity based on Level
    let levelInstruction = '';
    switch (profile.level) {
        case 'principiante':
            levelInstruction = 'Use simple words, short sentences, and be very encouraging. Correct major errors only.';
            break;
        case 'intermedio':
            levelInstruction = 'Use natural conversational speed. Introduce synonyms. Correct frequent grammar errors.';
            break;
        case 'avanzado':
            levelInstruction = 'Speak at native speed. Use idioms and complex structures. Be strict with nuance and pronunciation.';
            break;
        default:
            levelInstruction = 'Adjust difficulty to the user\'s responses.';
    }

    // 3. Integrate Interests
    const interestList = profile.interests && profile.interests.length > 0
        ? profile.interests.join(', ')
        : 'general topics';

    // 4. Construct Dynamic System Prompt
    const promptContent = `
    Act as a professional language tutor specializing in ${profile.goal || 'General Learning'}.
    User Level: ${profile.level || 'Unknown'}.
    User Interests: ${interestList}.
    
    Teaching Strategy:
    ${teachingFocus}
    ${levelInstruction}
    
    IMPORTANT:
    - Keep responses concise and conversational.
    - Always answer in the target language (English/Spanish/French depending on context, default English if not specified).
    - If the user switches language, switch with them but encourage practical use.
  `.trim();

    config.systemPrompt = {
        role: 'system',
        content: promptContent
    };

    return config;
};

module.exports = { getPlanConfig };
