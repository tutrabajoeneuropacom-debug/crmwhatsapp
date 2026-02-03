// Minimal WhatsApp Cloud API Server
// No Baileys, No Supabase - Just the essentials

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('🚀 Starting WhatsApp Cloud API Server...');

// WhatsApp Cloud API Service
const whatsappCloudAPI = require('./services/whatsappCloudAPI');

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WhatsApp Cloud API Server Running',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    server: 'whatsapp-cloud-api-server',
    mode: 'WhatsApp Cloud API (Meta)',
    checks: {
      whatsapp_configured: !!process.env.WHATSAPP_ACCESS_TOKEN,
      openai: !!process.env.OPENAI_API_KEY
    },
    timestamp: new Date().toISOString()
  });
});

// WhatsApp Cloud API Status
app.get('/api/whatsapp/cloud/status', (req, res) => {
  res.json(whatsappCloudAPI.getStatus());
});

// Webhook Verification (GET) - Meta requires this
app.get('/api/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = whatsappCloudAPI.verifyWebhook(mode, token, challenge);

  if (result) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(result);
  } else {
    console.error('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// Webhook Message Handler (POST) - Receives incoming messages
app.post('/api/webhook/whatsapp', async (req, res) => {
  try {
    console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));

    // Process the webhook
    const messageData = await whatsappCloudAPI.processWebhook(req.body);

    if (messageData && messageData.text) {
      const { from, text, name } = messageData;

      console.log(`💬 Message from ${name || from}: ${text}`);

      // Simple AI response (without complex routing for now)
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });

        const systemPrompt = `Eres un asistente virtual de Career Mastery Engine, una plataforma de preparación para entrevistas laborales y optimización de CVs.

Tu rol es:
- Ayudar a usuarios con información sobre visas de trabajo
- Responder preguntas sobre preparación de entrevistas
- Explicar cómo mejorar CVs para sistemas ATS
- Ser amigable, profesional y conciso (máximo 2-3 líneas por respuesta)

Si te preguntan por precios o planes, menciona que tenemos planes freemium y premium.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          max_tokens: 150
        });

        const replyText = completion.choices[0].message.content;

        // Send reply via Cloud API
        await whatsappCloudAPI.sendMessage(from, replyText);
        console.log(`✅ Replied to ${from}: ${replyText.substring(0, 30)}...`);

      } catch (aiError) {
        console.error(`❌ AI Response Error: ${aiError.message}`);
        // Fallback response
        await whatsappCloudAPI.sendMessage(from,
          "Gracias por tu mensaje. Un asesor te responderá pronto."
        );
      }
    }

    // Always respond 200 OK to Meta
    res.sendStatus(200);

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.sendStatus(500);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Webhook URL: /api/webhook/whatsapp`);
  console.log(`🤖 WhatsApp Cloud API Status: ${whatsappCloudAPI.getStatus().configured ? 'Configured' : 'Not Configured'}`);
});
