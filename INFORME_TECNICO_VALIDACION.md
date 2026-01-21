# Informe Técnico - WhatsApp Bot No Responde a Mensajes

**Fecha:** 2026-01-20  
**Proyecto:** whatsapp-conversational-core  
**Problema:** El bot de WhatsApp no responde a mensajes entrantes  
**Plataforma:** Render (Free Tier)  
**Stack:** Node.js + WhatsApp Cloud API + OpenAI GPT-4o

---

## 📋 Resumen Ejecutivo

Se ha configurado un bot de WhatsApp usando la API de WhatsApp Cloud (Meta) desplegado en Render. El webhook se verifica correctamente (GET request responde con el challenge), pero el bot NO procesa ni responde a mensajes entrantes (POST requests no generan logs ni respuestas).

---

## 🔧 Configuración Actual

### **1. Servidor**

**Archivo principal:** `server/index-minimal.js`

**Configuración de Render:**
- **Plataforma:** Docker
- **Dockerfile:** `server/Dockerfile`
- **Root Directory:** `server`
- **Branch:** `main`
- **Auto-Deploy:** Activado

**Dockerfile actual:**
```dockerfile
FROM node:18-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN apt-get update && apt-get install -y git openssl

RUN npm install

COPY . .

EXPOSE 3000

CMD [ "node", "index-minimal.js" ]
```

**Variables de entorno configuradas en Render:**
- `OPENAI_API_KEY` ✅
- `ELEVENLABS_API_KEY` ✅
- `WHATSAPP_ACCESS_TOKEN` ✅ (Token de 60 días)
- `WHATSAPP_PHONE_NUMBER_ID` ✅ (`956780224186740`)
- `WHATSAPP_API_VERSION` ✅ (`v18.0`)
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` ✅ (`mi_token_secreto_123`)
- `SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `PORT` ✅
- `FORCE_RESTART` ✅ (`true`)

---

### **2. Configuración de WhatsApp Cloud API (Meta)**

**App ID:** `1222788103323500`  
**App Name:** puentesglobales - Test2  
**Modo:** Desarrollo  

**Webhook configurado:**
- **URL:** `https://crmwhatsapp-xari.onrender.com/api/webhook/whatsapp`
- **Verify Token:** `mi_token_secreto_123`
- **Estado:** ✅ Verificado (responde correctamente al GET request)

**Campos suscritos:**
- ✅ `messages` (ACTIVADO)

**Número de prueba:**
- `+1 555 172 6229` (Test Number proporcionado por Meta)

---

### **3. Código del Webhook**

**Endpoint GET (Verificación):**
```javascript
app.get('/api/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = whatsappCloudAPI.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.sendStatus(403);
  }
});
```

**Estado:** ✅ **FUNCIONA** (responde `test123` cuando se prueba manualmente)

**Endpoint POST (Recepción de mensajes):**
```javascript
app.post('/api/webhook/whatsapp', async (req, res) => {
  try {
    console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));

    const messageData = await whatsappCloudAPI.processWebhook(req.body);

    if (messageData && messageData.text) {
      const { from, text, name } = messageData;

      console.log(`💬 Message from ${name || from}: ${text}`);

      // AI Auto-Response
      try {
        const aiRouter = require('./services/aiRouter');

        const systemPrompt = `Eres un asistente virtual de Career Mastery Engine...`;

        const aiResponse = await aiRouter.generateResponse(text, systemPrompt);

        await whatsappCloudAPI.sendMessage(from, aiResponse);

        console.log(`✅ Replied to ${from}: ${aiResponse}`);
      } catch (aiError) {
        console.error('❌ AI Error:', aiError);
        await whatsappCloudAPI.sendMessage(from, 'Lo siento, hubo un error. Intenta de nuevo.');
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});
```

**Estado:** ❌ **NO FUNCIONA** (no genera logs cuando se envían mensajes)

---

## 🔍 Pruebas Realizadas

### **Prueba 1: Verificación del Webhook (GET)**
```
URL: https://crmwhatsapp-xari.onrender.com/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=mi_token_secreto_123&hub.challenge=test123
Resultado: ✅ Responde "test123"
Conclusión: El servidor está funcionando y el endpoint GET funciona correctamente
```

