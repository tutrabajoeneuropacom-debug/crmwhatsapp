# 🔧 Checklist de Troubleshooting - Render Deployment

## ✅ Verificaciones Básicas

### 1. Estado del Servicio
- [ ] El servicio muestra "Live" (verde)
- [ ] No hay errores en el dashboard
- [ ] El último deploy fue exitoso

### 2. Variables de Entorno
Verifica que estén configuradas en Render:
- [ ] `OPENAI_API_KEY` (debe empezar con `sk-proj-`)
- [ ] `ELEVENLABS_API_KEY` (debe empezar con `sk_`)
- [ ] `WHATSAPP_ACCESS_TOKEN` (debe empezar con `EAAR`)
- [ ] `WHATSAPP_PHONE_NUMBER_ID` = `956780224186740`
- [ ] `WHATSAPP_API_VERSION` = `v18.0`
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` = `mi_token_secreto_123`
- [ ] `PORT` = `10000` (o dejarlo vacío para que Render lo asigne)

### 3. Build Command
Debe ser exactamente:
```
cd server && npm install
```

### 4. Start Command
Debe ser exactamente:
```
cd server && npm start
```

### 5. Logs - Qué buscar

**Errores comunes:**

#### Error: "Cannot find module"
```
Error: Cannot find module '@supabase/supabase-js'
```
**Solución:** Falta una dependencia. Verifica que `package.json` esté en la carpeta `server/`

#### Error: "EADDRINUSE"
```
Error: listen EADDRINUSE: address already in use :::10000
```
**Solución:** Cambiar `PORT` a variable dinámica o dejarlo vacío

#### Error: "OpenAI API key is missing"
```
Error: The OPENAI_API_KEY environment variable is missing
```
**Solución:** Verificar que la variable esté configurada en Render (sin espacios)

#### Error: "Supabase connection failed"
```
Error: Invalid Supabase URL
```
**Solución:** Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`

#### Warning: "WhatsApp Cloud API credentials not configured"
```
⚠️ WhatsApp Cloud API credentials not configured
```
**Solución:** Verificar que `WHATSAPP_ACCESS_TOKEN` esté configurado

---

## 🚀 Pruebas de Conectividad

Una vez que el servicio esté "Live", prueba estos endpoints:

### 1. Health Check
```bash
curl https://talkme.onrender.com/health
```
**Respuesta esperada:**
```
OK
```

### 2. API Health
```bash
curl https://talkme.onrender.com/api/health
```
**Respuesta esperada:**
```json
{
  "status": "ok",
  "message": "MVP Idiomas AI Server Running",
  "timestamp": "2026-01-19T..."
}
```

### 3. WhatsApp Cloud API Status
```bash
curl https://talkme.onrender.com/api/whatsapp/cloud/status
```
**Respuesta esperada:**
```json
{
  "configured": true,
  "phoneNumberId": "956780224186740",
  "apiVersion": "v18.0"
}
```

### 4. Root Endpoint
```bash
curl https://talkme.onrender.com/
```
**Respuesta esperada:**
```json
{
  "status": "online",
  "server": "mvp-idiomas-server",
  "mode": "Baileys + Pairing Code",
  "checks": {
    "openai": true,
    "elevenlabs": true,
    "supabase_url": false
  }
}
```

---

## 🐛 Soluciones Rápidas

### Si el servicio está "Live" pero no responde:

**Problema:** Cold start (servicio dormido)
**Solución:** Espera 30-60 segundos y vuelve a intentar

**Problema:** Timeout en el primer request
**Solución:** Configura un keep-alive con UptimeRobot

### Si el build falla:

**Problema:** Error en `npm install`
**Solución:** Verifica que `package.json` esté en `server/`

**Problema:** Sintaxis error en el código
**Solución:** Revisa los logs para ver qué archivo tiene el error

### Si el servicio crashea al iniciar:

**Problema:** Puerto incorrecto
**Solución:** Cambia `PORT` a `process.env.PORT` sin valor por defecto

**Problema:** Dependencia faltante
**Solución:** Agrega la dependencia a `package.json` y redeploy

---

## 📊 Información del Servicio

**URL del servicio:** https://talkme.onrender.com
**Webhook URL:** https://talkme.onrender.com/api/webhook/whatsapp
**Region:** Frankfurt (o la que configuraste)
**Plan:** Free

**Limitaciones del plan Free:**
- Se duerme después de 15 minutos de inactividad
- Cold start de 30-60 segundos
- 750 horas/mes de uso
- Ancho de banda limitado

---

## 🔄 Cómo Redeploy

Si necesitas hacer cambios y redesplegar:

1. **Hacer cambios en el código local**
2. **Commit y push a GitHub:**
   ```bash
   git add .
   git commit -m "Fix: descripción del cambio"
   git push
   ```
3. **Render automáticamente detectará el cambio y redesplegará**
4. **Espera 3-5 minutos** para que termine el build

---

## 📞 Próximos Pasos

Una vez que el servicio esté funcionando:

1. ✅ Verificar que todos los endpoints respondan
2. ✅ Configurar el webhook en Meta con la URL de Render
3. ✅ Probar enviando un mensaje de WhatsApp
4. ✅ Verificar los logs para ver si el bot responde
5. ✅ Configurar UptimeRobot para evitar cold starts

---

**¿Qué ves en los logs de Render?** Comparte el mensaje de error o el estado actual y te ayudo a solucionarlo. 🚀
