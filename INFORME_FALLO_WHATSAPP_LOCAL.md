# Informe Técnico: Fallo Persistente en Recepción de Webhooks - WhatsApp Cloud API (Entorno Local Windows)

## 1. Resumen Ejecutivo
Se ha intentado levantar un entorno de desarrollo local para un Bot de WhatsApp (Node.js + Express) en Windows.
**Estado Actual:**
- ✅ **Salida (Outgoing):** El bot puede enviar mensajes a WhatsApp correctamente.
- ✅ **Lógica (AI):** La integración con OpenAI está configurada y con credenciales válidas.
- ✅ **Servidor:** Node.js corre sin errores en puerto 3000.
- ❌ **Entrada (Incoming):** El servidor **NO recibe** los POSTs de Meta cuando un usuario escribe al bot. El webhook parece perderse en el túnel o ser bloqueado antes de llegar a la aplicación.

## 2. Configuración del Entorno
- **OS:** Windows 10/11
- **Runtime:** Node.js v24.11.1
- **Stack:** Express.js (Minimal setup, `index-minimal.js`)
- **Puerto Local:** 3000
- **Meta API:** v18.0

## 3. Cronología de Pruebas y Túneles Utilizados

### Intento A: LocalTunnel (`lt`)
- **Comando:** `lt --port 3000`
- **Resultado:** Inestable.
- **Errores:**
    - HTTP 408 (Timeout).
    - Pantalla de advertencia "Click to Continue" / Solicitud de IP Password que bloquea la verificación automática de Meta.
    - Meta reporta error al intentar verificar el webhook debido a estas pantallas intermedias.

### Intento B: Serveo (`serveo.net`)
- **Comando:** `ssh -R 80:localhost:3000 serveo.net`
- **Resultado:** Conexión establecida (`Forwarding HTTP traffic...`).
- **Verificación Meta:** Exitosa (Se logró verificar el token).
- **Tráfico Real:** Fallido. Al escribir "Hola" desde el móvil, no aparece ningún log en la terminal de Node.js.

### Intento C: Cloudflare Tunnel (`cloudflared`) [Recomendado]
- **Comando:** `cloudflared tunnel --url http://localhost:3000`
- **URL Generada:** `https://[random-subdomain].trycloudflare.com`
- **Resultado:** Conexión muy estable.
- **Verificación Meta:** ✅ **EXITOSA** (Log del servidor muestra `Webhook verified successfully`).
- **Tráfico Real (Mensajes):** ❌ **FALLIDO**.
    - El usuario envía mensajes al número del bot.
    - En WhatsApp aparecen 1 o 2 tildes (grises).
    - **En el servidor local NO se imprime nada.**

## 4. Diagnóstico de Código (`index-minimal.js`)
El endpoint POST está configurado correctamente para imprimir logs al inicio:

```javascript
app.post('/api/webhook/whatsapp', async (req, res) => {
    console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2)); // <--- ESTO NUNCA SE EJECUTA CON MENSAJES REALES
    // ...
});
```
Se probó un script de simulación local (`test-local.js`) que hace un POST a `localhost:3000/api/webhook/whatsapp`, y este **SÍ** funciona y genera respuesta. Esto confirma que la lógica de Express está perfecta y el problema es puramente de **red/túnel/entrega externa**.

## 5. Hipótesis de Fallo para Consulta Externa
Solicitamos asistencia para identificar por qué Meta verifica el webhook correctamente pero luego falla silenciosamente al entregar los mensajes `messages`.

**Posibles Causas a evaluar:**
1.  **Restricciones de Modo Desarrollo:** ¿Es posible que, aunque el número "From" y "To" sean el mismo (pruebas propias), Meta bloquee el webhook si el número destino no está explícitamente añadido en la lista de "Test Numbers" o si no se ha respondido a un mensaje de plantilla primero?
2.  **Filtrado de Dominios:** ¿Meta bloquea o limita el tráfico `POST` (con payload de datos) hacia dominios de túneles gratuitos (`.trycloudflare.com`) después de la verificación inicial?
3.  **Firewall Windows:** ¿Puede el Firewall de Windows permitir la conexión del túnel de salida pero bloquear el tráfico entrante a través del puerto que abre el ejecutable del túnel (`cloudflared.exe`)?

## 6. Prompt para Consultar a otras IAs
*(Copia y pega esto para obtener una segunda opinión técnica)*

> "Experto en WhatsApp Cloud API y DevOps:
> Tengo un bot Node.js en local (puerto 3000) expuesto vía Cloudflare Tunnel.
> 1. Meta valida correchamente el Webhook (GET request llega a mi servidor y devuelve el challenge).
> 2. Puedo enviar mensajes (Outgoing) sin problemas.
> 3. **PROBLEMA:** Cuando envío un mensaje desde WhatsApp al bot, **no llega nada** a mi servidor (ni logs, ni errores). Nada.
> 4. He verificado que la URL del webhook en Meta tiene `/api/webhook/whatsapp`.
> 5. Al simular un POST local con cURL, mi servidor responde y procesa bien.
>
> ¿Por qué Meta verificaría bien (GET) pero fallaría al entregar mensajes (POST) sin mostrar error en su dashboard? ¿Hay algún requisito de 'Whitelisting' de IPs o dominios de túneles que esté ignorando? El firewall de Windows está desactivado para Node."
