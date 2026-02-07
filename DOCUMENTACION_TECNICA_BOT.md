# 📋 DOCUMENTACIÓN TÉCNICA - BOT DE WHATSAPP
**Proyecto:** WhatsApp Conversational Core  
**Versión:** 1.1.0 (Producción Activa)  
**Fecha de Análisis:** 07 Febrero 2026  
**Estado:** Activo y Operativo (crmwhatsapp-xari.onrender.com)

---

## 🏗️ ARQUITECTURA GENERAL

### Stack Tecnológico
- **Runtime:** Node.js >= 16.0.0
- **Framework Web:** Express 4.18.2
- **API de WhatsApp:** Meta WhatsApp Cloud API (v18.0)
- **IA Conversacional:** OpenAI GPT-4o
- **Text-to-Speech:** ElevenLabs (Voz: Rachel)
- **Speech-to-Text:** OpenAI Whisper
- **Base de Datos:** Supabase (Opcional - Para logging)
- **CRM:** Copper (Opcional - Para sincronización de contactos)

### Punto de Entrada
**Archivo Principal:** `index-minimal.js`  
**Puerto:** 3000 (configurable vía `PORT` env var)  
**Comando de Inicio:** `npm start` → `node index-minimal.js`

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
server/
├── index-minimal.js          # Servidor principal (ACTIVO)
├── index.js                  # Servidor alternativo (NO USADO)
├── package.json              # Dependencias y scripts
├── .env                      # Variables de entorno (SECRETO)
├── services/
│   ├── whatsappCloudAPI.js   # Cliente de Meta WhatsApp Cloud API
│   ├── aiRouter.js           # Enrutador de modelos de IA
│   ├── translator.js         # Servicio de traducción
│   ├── copperService.js      # Integración con Copper CRM
│   └── usageLogger.js        # Logger de uso para dashboard
└── scripts/                  # Scripts de diagnóstico y pruebas
```

---

## 🔑 VARIABLES DE ENTORNO REQUERIDAS

### WhatsApp Cloud API (Meta)
```env
WHATSAPP_ACCESS_TOKEN=EAAMsKI3akgc...  # Token de acceso (24h temporal o permanente)
WHATSAPP_PHONE_NUMBER_ID=929376966931764  # ID del número de WhatsApp Business
WHATSAPP_API_VERSION=v18.0  # Versión de la API de Meta
WHATSAPP_WEBHOOK_VERIFY_TOKEN=mi_token_secreto_123  # Token de verificación del webhook
```

### Servicios de IA
```env
OPENAI_API_KEY=sk-proj-iJcU3F7D...  # API Key de OpenAI (GPT-4o + Whisper)
ELEVENLABS_API_KEY=sk_b577f7fa...  # API Key de ElevenLabs (TTS)
```

### Servicios Opcionales
```env
SUPABASE_URL=https://your-project.supabase.co  # URL de Supabase
SUPABASE_SERVICE_ROLE_KEY=your-key  # Service Role Key de Supabase
PORT=3000  # Puerto del servidor (default: 3000)
```

---

## 🔄 FLUJO DE FUNCIONAMIENTO

### 1. Inicialización del Servidor
```javascript
1. Carga variables de entorno (.env)
2. Inicializa Express con CORS
3. Conecta a Supabase (si está configurado)
4. Inicializa WhatsApp Cloud API client
5. Levanta servidor en puerto 3000
```

### 2. Verificación del Webhook (GET)
**Endpoint:** `GET /api/webhook/whatsapp`  
**Propósito:** Meta verifica que el servidor es legítimo

```javascript
Flujo:
1. Meta envía: hub.mode, hub.verify_token, hub.challenge
2. Servidor valida: mode === 'subscribe' && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN
3. Si válido: Responde con hub.challenge (200 OK)
4. Si inválido: Responde 403 Forbidden
```

### 3. Recepción de Mensajes (POST)
**Endpoint:** `POST /api/webhook/whatsapp`  
**Propósito:** Recibir mensajes entrantes de usuarios

```javascript
Flujo Completo:
1. Meta envía webhook con estructura:
   {
     "entry": [{
       "changes": [{
         "value": {
           "messages": [{
             "from": "5491136427300",
             "type": "text|audio",
             "text": { "body": "Hola" },
             "audio": { "id": "...", "mime_type": "..." }
           }]
         }
       }]
     }]
   }

