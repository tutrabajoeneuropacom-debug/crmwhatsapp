# 🔗 Configuración del Webhook - WhatsApp Cloud API

## ✅ Prerequisitos

Antes de configurar el webhook, asegúrate de que:
- ✅ El servicio en Render esté "Live" (verde)
- ✅ El token de WhatsApp esté actualizado
- ✅ La URL del servicio responda: https://talkme.onrender.com/health

---

## 📝 Pasos para Configurar el Webhook en Meta

### **Paso 1: Ir a la configuración de WhatsApp**

1. Ve a: https://developers.facebook.com/apps/
2. Selecciona tu app: **puentesglobales - Test2**
3. En el menú lateral, busca: **WhatsApp** → **Configuración**

---

### **Paso 2: Configurar el Webhook**

1. En la sección **"Webhooks"**, haz clic en **"Configurar"** o **"Editar"**

2. **Ingresa estos datos:**

   **URL de devolución de llamada (Callback URL):**
   ```
   https://talkme.onrender.com/api/webhook/whatsapp
   ```

   **Token de verificación (Verify Token):**
   ```
   mi_token_secreto_123
   ```

3. Haz clic en **"Verificar y guardar"**

4. **Espera la verificación:**
   - Meta enviará una petición GET a tu servidor
   - Tu servidor responderá con el challenge
   - Deberías ver un ✅ verde si todo está bien

---

### **Paso 3: Suscribirse a Eventos**

Una vez que el webhook esté verificado:

1. En la misma página, busca **"Campos del webhook"** (Webhook Fields)

2. **Marca la casilla:**
   - ✅ **messages** (Este es el evento principal)

3. **Opcional, también puedes marcar:**
   - ✅ **message_status** (para saber si el mensaje fue entregado/leído)
   - ✅ **messaging_postbacks** (para botones interactivos)

4. Haz clic en **"Guardar"**

---

## 🧪 Probar el Webhook

### **Opción 1: Desde Meta (Recomendado)**

1. Ve a: **WhatsApp** → **Prueba de API** (paso 3 en la interfaz de Meta)

2. Ingresa tu número de teléfono: `5491158253958`

3. Haz clic en **"Enviar mensaje"**

4. **Deberías recibir:**
   - Un mensaje de prueba de Meta
   - Luego, una respuesta automática de tu bot con AI 🤖

---

### **Opción 2: Enviar mensaje desde WhatsApp**

1. Abre WhatsApp en tu teléfono

2. Envía un mensaje al número de prueba de Meta

3. **El bot debería responder automáticamente**

---

## 🔍 Verificar que Funciona

### **1. Ver logs en Render**

1. Ve a: https://dashboard.render.com
2. Haz clic en tu servicio "Talkme"
3. Ve a **"Logs"**

**Deberías ver:**
```
📨 Webhook received: { ... }
💬 Message from +5491158253958: Hola
✅ Replied to +5491158253958: ¡Hola! Soy el asistente...
```

---

### **2. Probar diferentes mensajes**

Envía estos mensajes para probar diferentes funcionalidades:

**Mensaje 1: Saludo**
```
Hola
```
**Respuesta esperada:**
```
¡Hola! 👋 Soy el asistente de Career Mastery Engine.
¿En qué puedo ayudarte hoy?
```

**Mensaje 2: Pregunta sobre precios**
```
Cuánto cuesta?
```
**Respuesta esperada:**
```
Tenemos planes freemium y premium. El plan gratuito incluye...
¿Te gustaría conocer más detalles?
```

**Mensaje 3: Pregunta sobre entrevistas**
```
Cómo me preparo para una entrevista?
```
**Respuesta esperada:**
```
Te ayudo a prepararte para entrevistas con:
1. Simulación de entrevistas con AI
2. Análisis de tu CV para sistemas ATS
...
```

---

## 🚨 Troubleshooting

### **Error: "Webhook verification failed"**

**Posibles causas:**
- ❌ El servicio en Render no está "Live"
- ❌ La URL está mal escrita
- ❌ El token de verificación no coincide

**Solución:**
1. Verifica que https://talkme.onrender.com/health responda "OK"
2. Verifica que la URL sea exacta: `/api/webhook/whatsapp`
3. Verifica que el token sea: `mi_token_secreto_123`

---

### **Error: "No recibo mensajes"**

**Posibles causas:**
- ❌ No te suscribiste al evento "messages"
- ❌ El token de WhatsApp expiró
- ❌ Hay un error en el código del servidor

**Solución:**
1. Verifica que estés suscrito a "messages" en Meta
2. Verifica los logs en Render para ver errores
3. Prueba el endpoint: https://talkme.onrender.com/api/whatsapp/cloud/status

---

### **Error: "Bot no responde"**

**Posibles causas:**
- ❌ Error en la API de OpenAI
- ❌ El token de OpenAI no está configurado
- ❌ Hay un error en el código

**Solución:**
1. Verifica los logs en Render
2. Verifica que `OPENAI_API_KEY` esté configurado en Render
3. Prueba manualmente con curl:
   ```bash
   curl -X POST https://talkme.onrender.com/api/webhook/whatsapp \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

---

## ✅ Checklist Final

Antes de dar por terminada la configuración:

- [ ] Webhook verificado en Meta (✅ verde)
- [ ] Suscrito al evento "messages"
- [ ] Mensaje de prueba enviado desde Meta
- [ ] Bot respondió automáticamente
- [ ] Logs en Render muestran actividad
- [ ] Mensaje enviado desde WhatsApp personal
- [ ] Bot respondió correctamente

---

## 🎉 ¡Listo!

Una vez que completes todos los pasos, tu bot de WhatsApp con AI estará **100% funcional**.

**Próximos pasos:**
1. ✅ Configurar UptimeRobot (evitar cold starts)
2. ✅ Generar token permanente (60 días → permanente)
3. ✅ Empezar a desarrollar el dashboard web
4. ✅ Agregar más funcionalidades (CRM, analytics, etc.)

---

**¿Necesitas ayuda?** Revisa los logs en Render o comparte el error que veas. 🚀
