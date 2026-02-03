# Informe Técnico: Fallo de Recepción de Mensajes WhatsApp Cloud API (Entorno Local)

## 1. Resumen del Problema
El bot de WhatsApp, ejecutándose en un entorno local (Windows 11) y expuesto mediante túneles HTTP (`localtunnel` / `serveo`), **no responde a los mensajes entrantes** de los usuarios.
- **Salida (Outgoing):** ✅ FUNCIONA. Se ha probado enviando un "Ping" desde el servidor local al celular del usuario y este llega correctamente.
- **Entrada (Incoming):** ❌ FALLA. Al enviar un mensaje desde el celular al bot, el servidor local no muestra logs de recepción. El webhook parece no estar llegando o siendo bloqueado antes de entrar a la aplicación Node.js.

## 2. Contexto del Entorno

### Infraestructura
- **SO:** Windows 10/11
- **Runtime:** Node.js v24.11.1
- **Framework:** Express.js (Modo minimalista sin base de datos obligatoria)
- **Proveedor API:** Meta WhatsApp Cloud API (v18.0)
- **Túneles Probados:**
    1.  `localtunnel` (Genera error HTTP 408 Timeout o bloquea por pantalla de "password").
    2.  `serveo.net` (SSH Reverse Tunnel). URL actual: `https://986f922bff05293e-186-22-18-96.serveousercontent.com`

### Configuración del Servidor (`index-minimal.js`)
El servidor está configurado para escuchar en el puerto `3000`.
Endpoints clave:
- `GET /api/webhook/whatsapp`: Para validación de Meta (Token: `mi_token_secreto_123`). **Validación exitosa en pruebas esporádicas.**
- `POST /api/webhook/whatsapp`: Para recibir mensajes. **Aquí radica el fallo.**

```javascript
app.post('/api/webhook/whatsapp', async (req, res) => {
    console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));
    // ... Lógica de procesamiento
    res.sendStatus(200);
});
```

Los logs de consola muestran el inicio correcto:
```
✅ Server running on port 3000
📡 Webhook URL: /api/webhook/whatsapp
```

## 3. Diagnóstico Realizado

1.  **Prueba de Salida (Outgoing):**
    - Se ejecutó `test-real-message.js`.
    - Resultado: Mensaje entregado con éxito (Status 200 de Meta).
    - Conclusión: Credenciales (`ACCESS_TOKEN` y `PHONE_ID`) son correctas.

2.  **Prueba de Túnel (Serveo/Localtunnel):**
    - `Localtunnel` mostró inestabilidad (Timeouts 408) y barreras de seguridad (pantalla de password).
    - `Serveo` se conectó correctamente (`Forwarding HTTP traffic...`).
    - **Hipótesis:** Aunque el túnel diga estar activo, Meta podría estar rechazando la conexión SSL de Serveo o los paquetes se pierden por latencia/firewall de Windows.

3.  **Verificación de Webhook en Meta:**
    - El usuario reporta poder verificar el webhook ocasionalmente, pero luego el tráfico "real" de mensajes no llega.
    - Meta suele requerir respuesta en <3 segundos. Si el túnel introduce latencia, Meta marca el envío como fallido.

## 4. Preguntas para Consultar (Prompt para LLMs)

Para consultar con otros modelos, utiliza el siguiente prompt:

---
**PROMPT:**
"Actúo como Desarrollador FullStack depurando un bot de WhatsApp Cloud API en local (Windows + Node.js).
**Síntoma:** El bot manda mensajes (Outgoing OK) pero no recibe nada (Incoming Fails). No aparecen logs en la consola de Node.js al enviar mensajes desde el celular.
**Setup:**
- Node.js v24 en puerto 3000.
- Túnel: Probamos `localtunnel` (da timeout 408) y `serveo` (SSH forwarding en puerto 80).
- Meta Webhook configurado con la URL del túnel.
- Firewall de Windows: Node.js permitido.

**Pregunta:**
¿Qué causas técnicas, aparte de la configuración básica, impiden que el POST de Meta llegue a mi localhost a través de estos túneles gratuitos? ¿Existe algún bloqueo específico de Meta hacia dominios de `loca.lt` o `serveo` recientemente? ¿Qué alternativa de túnel gratuito es la más fiable hoy (2025) para webhooks de Meta que requieren SSL válido y baja latencia?"
---
