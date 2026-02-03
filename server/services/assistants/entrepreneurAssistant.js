/**
 * ENTREPRENEUR ASSISTANT
 * Specialized assistant for entrepreneurs and small businesses
 * Focus: Lead generation, customer support, sales
 */

const aiRouter = require('../aiRouter');

class EntrepreneurAssistant {
    constructor() {
        this.name = 'Entrepreneur Assistant';
    }

    /**
     * Process incoming message
     */
    async processMessage(message, botConfig, conversation) {
        const text = message.text || message.content;

        // 1. Detect intent
        const intent = await this.detectIntent(text);

        console.log(`🎯 Intent detected: ${intent}`);

        // 2. Build context-aware system prompt
        const systemPrompt = this.buildSystemPrompt(botConfig, intent);

        // 3. Get conversation history (last 10 messages)
        const history = await this.getConversationHistory(conversation.id);

        // 4. Generate AI response
        const response = await aiRouter.chat(
            [
                ...history,
                { role: 'user', content: text }
            ],
            { llm: 'gpt-4o' },
            systemPrompt
        );

        // 5. Execute actions based on intent
        await this.executeActions(intent, message, conversation, botConfig);

        return {
            text: response.text,
            model: 'gpt-4o',
            intent
        };
    }

    /**
     * Detect user intent using keywords and AI
     */
    async detectIntent(text) {
        const lowerText = text.toLowerCase();

        // Keyword-based detection (fast)
        if (lowerText.match(/precio|costo|cuanto|tarifa|cotiz/)) {
            return 'pricing_inquiry';
        }
        if (lowerText.match(/agendar|cita|reunión|horario|disponibilidad/)) {
            return 'schedule_appointment';
        }
        if (lowerText.match(/comprar|adquirir|contratar|quiero/)) {
            return 'purchase_intent';
        }
        if (lowerText.match(/información|detalles|características|qué es/)) {
            return 'product_info';
        }
        if (lowerText.match(/problema|error|no funciona|ayuda|soporte/)) {
            return 'support_request';
        }
        if (lowerText.match(/hola|buenos|buenas|saludos/)) {
            return 'greeting';
        }

        // Default
        return 'general_inquiry';
    }

    /**
     * Build specialized system prompt
     */
    buildSystemPrompt(botConfig, intent) {
        const basePrompt = botConfig.system_prompt || `Eres un asistente virtual profesional para ${botConfig.business_description || 'un negocio'}.`;

        const intentPrompts = {
            'pricing_inquiry': `
${basePrompt}

El usuario está preguntando por precios. Proporciona información clara sobre:
- ${botConfig.pricing_info || 'Nuestros servicios tienen precios competitivos'}
- Ofrece agendar una llamada para cotización personalizada
- Captura su email o nombre para seguimiento
`,
            'schedule_appointment': `
${basePrompt}

El usuario quiere agendar una cita. 
- Pregunta qué día y hora prefiere
- Menciona horarios disponibles: ${botConfig.business_hours || 'Lunes a Viernes 9am-6pm'}
- Confirma sus datos de contacto
`,
            'purchase_intent': `
${basePrompt}

El usuario tiene intención de compra. ¡Excelente!
- Confirma qué producto/servicio le interesa
- Explica el proceso de compra
- Captura sus datos para procesar el pedido
- Sé entusiasta pero profesional
`,
            'product_info': `
${basePrompt}

El usuario quiere información sobre productos/servicios:
${botConfig.products_services || '- Consultoría\n- Servicios profesionales'}

Sé detallado pero conciso. Ofrece agendar una demo si aplica.
`,
            'support_request': `
${basePrompt}

El usuario necesita soporte técnico.
- Escucha su problema con empatía
- Ofrece soluciones inmediatas si es posible
- Si es complejo, crea un ticket y asegura seguimiento
`,
            'greeting': `
${basePrompt}

Saluda de forma amigable y profesional.
Presenta brevemente lo que ofreces y pregunta cómo puedes ayudar.
`
        };

        return intentPrompts[intent] || basePrompt;
    }

    /**
     * Execute actions based on intent
     */
    async executeActions(intent, message, conversation, botConfig) {
        const actions = {
            'pricing_inquiry': async () => {
                // Create lead
                await this.createLead(conversation, message, 'pricing_inquiry');
            },
            'schedule_appointment': async () => {
                // Create lead + tag as "wants_appointment"
                await this.createLead(conversation, message, 'appointment');
            },
            'purchase_intent': async () => {
                // High-value lead
                await this.createLead(conversation, message, 'hot_lead', 80);
            },
            'support_request': async () => {
                // Create support ticket
                await this.createSupportTicket(conversation, message);
            }
        };

        const action = actions[intent];
        if (action) {
            await action();
        }
    }

    /**
     * Create lead in CRM
     */
    async createLead(conversation, message, source, score = 50) {
        // TODO: Implement Supabase lead creation
        console.log(`📊 Lead created: ${conversation.customer_phone} (${source})`);
    }

    /**
     * Create support ticket
     */
    async createSupportTicket(conversation, message) {
        // TODO: Implement support ticket system
        console.log(`🎫 Support ticket created for ${conversation.customer_phone}`);
    }

    /**
     * Get conversation history
     */
    async getConversationHistory(conversationId, limit = 10) {
        // TODO: Fetch from Supabase
        return [];
    }
}

module.exports = new EntrepreneurAssistant();