### **Prueba 2: Estado de la API**
```
URL: https://crmwhatsapp-xari.onrender.com/api/whatsapp/cloud/status
Resultado: ✅ {"configured":true,"phoneNumberId":"956780224186740","apiVersion":"v18.0"}
Conclusión: Las credenciales de WhatsApp están configuradas correctamente
```

### **Prueba 3: Health Check**
```
URL: https://crmwhatsapp-xari.onrender.com/health
Resultado: ✅ "OK"
Conclusión: El servidor está despierto y respondiendo
```

### **Prueba 4: Envío de mensajes desde WhatsApp**
```
Acción: Enviar "Hola" al número +1 555 172 6229 desde WhatsApp personal
Resultado: ❌ Sin respuesta del bot
Logs: ❌ No hay logs nuevos (siguen siendo del 19 de enero)
Conclusión: Meta NO está enviando webhooks POST al servidor
```

### **Prueba 5: Envío de mensajes desde el simulador de Meta**
```
Acción: Enviar mensaje de prueba desde Meta Developer Console
Resultado: ✅ Los mensajes de prueba de Meta SÍ llegan al WhatsApp
Logs: ❌ Pero NO hay logs en Render
Conclusión: Meta envía mensajes de prueba, pero NO webhooks al servidor
```

---

## 🚨 Síntomas del Problema

1. ✅ El webhook GET funciona (verificación exitosa)
2. ✅ El servidor está configurado correctamente
3. ✅ Las credenciales de WhatsApp están activas
4. ❌ **Los logs siguen siendo del 19 de enero (no hay logs nuevos del 20 de enero)**
5. ❌ **No hay logs de "📨 Webhook received" cuando se envían mensajes**
6. ❌ **El bot no responde a mensajes de WhatsApp**

---

## 🔎 Diagnóstico Preliminar

### **Hipótesis 1: Meta no está enviando webhooks POST**
**Probabilidad:** 🔴 **ALTA**

**Evidencia:**
- El webhook GET funciona (verificado)
- El campo "messages" está suscrito en Meta
- Pero NO hay logs de webhooks POST en Render

**Posibles causas:**
- La app está en modo "Desarrollo" y solo acepta mensajes de números autorizados
- El número desde el que se envía no está agregado como "Tester"
- Hay un problema con la configuración de webhooks en Meta

### **Hipótesis 2: El servidor no se reinició correctamente**
**Probabilidad:** 🟡 **MEDIA**

**Evidencia:**
- Los logs siguen siendo del 19 de enero
- A pesar de múltiples deploys, no hay logs nuevos

**Posibles causas:**
- Docker está usando una imagen cacheada
- El servidor no se reinició después del deploy
- Hay un problema con el proceso de build de Render

### **Hipótesis 3: El Dockerfile no se aplicó**
**Probabilidad:** 🟢 **BAJA**

**Evidencia:**
- El último deploy muestra: "Fix: Use index-minimal.js in Dockerfile"
- El commit se aplicó correctamente

**Pero:**
- Los logs no muestran el mensaje "🚀 Starting WhatsApp Cloud API Server..."
- Esto sugiere que el servidor viejo sigue corriendo

---

## 📊 Datos Técnicos Adicionales

### **Logs actuales (19 de enero):**
```
🚀 Starting MVP Idiomas Server...
⚠️  Node.js 18 and below are deprecated...
[2026-01-20T00:31:30.020Z] [info] Initializing WhatsApp Client (LOCAL FILE STORAGE + PROXY)...
⚠️ WhatsApp Cloud API credentials not configured
Server running on port 3000
WhatsApp Worker Active 🚀
[2026-01-20T00:31:33.792Z] [warn] Connection closed...
[2026-01-20T00:31:33.792Z] [error] Logged out fatal error...
❌ Webhook verification failed (x6)
```

**Análisis:**
- El servidor está corriendo `index.js` (servidor viejo con Baileys)
- NO está corriendo `index-minimal.js` (servidor nuevo con WhatsApp Cloud API)
- Esto explica por qué dice "WhatsApp Cloud API credentials not configured"

