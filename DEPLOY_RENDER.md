# 🚀 Guía de Despliegue: WhatsApp Bot en Render

## ✅ Preparación (Ya está hecho)

- ✅ Código del bot con WhatsApp Cloud API
- ✅ Archivo `render.yaml` configurado
- ✅ API de Meta configurada

---

## 📝 PASOS PARA DESPLEGAR

### **Paso 1: Subir el código a GitHub**

1. Abre una terminal en la carpeta del proyecto:
```bash
cd c:\Users\Gabriel\.gemini\antigravity\scratch\whatsapp-conversational-core
```

2. Inicializa Git (si no lo has hecho):
```bash
git init
git add .
git commit -m "WhatsApp Bot with Cloud API ready for deployment"
```

3. Crea un repositorio en GitHub:
   - Ve a https://github.com/new
   - Nombre: `whatsapp-bot-ai`
   - Público o Privado (tu elección)
   - NO inicialices con README

4. Conecta y sube:
```bash
git remote add origin https://github.com/TU_USUARIO/whatsapp-bot-ai.git
git branch -M main
git push -u origin main
```

---

### **Paso 2: Crear cuenta en Render**

1. Ve a https://render.com
2. Haz clic en **"Get Started"**
3. Regístrate con GitHub (más fácil)

---

### **Paso 3: Crear el Web Service**

1. En el dashboard de Render, haz clic en **"New +"** → **"Web Service"**

2. Conecta tu repositorio:
   - Busca `whatsapp-bot-ai`
   - Haz clic en **"Connect"**

3. Configuración del servicio:
   - **Name**: `whatsapp-bot-ai`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: (dejar vacío)
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Plan**: `Free`

4. Haz clic en **"Advanced"** y agrega las variables de entorno:

   ```
   OPENAI_API_KEY = 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
   
   ELEVENLABS_API_KEY = sk_b577f7fa15f41d67e0fff3b091e1eb3105a9924fb3203e70
   
   WHATSAPP_ACCESS_TOKEN = [EL TOKEN QUE GENERASTE EN META]
   
   WHATSAPP_PHONE_NUMBER_ID = 956780224186740
   
   WHATSAPP_API_VERSION = v18.0
   
   WHATSAPP_WEBHOOK_VERIFY_TOKEN = mi_token_secreto_123
   
   PORT = 10000
   ```

5. Haz clic en **"Create Web Service"**

6. **Espera 3-5 minutos** mientras Render despliega tu bot

7. Cuando termine, verás un URL como:
   ```
   https://whatsapp-bot-ai-xxxx.onrender.com
   ```
   **¡COPIA ESTE URL!** Lo necesitas para el siguiente paso.

---

### **Paso 4: Configurar el Webhook en Meta**

Ahora vuelve a la página de Meta WhatsApp API:

1. En el menú lateral, ve a **"Configuración"** → **"Webhooks"**

2. Haz clic en **"Configurar"** o **"Editar"**

3. Ingresa estos datos:
   - **URL de devolución de llamada**: 
     ```
     https://whatsapp-bot-ai-xxxx.onrender.com/api/webhook/whatsapp
     ```
     (Reemplaza `xxxx` con tu URL de Render)
   
   - **Token de verificación**: 
     ```
     mi_token_secreto_123
     ```

4. Haz clic en **"Verificar y guardar"**

5. Si todo está bien, verás un ✅ verde

6. **Suscríbete a eventos**:
   - Marca la casilla **"messages"**
   - Guarda los cambios

---

### **Paso 5: ¡PROBAR EL BOT! 🎉**

1. En Meta, ve a **"Prueba de API"** (paso 3 de la interfaz)

2. Agrega tu número de teléfono personal como destinatario

3. Envía un mensaje de WhatsApp al número de prueba de Meta

4. **¡El bot debería responder automáticamente con AI!** 🤖

---

## 🔍 Verificar que funciona

### Ver logs en Render:
1. Ve a tu servicio en Render
2. Haz clic en **"Logs"**
3. Deberías ver:
   ```
   🚀 Starting MVP Idiomas Server...
   ✅ WhatsApp Cloud API initialized
   Server running on port 10000
   ```

### Probar el endpoint de status:
```bash
curl https://whatsapp-bot-ai-xxxx.onrender.com/api/whatsapp/cloud/status
```

Debería devolver:
```json
{
  "configured": true,
  "phoneNumberId": "956780224186740",
  "apiVersion": "v18.0"
}
```

---

## 🐛 Troubleshooting

### Si el webhook no se verifica:
- Verifica que el servicio de Render esté **"Live"** (verde)
- Verifica que el URL sea exacto (con `/api/webhook/whatsapp`)
- Verifica que el token coincida: `mi_token_secreto_123`

### Si no recibes mensajes:
- Verifica que te suscribiste al evento **"messages"** en Meta
- Revisa los logs en Render
- Verifica que el `WHATSAPP_ACCESS_TOKEN` sea válido

### Si las APIs no funcionan:
- Verifica que las variables de entorno estén correctas en Render
- Revisa los logs para ver errores de OpenAI o ElevenLabs

---

## 🎯 Próximos pasos

Una vez que funcione:

1. ✅ **Token permanente**: Genera un token de sistema en Meta (no expira)
2. ✅ **Número real**: Agrega tu número de WhatsApp Business real
3. ✅ **Personalizar prompts**: Edita el sistema de prompts en `index.js`
4. ✅ **Analytics**: Agrega tracking de conversaciones
5. ✅ **CRM**: Conecta con tu CRM para guardar leads

---

## 📊 Resumen de URLs importantes

- **Render Dashboard**: https://dashboard.render.com
- **Tu servicio**: https://whatsapp-bot-ai-xxxx.onrender.com
- **Webhook URL**: https://whatsapp-bot-ai-xxxx.onrender.com/api/webhook/whatsapp
- **Status endpoint**: https://whatsapp-bot-ai-xxxx.onrender.com/api/whatsapp/cloud/status
- **Meta WhatsApp**: https://developers.facebook.com/apps/

---

¡Listo! 🚀 Sigue estos pasos y tendrás tu bot funcionando en la nube.
