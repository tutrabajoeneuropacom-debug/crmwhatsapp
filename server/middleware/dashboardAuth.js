// Fail-fast in production if dashboard key is missing
if (process.env.NODE_ENV === 'production' && !process.env.DASHBOARD_API_KEY) {
    throw new Error('DASHBOARD_API_KEY is required in production. Set DASHBOARD_API_KEY in the environment.');
}

/**
 * Simple API key authentication for dashboard
 * Accepts header 'x-api-key' or query param 'api_key'
 */
function authenticateDashboard(req, res, next) {
    const apiKey = (req.headers['x-api-key'] || req.query.api_key || '').toString();
    const validKey = process.env.DASHBOARD_API_KEY;

    // If no dashboard key is configured (non-production), allow access but warn
    if (!validKey) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️ DASHBOARD_API_KEY not configured - dashboard endpoints are unprotected in this environment.');
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!apiKey || apiKey !== validKey) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}

/**
 * Redact sensitive information from logs.
 */
function redactSensitive(log) {
    const redacted = { ...log };

    if (redacted.from && typeof redacted.from === 'string') {
        redacted.from = redacted.from.replace(/(\d{0,})(\d{4})$/, (m, g1, g2) => {
            if ((g1 + g2).length >= 8) return '****' + g2;
            return g1 + g2;
        });
    }

    if (typeof redacted.body === 'string') {
        redacted.body = redacted.body.replace(/sk-[a-zA-Z0-9_-]{8,}/g, 'sk-***REDACTED***');
        redacted.body = redacted.body.replace(/EAA[a-zA-Z0-9_-]{10,}/g, 'EAA***REDACTED***');
        redacted.body = redacted.body.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g, '***@***.***');
    }

    return redacted;
}

module.exports = {
    authenticateDashboard,
    redactSensitive
};