### **Logs esperados (después del fix):**
```
🚀 Starting WhatsApp Cloud API Server...
✅ WhatsApp Cloud API initialized
   Phone Number ID: 956780224186740
   API Version: v18.0
Server running on port 10000
```

---

## 🎯 Acciones Realizadas

1. ✅ Configurar variables de entorno en Render
2. ✅ Actualizar Dockerfile para usar `index-minimal.js`
3. ✅ Hacer commit y push del cambio
4. ✅ Forzar redeploy con "Clear build cache & deploy"
5. ✅ Agregar variable `FORCE_RESTART=true`
6. ✅ Verificar webhook en Meta
7. ✅ Suscribirse al campo "messages"

---

## ❓ Preguntas para Validación Externa

### **Pregunta 1: ¿Por qué los logs no se actualizan?**
A pesar de múltiples deploys (incluyendo "Clear build cache"), los logs siguen siendo del 19 de enero. ¿Qué podría estar causando esto?

### **Pregunta 2: ¿Cómo verificar que Render está usando el Dockerfile correcto?**
¿Hay alguna forma de confirmar que Render está ejecutando `index-minimal.js` y no `index.js`?

### **Pregunta 3: ¿Por qué Meta no envía webhooks POST?**
El webhook GET funciona, pero no hay evidencia de webhooks POST llegando al servidor. ¿Qué configuración podría estar faltando en Meta?

### **Pregunta 4: ¿Es necesario agregar el número como "Tester"?**
La app está en modo "Desarrollo". ¿Es obligatorio agregar el número personal como "Tester" para recibir webhooks?

### **Pregunta 5: ¿Hay algún problema con el free tier de Render?**
¿El free tier de Render tiene alguna limitación que impida recibir webhooks POST de Meta?

---

## 📁 Archivos Relevantes

### **Estructura del proyecto:**
```
whatsapp-conversational-core/
├── server/
│   ├── Dockerfile ← Actualizado para usar index-minimal.js
│   ├── package.json
│   ├── index.js ← Servidor viejo (Baileys)
│   ├── index-minimal.js ← Servidor nuevo (WhatsApp Cloud API)
│   ├── services/
│   │   ├── whatsappCloudAPI.js ← Servicio de WhatsApp Cloud API
│   │   ├── aiRouter.js ← Router de AI
│   │   └── assistantRouter.js ← Router de asistentes
│   └── .env ← Variables locales
├── render.yaml ← Configuración de Render
└── CONFIGURAR_WEBHOOK.md ← Guía de configuración
```

---

## 🔗 URLs de Referencia

- **Servidor:** https://crmwhatsapp-xari.onrender.com
- **Webhook:** https://crmwhatsapp-xari.onrender.com/api/webhook/whatsapp
- **GitHub:** https://github.com/tutrabajoeneuropacom-debug/crmwhatsapp
- **Meta App:** https://developers.facebook.com/apps/1222788103323500

---

## 💡 Solicitud de Validación

**Por favor, analiza este informe y proporciona:**

1. **Diagnóstico:** ¿Cuál es la causa raíz más probable del problema?
2. **Solución:** ¿Qué pasos específicos debemos seguir para resolverlo?
3. **Verificación:** ¿Cómo podemos confirmar que el fix funcionó?
4. **Prevención:** ¿Qué podemos hacer para evitar este problema en el futuro?

**Contexto adicional:**
- Este es un proyecto de bot de WhatsApp con AI para uso empresarial
- El objetivo es tener un sistema SaaS multi-tenant
- Actualmente estamos en fase de prueba con el número de prueba de Meta
- El bot debe responder automáticamente a mensajes usando GPT-4o

---

## 📌 Notas Finales

- El webhook de verificación (GET) funciona perfectamente
- Las credenciales están configuradas correctamente
- El problema parece estar en la recepción de webhooks POST
- Los logs no se actualizan a pesar de múltiples deploys
- Meta muestra que el webhook está verificado y "messages" está suscrito


---

## ✅ Resolución y Diagnóstico Final (2026-01-20)

### **Causa Raíz Identificada**
El problema **NO** era de caché de Render ni de Hipótesis 2 o 3.
El problema era que los archivos **físicos** en el repositorio no coincidían con lo reportado en "Acciones Realizadas". 