2. Servidor extrae datos del mensaje:
   - from (número del remitente)
   - type (text o audio)
   - text.body o audio.id

3. Si es AUDIO:
   a. Descarga el archivo de audio desde Meta
   b. Envía a OpenAI Whisper para transcripción
   c. Convierte audio → texto

4. Procesa el texto con IA:
   a. Envía a OpenAI GPT-4o con prompt del sistema
   b. Recibe respuesta de la IA

5. Envía respuesta al usuario:
   a. MODO ACTUAL: Solo texto
   b. MODO DESACTIVADO: Genera audio con ElevenLabs y envía nota de voz

6. Logging (opcional):
   a. Guarda en Supabase (usage_logs)
   b. Sincroniza contacto con Copper CRM

7. Responde 200 OK a Meta (siempre, incluso si hay error interno)
```

---

## 🎯 ENDPOINTS DISPONIBLES

### Health Checks
```
GET /health
→ Responde: "OK" (texto plano)

GET /api/health
→ Responde: { "status": "ok", "message": "...", "timestamp": "..." }
```

### Estado del Sistema
```
GET /
→ Responde: JSON con estado de configuración
{
  "status": "online",
  "server": "whatsapp-cloud-api-server",
  "mode": "WhatsApp Cloud API (Meta)",
  "checks": {
    "whatsapp_configured": true/false,
    "openai": true/false,
    "supabase_logging": true/false
  }
}

GET /api/whatsapp/cloud/status
→ Responde: Estado de WhatsApp Cloud API
{
  "configured": true,
  "phoneNumberId": "929376966931764",
  "apiVersion": "v18.0"
}
```

### Logs en Memoria
```
GET /api/logs
→ Responde: Array de últimos 50 eventos (mensajes enviados/recibidos)
```

### Webhook de WhatsApp
```
GET /api/webhook/whatsapp
→ Verificación del webhook (Meta)

POST /api/webhook/whatsapp
→ Recepción de mensajes entrantes
```

### Chat Web (Bonus)
```
POST /api/chat
Body: { "message": "...", "sessionId": "...", "userData": {...} }
→ Endpoint para widget de chat web (usa misma IA que WhatsApp)
```

---

## 🤖 CONFIGURACIÓN DE IA

### Prompt del Sistema (GPT-4o)
```
Eres un asistente virtual de Career Mastery Engine, una plataforma de 
preparación para entrevistas laborales y optimización de CVs.

Tu rol es:
- Ayudar a usuarios con información sobre visas de trabajo
- Responder preguntas sobre preparación de entrevistas
- Explicar cómo mejorar CVs para sistemas ATS
- Ser amigable, profesional y conciso (máximo 2-3 líneas por respuesta)

Si te preguntan por precios o planes, menciona que tenemos planes 
freemium y premium.
```

### Configuración de OpenAI
```javascript
Model: gpt-4o
Max Tokens: 150 (respuestas cortas)
Temperature: Default (no especificado, ~0.7)
```

### Configuración de ElevenLabs (DESACTIVADO)
```javascript
Voice ID: 21m00Tcm4TlvDq8ikWAM (Rachel)
Model: eleven_monolingual_v1
Settings: { stability: 0.5, similarity_boost: 0.75 }
```

---

## ⚠️ ESTADO ACTUAL DEL CÓDIGO

### ✅ Funcionalidades Implementadas
1. ✅ Verificación de webhook (GET)
2. ✅ Recepción de mensajes de texto
3. ✅ Recepción de mensajes de audio
4. ✅ Transcripción de audio (Whisper)
5. ✅ Respuestas con IA (GPT-4o)
6. ✅ Envío de mensajes de texto
7. ✅ Logging en memoria (últimos 50 eventos)
8. ✅ Integración con Supabase (opcional)
9. ✅ Integración con Copper CRM (opcional)
10. ✅ Endpoints de health check

### 🔴 Funcionalidades Desactivadas
1. ❌ Respuestas con voz (ElevenLabs TTS) - Línea 200: `if (false)`
2. ❌ Modo Debug activo - Código simplificado sin OpenAI (última versión en GitHub)

### 🔴 Servidores Inactivos / Deprecados
- `https://botserver2026.onrender.com` (Inactivo/Timeout)
- `https://bot-whatsapp-production.onrender.com` (Desconocido/Inaccesible)

