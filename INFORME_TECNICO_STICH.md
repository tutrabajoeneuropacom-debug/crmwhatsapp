# 📄 MASTER DATA SHEET - DEBUGGING WHATSAPP BOT
**Fecha:** 24 Enero 2026 - 19:30
**Uso:** Información confidencial para diagnóstico técnico (Stich).

---

## 🌐 1. CONEXIÓN & TÚNEL (ACTIVO AHORA)
Esta URL es efímera. Si se reinicia la terminal, cambiará.

| Configuración | Valor Actual |
| :--- | :--- |
| **Tunnel Provider** | Cloudflare Quick Tunnel |
| **Base URL** | `https://usc-government-carried-thread.trycloudflare.com` |
| **Webhook Endpoint** | `/api/webhook/whatsapp` |
| **Webhook Full URL** | `https://usc-government-carried-thread.trycloudflare.com/api/webhook/whatsapp` |
| **Verify Token** | `mi_token_secreto_123` |

---

## 🔑 2. CREDENCIALES DE META (WHATSAPP CLOUD API)

| ID / Token | Valor | Notas |
| :--- | :--- | :--- |
| **App ID** | `892977620357639` | App: "PuentesGlobales" (Negocios) |
| **Phone Number ID** | `929376966931764` | Verificado: "Puentes Globales" (+54 9 11 6452-9200) |
| **WABA ID** | *(Asociado al usuario)* | ID de Cuenta Comercial |
| **API Version** | `v18.0` | |
| **Access Token** | `EAAMsKI3akgcBQlLVFL969rc4R7CZCjjDy8PlOoAhCTAcE63zrPP6TdFdF25sn6hkEZCzrDj0FFpS2ilU7onMf62ZCi1W5Xe778WiQfeIhZBvNSNCqBLFPldZB9dTVcKBnFxtNZCtl28kQOATDIdvi64n3qYpphr7uUSOp1dkTyYwbSZBmTMfwRvjQk1JfS1Ihs5bGBsPmZAknCXZCbq0N3hYwfinvD5ACqMA6K9nNZBonJWTvYgZCuOZBRLt9edS7ufZBuBEAQ2eRkvPzKrI2KM2sK98c` | **TEMPORAL (24H)**. Válido ahora. Permite enviar mensajes. |

---

## 💻 3. ACCESOS PARA DIAGNÓSTICO REMOTO
Usa estos links para ver si el servidor responde desde fuera.

1. **Dashboard de Logs (JSON):**
   👉 `https://usc-government-carried-thread.trycloudflare.com/api/logs`
   *(Muestra los últimos 50 eventos recibido/enviados)*

2. **Estado de Salud:**
   👉 `https://usc-government-carried-thread.trycloudflare.com/api/health`
   *(Debe responder: "status": "ok")*

3. **Status Configuración Interna:**
   👉 `https://usc-government-carried-thread.trycloudflare.com/api/whatsapp/cloud/status`

---

## 🐛 4. DESCRIPCIÓN DEL PROBLEMA (PARA DEBUG)
**SÍNTOMA:** El servidor NO recibe mensajes entrantes (Inbound) de usuarios.

1. **Outgoing (Bot -> User):** ✅ FUNCIONA.
   - Script de prueba: `node test-outgoing-simple.js` -> Éxito.
   - El celular recibe el mensaje.
   
2. **Webhook Verification:** ✅ FUNCIONA.
   - Meta muestra check verde al guardar la URL en la configuración.
   - El servidor imprime log: `✅ Webhook verified successfully`.

3. **Inbound (User -> Bot):** ❌ FALLA.
   - El usuario envía "Hola".
   - Meta pone 1 tilde (o 2 grises).
   - **El servidor NO recibe ningún POST.** Nada en logs.
   - **Sospecha:** Meta bloqueando tráfico hacia `trycloudflare.com` para mensajes de datos, o configuración de "Modo Desarrollo" limitando remitentes (aunque el número admin es el propio usuario).

---

## 🛠️ 5. COMANDOS ÚTILES (EN LA MÁQUINA HOST)
El servidor está corriendo en: `c:\Users\Gabriel\.gemini\antigravity\scratch\whatsapp-conversational-core`

- Reiniciar Servidor: `node server/index-minimal.js`
- Ver Túnel: `type server/tunnel.log`
- Enviar mensaje prueba: `node server/test-outgoing-simple.js`

---

## 6. PROMPT PARA META AI (SOPORTE)
Copia y pega esto en el chat de ayuda de Meta (Meta AI Support):

> "Hi, I need help with WhatsApp Cloud API Webhooks.
> 
> **My Setup:**
> - App Mode: In Development.
> - CallBack URL: Active and Verified (GET requests return 200 OK and challenge).
> - Webhook Fields: Subscribed to 'messages' (v18.0).
> - Outgoing Messages: WORKING (I can send messages via Graph API successfully).
> 
> **The Issue:**
> When I send a message FROM my phone TO the Bot's test number, my server receives **nothing**. No POST request hits my webhook endpoint.
> 
> 1. I am testing with the Admin phone number (which is verified).
> 2. My server is exposed via Cloudflare Tunnel.
> 3. Verification works perfectly, so the tunnel is reachable.
> 
> **Question:** Why would Meta successfully verify the webhook (GET) but fail to deliver incoming message payloads (POST) silently? Is there a blockage for `trycloudflare.com` domains for data traffic?"
