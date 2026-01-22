/**
 * WhatsApp Cloud API Service
 * Official Meta WhatsApp Business API Integration
 */

const axios = require('axios');

class WhatsAppCloudAPI {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
        this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

        if (!this.accessToken || !this.phoneNumberId) {
            console.warn('⚠️ WhatsApp Cloud API credentials not configured');
        } else {
            console.log('✅ WhatsApp Cloud API initialized');
            console.log(`   Phone Number ID: ${this.phoneNumberId}`);
        }
    }

    /**
     * Send a text message
     */
    async sendMessage(to, text) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { body: text }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Message sent to ${to}`);
            return response.data;
        } catch (error) {
            console.error('❌ Error sending message:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send a template message
     */
    async sendTemplate(to, templateName, languageCode = 'es') {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'template',
                    template: {
                        name: templateName,
                        language: { code: languageCode }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Template sent to ${to}`);
            return response.data;
        } catch (error) {
            console.error('❌ Error sending template:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Mark message as read
     */
    async markAsRead(messageId) {
        try {
            await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`✅ Message ${messageId} marked as read`);
        } catch (error) {
            console.error('❌ Error marking as read:', error.response?.data || error.message);
        }
    }

    async getMediaUrl(mediaId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${mediaId}`,
                {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                }
            );
            return response.data.url;
        } catch (error) {
            console.error('❌ Error getting media URL:', error.response?.data || error.message);
            throw error;
        }
    }

    async uploadMedia(buffer, mimeType) {
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', buffer, { filename: 'audio.mp3', contentType: mimeType });
            form.append('type', 'audio/mpeg');
            form.append('messaging_product', 'whatsapp');

            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/media`,
                form,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        ...form.getHeaders()
                    }
                }
            );
            return response.data.id;
        } catch (error) {
            console.error('❌ Error uploading media:', error.response?.data || error.message);
            throw error;
        }
    }

    async sendAudio(to, mediaId) {
        try {
            await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'audio',
                    audio: { id: mediaId }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`✅ Audio sent to ${to}`);
        } catch (error) {
            console.error('❌ Error sending audio:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Process incoming webhook message
     */
    async processWebhook(body) {
        try {
            // Extract message data from webhook
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const messages = value?.messages;

            if (!messages || messages.length === 0) {
                console.log('ℹ️ No messages in webhook');
                return null;
            }

            const message = messages[0];
            const from = message.from;
            const messageId = message.id;
            const messageType = message.type;

            let text = null;
            let audio = null;

            if (messageType === 'text') {
                text = message.text?.body;
            } else if (messageType === 'audio') {
                audio = message.audio;
            }

            console.log(`📨 Received ${messageType} from ${from}`);

            // Mark as read
            await this.markAsRead(messageId);

            return {
                from,
                messageId,
                text,
                audio, // { id, mime_type }
                type: messageType,
                timestamp: message.timestamp,
                name: value.contacts?.[0]?.profile?.name
            };
        } catch (error) {
            console.error('❌ Error processing webhook:', error);
            return null;
        }
    }

    // ... verification methods ...

    /**
     * Verify webhook (for Meta setup)
     */
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.webhookVerifyToken) {
            console.log('✅ Webhook verified');
            return challenge;
        } else {
            console.error('❌ Webhook verification failed');
            return null;
        }
    }

    /**
     * Get API status
     */
    getStatus() {
        return {
            configured: !!(this.accessToken && this.phoneNumberId),
            phoneNumberId: this.phoneNumberId,
            apiVersion: this.apiVersion
        };
    }
}

module.exports = new WhatsAppCloudAPI();