### ⚠️ Problemas Conocidos

#### 1. **CRÍTICO: Mensajes Entrantes No Llegan**
**Síntoma:** El webhook se verifica correctamente (✅ verde en Meta), pero cuando un usuario envía un mensaje, el servidor NO recibe el POST.

**Diagnóstico:**
- Servidor: ✅ Funcionando (200 OK en /api/health)
- Webhook URL: ✅ Configurada correctamente
- Verify Token: ✅ Hardcodeado y funcional
- Test de Meta: ✅ Pasa (simulador)
- Mensajes reales: ❌ No llegan

**Causa Probable:**
- Meta está bloqueando el envío de mensajes reales por:
  a) Número de teléfono no autorizado en modo desarrollo
  b) Dominio `onrender.com` en lista gris de Meta
  c) Problema de suscripción al campo `messages` en webhook
  d) Limitación de cuenta de WhatsApp Business (calidad baja)

**Solución Pendiente:**
- Verificar en Meta > API Setup que el número está en la lista "To"
- Revisar Meta > Webhooks > messages (debe estar suscrito)
- Considerar cambiar a producción (sacar app de modo desarrollo)

#### 2. **Variables de Entorno en Render**
**Problema:** Render no inyecta correctamente las variables de entorno al crear el servicio.

**Workaround Aplicado:**
- Token de verificación hardcodeado en `whatsappCloudAPI.js` línea 14:
  ```javascript
  this.webhookVerifyToken = 'mi_token_secreto_123'; // Hardcoded for Debug
  ```

**Solución Definitiva:**
- Revertir hardcode
- Agregar variables en Render ANTES de crear el servicio
- O usar Render Secret Files

#### 3. **Código en Modo Debug**
**Estado Actual:** La última versión en GitHub tiene OpenAI desactivado y responde con eco:
```javascript
const replyText = `✅ ¡Te leo fuerte y claro! Soy Cooper (Modo Debug). Tu mensaje fue: "${userText}"`;
```

**Acción Requerida:**
- Restaurar código completo con OpenAI
- Quitar hardcode del token
- Hacer commit final "PRODUCTION READY"

---

## 🔧 SERVICIOS AUXILIARES

### whatsappCloudAPI.js
**Responsabilidad:** Cliente de la API de Meta WhatsApp Cloud

**Métodos Principales:**
```javascript
sendMessage(to, text)           // Enviar mensaje de texto
sendTemplate(to, templateName)  // Enviar plantilla aprobada
sendAudio(to, mediaId)          // Enviar nota de voz
markAsRead(messageId)           // Marcar mensaje como leído
getMediaUrl(mediaId)            // Obtener URL de descarga de media
uploadMedia(buffer, mimeType)   // Subir archivo a WhatsApp
processWebhook(body)            // Procesar webhook entrante
verifyWebhook(mode, token, challenge)  // Verificar webhook
getStatus()                     // Obtener estado de configuración
```

### copperService.js
**Responsabilidad:** Sincronización de contactos con Copper CRM

**Funcionalidad:**
- Crea/actualiza personas en Copper cuando llega un mensaje
- Almacena: nombre, teléfono, email (si disponible)
- Ejecuta de forma asíncrona (no bloquea respuesta)

### usageLogger.js
**Responsabilidad:** Logging de uso para dashboard

**Funcionalidad:**
- Registra cada interacción en Supabase
- Campos: input_text, translated_text, provider_llm, cost_estimated
- Permite análisis de costos y uso

---

## 📊 MÉTRICAS Y COSTOS ESTIMADOS

