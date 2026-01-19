# 🚀 Guía de Configuración: WhatsApp Cloud API (Meta)

## ✅ Lo que ya hicimos:
1. ✅ Creamos el servicio `whatsappCloudAPI.js`
2. ✅ Agregamos los endpoints del webhook en `index.js`
3. ✅ Configuramos las variables de entorno en `.env`

---

## 📝 PASOS QUE DEBES HACER AHORA:

### **Paso 1: Generar el Token de Acceso Temporal**

En la página de Meta que tienes abierta:

1. Haz clic en **"Generar token de acceso"** (sección 1)
2. Copia el token que aparece (algo como `EAAxxxxxxxxxxxxx...`)
3. Pégalo en el archivo `.env` reemplazando `TU_TOKEN_AQUI`:

```bash
WHATSAPP_ACCESS_TOKEN=EAAtu_token_aqui
```

⚠️ **IMPORTANTE**: Este token dura solo 60 minutos. Más adelante te mostraré cómo generar uno permanente.

---

### **Paso 2: Iniciar el Servidor**

Abre una terminal en la carpeta `server` y ejecuta:

```bash
cd c:\Users\Gabriel\.gemini\antigravity\scratch\whatsapp-conversational-core\server
node index.js
```

El servidor debería iniciar en `http://localhost:3000`

---

### **Paso 3: Exponer el Webhook con ngrok**

Meta necesita un URL público para enviar mensajes. Usa ngrok:

1. Abre otra terminal y ejecuta:
```bash
ngrok http 3000
```

2. Copia el URL que te da (ejemplo: `https://abc123.ngrok.io`)

---

### **Paso 4: Configurar el Webhook en Meta**

Vuelve a la página de Meta:

1. Ve a **"Webhooks"** en el menú lateral (debajo de "WhatsApp")
2. Haz clic en **"Configurar"** o **"Editar"**
3. Ingresa estos datos:

   - **URL de devolución de llamada**: `https://tu-url-ngrok.ngrok.io/api/webhook/whatsapp`
   - **Token de verificación**: `mi_token_secreto_123` (el que pusimos en `.env`)
   
4. Haz clic en **"Verificar y guardar"**

5. **Suscríbete a eventos**:
   - Marca la casilla `messages` (para recibir mensajes)
   - Guarda los cambios

---

### **Paso 5: Probar el Bot**

1. En la página de Meta, ve a **"Prueba de API"** (sección 3 de tu captura)
2. Agrega tu número de teléfono personal como destinatario
3. Envía un mensaje de prueba desde WhatsApp al número de prueba de Meta
4. El bot debería responder automáticamente con AI! 🎉

---

## 🔍 Verificar que Todo Funciona

### Endpoint de Status:
```bash
curl http://localhost:3000/api/whatsapp/cloud/status
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

## 🔐 Token Permanente (Después de las pruebas)

El token temporal expira en 60 minutos. Para producción necesitas:

1. Ir a **"Herramientas" > "Tokens de acceso"** en Meta
2. Crear un **"Token de sistema"** con permisos de WhatsApp
3. Reemplazar `WHATSAPP_ACCESS_TOKEN` en `.env`

---

## 🐛 Troubleshooting

### Si el webhook no se verifica:
- Verifica que ngrok esté corriendo
- Verifica que el servidor esté corriendo en puerto 3000
- Verifica que `WHATSAPP_WEBHOOK_VERIFY_TOKEN` coincida en `.env` y Meta

### Si no recibes mensajes:
- Verifica que te suscribiste al evento `messages` en Meta
- Revisa los logs del servidor (`console.log` en la terminal)
- Verifica que el token de acceso sea válido

### Si las APIs no funcionan:
- Ejecuta: `node test-apis.js` para verificar OpenAI y ElevenLabs
- Verifica que las claves estén correctas en `.env`

---

## 📊 Logs Importantes

Cuando recibas un mensaje, deberías ver:
```
📨 Webhook received: {...}
💬 Message from Usuario: Hola
🚀 Routing to OpenAI...
✅ Replied to 5491123456789: Hola! ¿En qué puedo ayudarte...
```

---

## 🎯 Próximos Pasos

Una vez que funcione:
1. ✅ Configurar token permanente
2. ✅ Desplegar en Render/Railway con webhook público
3. ✅ Agregar tu número de WhatsApp Business real
4. ✅ Personalizar los prompts de AI
5. ✅ Agregar analytics y CRM

---

¿Listo para empezar? 🚀