1. `server/Dockerfile` tenía explícitamente `CMD [ "node", "index.js" ]` (Servidor viejo).
2. `server/package.json` tenía explícitamente `"start": "node index.js"`.

Esto garantizaba que, sin importar cuántas veces se redesplegara, siempre se iniciaba el servidor viejo (Baileys) en lugar del nuevo (Cloud API).

### **Acciones Correctivas Aplicadas**
Se han modificado los archivos para forzar el uso del nuevo servidor:

1. **Actualizado `server/Dockerfile`**:
   ```dockerfile
   CMD [ "node", "index-minimal.js" ]
   ```

2. **Actualizado `server/package.json`**:
   ```json
   "start": "node index-minimal.js",
   "main": "index-minimal.js"
   ```

### **Próximos Pasos (Para el Usuario)**
1. **Hacer Commit y Push** de estos cambios a GitHub.
2. Render detectará el push y redespelgará automáticamente.
3. **Verificar Logs**: Ahora DEBERÍA aparecer:
   ```
   🚀 Starting WhatsApp Cloud API Server...
   ✅ Webhook URL: /api/webhook/whatsapp
   ```

---

## ✅ Hito Alcanzado: Despliegue Exitoso (2026-01-20 20:31)

**Estado:** 🟢 **RESUELTO** (El servidor correcto está corriendo)

**Evidencia (Logs de Render):**
```
🚀 Starting WhatsApp Cloud API Server...
✅ WhatsApp Cloud API initialized
   Phone Number ID: 956780224186740
✅ Server running on port 3000
📡 Webhook URL: /api/webhook/whatsapp
🤖 WhatsApp Cloud API Status: Configured
```

### 🧪 Próximos Pasos: Validación Funcional

Ahora que el servidor está escuchando, debemos validar que los mensajes fluyan de extremo a extremo.

1.  **Enviar Mensaje de Prueba:**
    - Desde tu celular (WhatsApp personal) o el simulador de Meta.
    - Envía: "Hola, quiero mejorar mi CV".

2.  **Verificar Logs en Render:**
    - Debemos ver: `📨 Webhook received: ...`
    - Y luego: `✅ Replied to ...`

3.  **Confirmar Respuesta en WhatsApp:**
    - El bot debería responder con algo como: "Hola, soy el asistente virtual...".




### ✅ Diagnóstico Exitoso (21:50): ¡El Webhook Funciona!

**¡Excelentes noticias!** Los logs confirman que el mensaje de prueba LLEGÓ al servidor.
`📨 Webhook received: ...`

El "tubo" está conectado. Meta y Render están hablando.

**🚨 Nuevos Problemas Detectados (Credenciales):**

Sin embargo, el bot no puede responder porque **las llaves están vencidas o incorrectas**:

1.  **Error de WhatsApp (Token Vencido):**
    - Log: `Error validating access token: Session has expired`
    - Causa: El token temporal de 24 horas (`EAARY...`) ya caducó.
    - **Solución:** Generar un nuevo token en Meta y actualizarlo en Render.

2.  **Error de OpenAI (API Key Inválida):**
    - Log: `401 Incorrect API key provided`
    - Causa: La `OPENAI_API_KEY` configurada en Render no es válida o está mal copiada.
    - **Solución:** Verificar la API Key en OpenAI y corregirla en Render.

---

## 🛠️ Plan de Acción Inmediato

### Paso 1: Renovar Token de WhatsApp
1. En el menú de la izquierda, haz clic en **Prueba de API** (o API Setup).
2. En la parte superior de esa página, verás un campo grande que dice **"Token de acceso temporal"**.
   - Empieza con `EAARY...`
   - Si no aparece, recarga la página.
3. Copia ese código largo.
4. Ve a **Render** > **Environment**.
5. Edita `WHATSAPP_ACCESS_TOKEN` y pega el nuevo token.

### Paso 2: Corregir OpenAI Key
1. Ve a **Render** > **Environment**.
2. Edita `OPENAI_API_KEY`. Asegúrate de que no tenga espacios extra y sea la correcta (empieza con `sk-proj-...`).

### Paso 3: Guardar y Redeploy
1. Guarda los cambios en Render.
2. Render se reiniciará solo.
3. Prueba enviar "Hola" de nuevo.