### Costos por Mensaje (Estimados)
```
Mensaje de Texto:
- GPT-4o (150 tokens): ~$0.003
- Total: ~$0.003

Mensaje de Audio:
- Whisper (transcripción): ~$0.006/min
- GPT-4o (150 tokens): ~$0.003
- Total: ~$0.009

Respuesta con Voz (DESACTIVADO):
- GPT-4o: ~$0.003
- ElevenLabs TTS: ~$0.002
- Total: ~$0.005
```

### Límites de WhatsApp Cloud API
```
Modo Desarrollo:
- Máximo 5 números de prueba
- Sin límite de mensajes a números autorizados

Modo Producción:
- Tier 1: 1,000 conversaciones únicas/24h
- Tier 2: 10,000 conversaciones únicas/24h
- Tier 3: 100,000 conversaciones únicas/24h
```

---

## 🚀 DESPLIEGUE

### Render (Actual)
```
URL: https://crmwhatsapp-xari.onrender.com
Región: Frankfurt (EU Central)
Plan: Free
Runtime: Node
Build Command: npm install
Start Command: npm start
```

### Variables de Entorno en Render
```
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_API_VERSION
OPENAI_API_KEY
ELEVENLABS_API_KEY
```

### GitHub
```
Repositorio: tutrabajoeneuropacom-debug/botserver2026
Rama: main
Último Commit: 86d5efb "DEBUG: Bypass OpenAI, simple echo bot"
```

---

## 🔐 SEGURIDAD

### Tokens y Credenciales
- ✅ `.env` en `.gitignore` (no se sube a GitHub)
- ⚠️ Token hardcodeado temporalmente en código (REVERTIR)
- ✅ Variables de entorno en Render (encriptadas)

### Validación de Webhook
- ✅ Verificación de token en GET
- ✅ Validación de estructura de payload en POST
- ✅ Manejo de errores sin exponer detalles internos

### Recomendaciones
1. Generar token permanente en Meta (no temporal de 24h)
2. Implementar rate limiting
3. Agregar autenticación para endpoints de admin
4. Implementar whitelist de números permitidos

---

## 📝 PRÓXIMOS PASOS RECOMENDADOS

### Inmediatos
1. ✅ Resolver problema de entrega de mensajes (Meta)
2. ✅ Revertir código debug a producción
3. ✅ Quitar hardcode del token de verificación
4. ✅ Generar token permanente en Meta

### Corto Plazo
1. Activar respuestas con voz (ElevenLabs)
2. Implementar contexto de conversación (memoria)
3. Agregar comandos especiales (/help, /start, etc.)
4. Mejorar manejo de errores y logging

### Mediano Plazo
1. Migrar a modo producción en Meta
2. Implementar sistema de colas (Bull/Redis)
3. Agregar analytics y métricas
4. Crear dashboard de administración
5. Implementar A/B testing de prompts

---

## 🐛 DEBUG Y TROUBLESHOOTING

### Verificar Estado del Sistema
```bash
# Health check
# Health check
curl https://crmwhatsapp-xari.onrender.com/api/health

# Estado de WhatsApp
curl https://crmwhatsapp-xari.onrender.com/api/whatsapp/cloud/status

# Logs recientes
curl https://crmwhatsapp-xari.onrender.com/api/logs
```

### Logs en Render
```
1. Ir a dashboard.render.com
2. Seleccionar servicio "crmwhatsapp-xari" (o similar)
3. Click en "Logs"
4. Buscar:
   - "📨 Webhook received" → Mensaje llegó
   - "🤖 Debug Reply" → Bot procesó
   - "❌" → Errores
```

### Probar Envío de Mensajes
```bash
# Desde terminal local
node server/test-outgoing-simple.js
```

### Verificar Webhook en Meta
```
1. Meta Developers > WhatsApp > Configuration
2. Webhook URL debe ser: https://crmwhatsapp-xari.onrender.com/api/webhook/whatsapp
3. Verify Token: mi_token_secreto_123
4. Campos suscritos: messages (✅)
```

---

## 📞 CONTACTO Y SOPORTE

**Desarrollador:** Antigravity AI  
**Fecha de Creación:** Enero 2026  
**Última Actualización:** 24 Enero 2026 23:45 ART

---

**FIN DEL DOCUMENTO**
