/**
 * ATS Logic Simulator
 * Based on user-provided logic:
 * 1. Parsing (Simplified text extraction)
 * 2. Hard Filters (Knock-out questions)
 * 3. Keyword Matching & Scoring
 */

export const analyzeATS = (cvText, jobDescription) => {
    const findings = {
        score: 0,
        missing_keywords: [],
        critical_errors: [],
        found_keywords: [],
        feedback_summary: "",
        status: "pending"
    };

    // 1. NORMALIZATION
    const cleanCV = cvText.toLowerCase();
    const cleanJD = jobDescription.toLowerCase();

    // 2. EXTRACTION OF KEYWORDS FROM JD (Simple Frequency/Importance logic)
    // We look for common tech terms or capitalized words in the JD
    // For this simulation, we'll manually extract some based on heuristics or just use the whole JD text
    const commonStopWords = ['the', 'and', 'for', 'with', 'you', 'that', 'are', 'work', 'from'];
    const potentialKeywords = cleanJD.match(/\b[a-z]{3,}\b/g) || [];

    // Filter out common words to simulate "Entity Extraction"
    const uniqueKeywords = [...new Set(potentialKeywords)].filter(w => !commonStopWords.includes(w));

    // In a real app, we'd compare against a diverse tech dictionary. 
    // Here we take top frequent words or specific known skills.
    const hardSkills = ['react', 'javascript', 'node', 'python', 'sql', 'aws', 'english', 'ingles', 'visa', 'remote', 'remoto'];

    const targetKeywords = uniqueKeywords.filter(w => hardSkills.includes(w) || w.length > 5).slice(0, 15);

    // 3. HARD FILTERS (KNOCK-OUT)
    const knockOutTerms = ['visa', 'permit', 'b2', 'english', 'titulo'];
    let knockOutHit = false;

    // Example Knock-out logic: If JD mentions "Visa" and CV doesn't, flagged
    if (cleanJD.includes('visa') && !cleanCV.includes('visa')) {
        findings.critical_errors.push("Filtro Eliminatorio: La oferta menciona 'Visa' y tu CV no especifica status migratorio.");
        // knockOutHit = true; // In strict mode this kills the score
    }

    if ((cleanJD.includes('english') || cleanJD.includes('ingles')) &&
        (!cleanCV.includes('english') && !cleanCV.includes('ingles') && !cleanCV.includes('b2') && !cleanCV.includes('c1'))) {
        findings.critical_errors.push("Filtro Idioma: Requisito de Inglés no detectado en CV.");
        knockOutHit = true;
    }

    // 4. SCORING & MATCHING
    let totalPossibleScore = targetKeywords.length * 10;
    let currentScore = 0;

    targetKeywords.forEach(keyword => {
        if (cleanCV.includes(keyword)) {
            currentScore += 10;
            findings.found_keywords.push(keyword);
        } else {
            findings.missing_keywords.push(keyword);
        }
    });

    // 5. PENALTIES
    // If CV is short
    if (cleanCV.length < 500) {
        findings.critical_errors.push("Longitud: CV demasiado corto (posible falta de detalle).");
        currentScore -= 20;
    }

    // 6. CALCULATE FINAL SCORE
    // Normalize to 0-100
    if (totalPossibleScore === 0) totalPossibleScore = 1; // Div/0 safety
    let finalPercentage = Math.round((currentScore / totalPossibleScore) * 100);

    // Cap at 100, Min at 0
    finalPercentage = Math.min(100, Math.max(0, finalPercentage));

    if (knockOutHit) {
        finalPercentage = Math.min(finalPercentage, 40); // Cap score if knockout hit
        findings.feedback_summary = "Tu CV ha sido descartado por filtros duros (Requisitos Excluyentes).";
    } else if (finalPercentage >= 80) {
        findings.feedback_summary = "Excelente compatibilidad. Tu CV pasará a revisión humana.";
    } else if (finalPercentage >= 50) {
        findings.feedback_summary = "Rendimiento medio. Agrega las palabras clave faltantes para asegurar pasar el filtro.";
    } else {
        findings.feedback_summary = "Baja compatibilidad. El ATS probablemente descarte tu perfil automáticamente.";
    }

    findings.score = finalPercentage;

    return findings;
};
