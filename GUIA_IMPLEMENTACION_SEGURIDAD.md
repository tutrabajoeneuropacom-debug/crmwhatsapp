# 🔒 GUÍA DE IMPLEMENTACIÓN - MEJORAS DE SEGURIDAD

**Fecha:** 24 Enero 2026  
**Basado en:** Análisis de Stich  
**Estado:** Listo para integrar

---

## ✅ Archivos Creados

### 1. **services/openaiClient.js**
Cliente OpenAI centralizado (singleton) para evitar múltiples instancias.

### 2. **middleware/webhookSecurity.js**
Validación HMAC de firmas de webhooks de Meta.

### 3. **middleware/dashboardAuth.js**
Autenticación simple para endpoints de dashboard + redacción de PII.

### 4. **Dockerfile** (mejorado)
- Usuario no-root
- Dependencias mínimas
- Health check integrado
- Limpieza de cache apt

### 5. **.dockerignore**
Reduce tamaño de imagen excluyendo archivos innecesarios.

### 6. **.env.example**
Template completo de variables de entorno requeridas.

---

## 🔧 CAMBIOS REQUERIDOS EN index-minimal.js

### Paso 1: Importar nuevos módulos (al inicio del archivo)

```javascript
// Después de la línea 6 (const cors = require('cors');)
const { captureRawBody, verifyWebhookSignature } = require('./middleware/webhookSecurity');
const { authenticateDashboard, redactSensitive } = require('./middleware/dashboardAuth');
const { getOpenAI } = require('./services/openaiClient');
```

### Paso 2: Modificar middleware de body parsing (línea ~14)

**ANTES:**
```javascript
app.use(express.json());
```

**DESPUÉS:**
```javascript
// Capture raw body for webhook signature verification
app.use(express.json({ 
    verify: captureRawBody 
}));
```

### Paso 3: Proteger endpoint /api/logs (línea ~73)

**ANTES:**
```javascript
app.get('/api/logs', (req, res) => {
    res.json(global.recentLogs);
});
```

**DESPUÉS:**
```javascript
app.get('/api/logs', authenticateDashboard, (req, res) => {
    // Redact sensitive information before sending
    const redactedLogs = global.recentLogs.map(log => redactSensitive(log));
    res.json(redactedLogs);
});
```

### Paso 4: Agregar validación HMAC al webhook (línea ~100)

**ANTES:**
```javascript
app.post('/api/webhook/whatsapp', async (req, res) => {
```

**DESPUÉS:**
```javascript
// Validate webhook signature (if APP_SECRET is configured)
const appSecret = process.env.WHATSAPP_APP_SECRET;
if (appSecret) {
    app.use('/api/webhook/whatsapp', verifyWebhookSignature(appSecret));
}

app.post('/api/webhook/whatsapp', async (req, res) => {
```

### Paso 5: Usar cliente OpenAI centralizado

**Buscar todas las líneas que crean OpenAI inline:**

**ANTES:**
```javascript
const OpenAI = require('openai');
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.trim() : ''
});
```

**DESPUÉS:**
```javascript
const openai = getOpenAI();
```

**Ubicaciones a cambiar:**
- Línea ~170 (dentro del webhook handler)
- Línea ~348 (dentro del /api/chat handler)
- Cualquier otro lugar donde se cree OpenAI

---

## 🔐 NUEVAS VARIABLES DE ENTORNO

Agregar en Render (Environment):

```
WHATSAPP_APP_SECRET=tu_app_secret_de_meta
DASHBOARD_API_KEY=genera_un_token_aleatorio_seguro
```

**Cómo obtener WHATSAPP_APP_SECRET:**
1. Ve a Meta Developers > Tu App > Settings > Basic
2. Copia el "App Secret"

**Cómo generar DASHBOARD_API_KEY:**
```bash
# En terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📝 CÓMO USAR LOS ENDPOINTS PROTEGIDOS

### Acceder a /api/logs (ahora protegido)

**Opción 1: Header**
```bash
curl -H "X-API-Key: tu_dashboard_api_key" \
  https://botserver2026.onrender.com/api/logs
```

**Opción 2: Query parameter**
```
https://botserver2026.onrender.com/api/logs?api_key=tu_dashboard_api_key
```

---

## ✅ CHECKLIST DE INTEGRACIÓN

### Inmediato (Crítico)
- [ ] Copiar `.env.example` a `.env` y llenar valores
- [ ] Agregar `WHATSAPP_APP_SECRET` en Render
- [ ] Agregar `DASHBOARD_API_KEY` en Render
- [ ] Aplicar cambios en `index-minimal.js` (Pasos 1-5)
- [ ] Quitar hardcode del token en `whatsappCloudAPI.js` línea 14:
  ```javascript
  // ANTES:
  this.webhookVerifyToken = 'mi_token_secreto_123'; // Hardcoded for Debug
  
  // DESPUÉS:
  this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  ```
- [ ] Restaurar código completo (quitar modo debug)

### Corto Plazo (Alta prioridad)
- [ ] Instalar helmet: `npm install helmet`
- [ ] Agregar rate limiting: `npm install express-rate-limit`
- [ ] Agregar en index-minimal.js:
  ```javascript
  const helmet = require('helmet');
  const rateLimit = require('express-rate-limit');
  
  app.use(helmet());
  app.use('/api/', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100 // límite de requests
  }));
  ```

### Mediano Plazo
- [ ] Reemplazar `console.log` por logger (winston/pino)
- [ ] Agregar tests unitarios (jest)
- [ ] Configurar GitHub Actions (CI/CD)
- [ ] Implementar fs async en lugar de sync

---

## 🚨 ERRORES COMUNES Y SOLUCIONES

### Error: "Missing signature"
**Causa:** Meta no está enviando X-Hub-Signature-256  
**Solución:** Verificar que WHATSAPP_APP_SECRET esté configurado en Meta

### Error: "Invalid signature"
**Causa:** El APP_SECRET no coincide  
**Solución:** Verificar que el secret en .env sea exactamente el de Meta (sin espacios)

### Error: "Raw body not available"
**Causa:** No se aplicó el middleware captureRawBody  
**Solución:** Verificar Paso 2 (express.json con verify)

### Logs vacíos en /api/logs
**Causa:** Endpoint protegido, falta API key  
**Solución:** Agregar header X-API-Key o query param api_key

---

## 📊 IMPACTO DE LOS CAMBIOS

### Seguridad
- ✅ Webhooks validados con HMAC (previene request forging)
- ✅ Logs protegidos con autenticación
- ✅ PII redactada en logs
- ✅ Contenedor ejecuta como usuario no-root
- ✅ Tokens no se imprimen en logs

### Performance
- ✅ Cliente OpenAI reutilizado (menos overhead)
- ✅ Imagen Docker más pequeña (~30% reducción)

### Mantenibilidad
- ✅ Código más testeable (cliente centralizado)
- ✅ Separación de responsabilidades (middleware)
- ✅ Documentación clara (.env.example)

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

1. **Integrar cambios** (esta guía)
2. **Probar localmente** con ngrok/cloudflared
3. **Desplegar a Render**
4. **Verificar logs** que no muestren tokens
5. **Probar webhook** con mensaje real
6. **Monitorear** primeras 24h en producción

---

**FIN DE LA GUÍA**
