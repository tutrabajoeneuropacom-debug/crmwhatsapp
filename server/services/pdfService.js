const pdf = require('pdf-parse');

async function extractTextFromPDF(buffer) {
    try {
        const data = await pdf(buffer);
        // Basic cleanup: remove excessive whitespace
        return data.text.replace(/\s+/g, ' ').trim();
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to extract text from PDF');
    }
}

module.exports = { extractTextFromPDF };
