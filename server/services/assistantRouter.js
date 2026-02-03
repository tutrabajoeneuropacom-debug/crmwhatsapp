/**
 * ASSISTANT ROUTER
 * Routes incoming messages to the appropriate specialized assistant module
 */

const entrepreneurAssistant = require('./assistants/entrepreneurAssistant');
const elderlyCareAssistant = require('./assistants/elderlyCareAssistant');
const genericAssistant = require('./assistants/genericAssistant');

class AssistantRouter {
    constructor(supabase) {
        this.supabase = supabase;
        this.assistants = {
            'entrepreneur': entrepreneurAssistant,
            'elderly_care': elderlyCareAssistant,
            'generic': genericAssistant
        };
    }

    /**
     * Route message to appropriate assistant
     */
    async routeMessage(whatsappAccountId, message) {
        try {
            // 1. Get WhatsApp account config
            const { data: account, error: accountError } = await this.supabase
                .from('whatsapp_accounts')
                .select(`
                    *,
                    bot_configs (
                        *,
                        assistant_types (*)
                    )
                `)
                .eq('id', whatsappAccountId)
                .single();

            if (accountError || !account) {
                console.error('Account not found:', accountError);
                return this.getDefaultResponse();
            }

            // 2. Get assistant type
            const assistantType = account.bot_configs?.assistant_types?.code || 'generic';
            const botConfig = account.bot_configs;

            console.log(`📍 Routing to assistant: ${assistantType}`);

            // 3. Get or create conversation
            const conversation = await this.getOrCreateConversation(
                whatsappAccountId,
                message.from
            );

            // 4. Save incoming message
            await this.saveMessage(conversation.id, message, 'inbound');

            // 5. Route to appropriate assistant
            const assistant = this.assistants[assistantType] || this.assistants['generic'];
            const response = await assistant.processMessage(message, botConfig, conversation);

            // 6. Save outgoing message
            await this.saveMessage(conversation.id, {
                content: response.text,
                is_ai_generated: true,
                ai_model: response.model || 'gpt-4o'
            }, 'outbound');

            // 7. Update conversation stats
            await this.updateConversationStats(conversation.id);

            return response;

        } catch (error) {
            console.error('Error routing message:', error);
            return this.getDefaultResponse();
        }
    }

    /**
     * Get or create conversation
     */
    async getOrCreateConversation(whatsappAccountId, customerPhone) {
        // Try to get existing conversation
        let { data: conversation } = await this.supabase
            .from('conversations')
            .select('*')
            .eq('whatsapp_account_id', whatsappAccountId)
            .eq('customer_phone', customerPhone)
            .eq('status', 'active')
            .single();

        // Create if doesn't exist
        if (!conversation) {
            const { data: newConv, error } = await this.supabase
                .from('conversations')
                .insert({
                    whatsapp_account_id: whatsappAccountId,
                    customer_phone: customerPhone,
                    status: 'active'
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating conversation:', error);
                throw error;
            }

            conversation = newConv;
        }

        return conversation;
    }

    /**
     * Save message to database
     */
    async saveMessage(conversationId, message, direction) {
        const { error } = await this.supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                direction,
                message_type: message.type || 'text',
                content: message.content || message.text,
                is_ai_generated: message.is_ai_generated || false,
                ai_model: message.ai_model,
                status: 'sent'
            });

        if (error) {
            console.error('Error saving message:', error);
        }
    }

    /**
     * Update conversation statistics
     */
    async updateConversationStats(conversationId) {
        await this.supabase.rpc('increment_conversation_message_count', {
            p_conversation_id: conversationId
        });
    }

    /**
     * Default fallback response
     */
    getDefaultResponse() {
        return {
            text: "Gracias por tu mensaje. Un asesor te responderá pronto.",
            model: 'fallback'
        };
    }
}

module.exports = AssistantRouter;
