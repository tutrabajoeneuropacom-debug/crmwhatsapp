const fs = require('fs');
const path = require('path');
const commonPhrases = require('../data/commonPhrases.json');

const AUDIO_CACHE_DIR = path.join(__dirname, '../cache_audio');

// Ensure cache dir exists
if (!fs.existsSync(AUDIO_CACHE_DIR)) {
    fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
}

class SmartCache {

    /**
     * Normalizes text for cache lookup (lowercase, remove punctuation)
     */
    normalize(text) {
        return text.toLowerCase().replace(/[¿?¡!.,]/g, '').trim();
    }

    /**
     * Generates a unique filename for the audio cache
     */
    getCacheKey(text, lang) {
        // Simple hash for filesystem safety
        // In prod, use md5 or sha256
        const validChars = text.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        return `${validChars}_${lang}`;
    }

    /**
     * Checks if we have a hardcoded common translation
     */
    checkCommon(text, fromLang, toLang) {
        const norm = this.normalize(text);
        if (commonPhrases[fromLang] && commonPhrases[fromLang][norm]) {
            const translation = commonPhrases[fromLang][norm];
            // Check specific target lang
            if (typeof translation === 'object') {
                return translation[toLang]; // Might be undefined
            }
            return translation; // Should be object structure above, but just in case
        }
        return null;
    }

    /**
     * Checks if valid audio exists on disk
     */
    getAudio(text, lang) {
        const key = this.getCacheKey(text, lang);
        const filePath = path.join(AUDIO_CACHE_DIR, `${key}.mp3`);

        if (fs.existsSync(filePath)) {
            console.log(`[SMART-CACHE] Hit Audio: ${key}`);
            return fs.readFileSync(filePath).toString('base64');
        }
        return null;
    }

    /**
     * Saves generated audio to disk
     */
    saveAudio(text, lang, audioBuffer) {
        try {
            const key = this.getCacheKey(text, lang);
            const filePath = path.join(AUDIO_CACHE_DIR, `${key}.mp3`);
            fs.writeFileSync(filePath, audioBuffer);
            console.log(`[SMART-CACHE] Saved Audio: ${key}`);
        } catch (e) {
            console.error("Cache Save Error", e);
        }
    }
}

module.exports = new SmartCache();
