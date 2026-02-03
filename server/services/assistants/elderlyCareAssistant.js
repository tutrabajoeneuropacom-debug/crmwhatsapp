/**
 * ELDERLY CARE ASSISTANT
 * Specialized assistant for elderly care and health monitoring
 * Focus: Safety, medication reminders, emergency detection, companionship
 */

const aiRouter = require('../aiRouter');

class ElderlyCareAssistant {
    constructor() {
        this.name = 'Elderly Care Assistant';

        // Emergency keywords (Spanish)
        this.emergencyKeywords = [
            'dolor pecho', 'dolor corazón', 'no puedo respirar', 'falta aire',
            'caída', 'caí', 'me caí', 'golpe fuerte',
            'mareo', 'mareado', 'desmayo', 'desmayé',
            'sangre', 'sangrando', 'hemorragia',
            'confusión', 'confundido', 'desorientado',
            'ayuda urgente', 'emergencia', 'auxilio',
            'muy mal', 'grave', 'crítico'
        ];

        // Health concern keywords
        this.healthConcernKeywords = [
            'dolor', 'duele', 'molestia',
            'fiebre', 'temperatura',
            'náusea', 'vómito',
            'presión alta', 'presión baja',
            'cansancio extremo', 'debilidad'
        ];
    }

    /**
     * Process incoming message
     */
    async processMessage(message, botConfig, conversation) {
        const text = message.text || message.content;

        // 1. CRITICAL: Check for emergency
        const isEmergency = this.detectEmergency(text);
        if (isEmergency) {
            console.log('🚨 EMERGENCY DETECTED!');
            await this.handleEmergency(text, conversation, botConfig);
            return {
                text: this.getEmergencyResponse(),
                model: 'emergency-protocol',
                isEmergency: true
            };
        }

        // 2. Check for health concerns
        const isHealthConcern = this.detectHealthConcern(text);
        const urgencyLevel = isHealthConcern ? 'medium' : 'low';

        // 3. Build empathetic system prompt
        const systemPrompt = this.buildSystemPrompt(botConfig, urgencyLevel);

        // 4. Get conversation history
        const history = await this.getConversationHistory(conversation.id);

        // 5. Generate AI response
        const response = await aiRouter.chat(
            [
                ...history,
                { role: 'user', content: text }
            ],
            { llm: 'gpt-4o', temperature: 0.7 },
            systemPrompt
        );

        // 6. Log health concern if detected
        if (isHealthConcern) {
            await this.logHealthConcern(conversation, text);
        }

        return {
            text: response.text,
            model: 'gpt-4o',
            urgencyLevel
        };
    }

    /**
     * Detect emergency situations
     */
    detectEmergency(text) {
        const lowerText = text.toLowerCase();

        return this.emergencyKeywords.some(keyword =>
            lowerText.includes(keyword)
        );
    }

    /**
     * Detect health concerns (non-emergency)
     */
    detectHealthConcern(text) {
        const lowerText = text.toLowerCase();

        return this.healthConcernKeywords.some(keyword =>
            lowerText.includes(keyword)
        );
    }

    /**
     * Handle emergency situation
     */
    async handleEmergency(text, conversation, botConfig) {
        console.log('🚨 EMERGENCY PROTOCOL ACTIVATED');

        // 1. Get emergency contacts from config
        const emergencyContacts = botConfig.specialized_config?.emergency_contacts || [];

        // 2. Send alerts to all emergency contacts
        for (const contact of emergencyContacts) {
            await this.sendEmergencyAlert(contact, {
                elderlyName: conversation.customer_name || conversation.customer_phone,
                message: text,
                timestamp: new Date().toISOString(),
                phone: conversation.customer_phone
            });
        }

        // 3. Log emergency event
        await this.logEmergencyEvent(conversation, text);

        // 4. TODO: Optionally call 911 API if configured
        // await this.call911IfConfigured(botConfig, conversation);
    }

