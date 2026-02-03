/**
 * Webhook Security Middleware
 * Validates Meta WhatsApp webhook signatures
 */

const crypto = require('crypto');

/**
 * Middleware to verify webhook signature from Meta
 * @param {string} appSecret - WhatsApp App Secret from Meta
 */
function verifyWebhookSignature(appSecret) {
    return (req, res, next) => {
        // Skip verification for GET requests (challenge verification)
        if (req.method === 'GET') {
            return next();
        }

        const signature = req.headers['x-hub-signature-256'];

        if (!signature) {
            console.error('❌ Missing X-Hub-Signature-256 header');
            return res.status(401).json({ error: 'Missing signature' });
        }

        // Use raw body for signature verification
        const rawBody = req.rawBody;

        if (!rawBody) {
            console.error('❌ Raw body not available for signature verification');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Calculate expected signature
        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', appSecret)
            .update(rawBody)
            .digest('hex');

        // Constant-time comparison to prevent timing attacks
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );

        if (!isValid) {
            console.error('❌ Invalid webhook signature');
            return res.status(403).json({ error: 'Invalid signature' });
        }

        console.log('✅ Webhook signature verified');
        next();
    };
}

/**
 * Middleware to capture raw body for signature verification
 * Must be used BEFORE express.json()
 */
function captureRawBody(req, res, buf, encoding) {
    if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || 'utf8');
    }
}

module.exports = {
    verifyWebhookSignature,
    captureRawBody
};