    /**
     * Send emergency alert to contact
     */
    async sendEmergencyAlert(contact, emergencyData) {
        // TODO: Implement WhatsApp/SMS/Email alert
        console.log(`📧 Emergency alert sent to ${contact.name} (${contact.phone})`);
        console.log(`   Message: ${emergencyData.message}`);

        // Example alert message:
        const alertMessage = `
🚨 ALERTA DE EMERGENCIA 🚨

${emergencyData.elderlyName} necesita ayuda urgente.

Mensaje recibido: "${emergencyData.message}"

Hora: ${new Date(emergencyData.timestamp).toLocaleString('es-AR')}
Teléfono: ${emergencyData.phone}

Por favor, contacte inmediatamente.
        `.trim();

        // Send via WhatsApp Cloud API
        // await whatsappCloudAPI.sendMessage(contact.phone, alertMessage);
    }

    /**
     * Get emergency response message
     */
    getEmergencyResponse() {
        return `🚨 Entiendo que necesitas ayuda urgente.

He notificado a tus contactos de emergencia inmediatamente.

¿Puedes decirme:
1. ¿Estás en un lugar seguro?
2. ¿Puedes moverte?
3. ¿Hay alguien cerca que pueda ayudarte?

Mantente en línea. La ayuda está en camino.`;
    }

    /**
     * Build empathetic system prompt
     */
    buildSystemPrompt(botConfig, urgencyLevel) {
        const baseName = botConfig.bot_name || 'Asistente';
        const elderlyName = botConfig.specialized_config?.elderly_name || 'amigo/a';

        const basePrompt = `Eres ${baseName}, un asistente de cuidado para adultos mayores.

Estás hablando con ${elderlyName}.

IMPORTANTE:
- Habla con PACIENCIA, CLARIDAD y EMPATÍA
- Usa frases cortas y simples
- Sé cálido/a y amigable
- Nunca des consejos médicos definitivos
- Si detectas algo preocupante, sugiere contactar al médico
- Recuerda que puedes ser la única compañía del día

TONO: Como un nieto/a cariñoso/a que cuida a su abuelo/a.`;

        if (urgencyLevel === 'medium') {
            return `${basePrompt}

⚠️ SITUACIÓN: El usuario mencionó un síntoma o molestia de salud.

PROTOCOLO:
1. Pregunta con calma sobre el síntoma
2. Evalúa si es urgente (dolor intenso, dificultad para respirar, etc.)
3. Si es urgente, recomienda llamar al médico o familiar
4. Si no es urgente, ofrece compañía y sugiere descanso
5. Registra mentalmente para informar a familiares`;
        }

        return basePrompt;
    }

    /**
     * Log health concern
     */
    async logHealthConcern(conversation, text) {
        // TODO: Save to database for family dashboard
        console.log(`⚠️ Health concern logged for ${conversation.customer_phone}: ${text}`);
    }

    /**
     * Log emergency event
     */
    async logEmergencyEvent(conversation, text) {
        // TODO: Save to database with high priority
        console.log(`🚨 Emergency event logged for ${conversation.customer_phone}: ${text}`);
    }

    /**
     * Get conversation history
     */
    async getConversationHistory(conversationId, limit = 10) {
        // TODO: Fetch from Supabase
        return [];
    }

    /**
     * Send medication reminder (called by cron job)
     */
    async sendMedicationReminder(conversation, medication) {
        const message = `💊 Recordatorio de Medicamento

Hola! Es hora de tomar tu ${medication.name}.

Dosis: ${medication.dosage}
Horario: ${medication.time}

¿Ya lo tomaste? Responde "Sí" para confirmar.`;

        // TODO: Send via WhatsApp
        console.log(`💊 Medication reminder sent: ${medication.name}`);
    }

    /**
     * Daily check-in (called by cron job)
     */
    async sendDailyCheckIn(conversation) {
        const greetings = [
            '¡Buenos días! ☀️ ¿Cómo amaneciste hoy?',
            '¡Hola! 👋 ¿Cómo te sientes esta mañana?',
            '¡Buen día! 🌻 ¿Dormiste bien?'
        ];

        const message = greetings[Math.floor(Math.random() * greetings.length)];

        // TODO: Send via WhatsApp
        console.log(`☀️ Daily check-in sent`);
    }
}

module.exports = new ElderlyCareAssistant();
