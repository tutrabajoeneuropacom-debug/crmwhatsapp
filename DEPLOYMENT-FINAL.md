# 🚀 GUÍA DE DESPLIEGUE FINAL (REVISADA)

Esta guía consolida todos los fixes para el **Error 408**, el **Sistema de Personalidades por Usuario**, y el **Heartbeat** para Render.

---

## 📦 1. ARCHIVOS CLAVE ACTUALIZADOS

1.  `server/config/personas.js`: Contiene 6 personalidades con keywords, emojis y configuraciones de IA específicas.
2.  `server/services/aiRouter.js`: Motor de IA inteligente con detección de temas y fallback Gemini → OpenAI.
3.  `server/index-minimal.js`: Servidor core con Heartbeat agresivo y gestión de comandos.

---

## 🛠️ 2. VARIABLES DE ENTORNO EN RENDER

Asegúrate de tener estas variables configuradas en tu Dashboard de Render (Web Service):

| Variable | Valor Recomendado | Motivo |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | `Tu API Key` | **Requerido** (Cerebro principal) |
| `OPENAI_API_KEY` | `Tu API Key` | **Fallback** (Si Gemini falla o para Whisper/TTS) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Persistencia de sesión (Evita escanear QR cada vez) |
| `SUPABASE_KEY` | `Tu anon key` | Acceso seguro a BD (Sustituye a SERVICE_ROLE) |
| `PORT` | `3000` | Puerto interno |

---

## 🎮 3. COMANDOS DISPONIBLES EN WHATSAPP

Ahora puedes controlar a Alex directamente desde el chat (sin afectar a otros usuarios):

| Comando | Acción |
| :--- | :--- |
| `!ayuda` | Muestra el menú de personalidades y comandos. |
| `!marketing` | Cambia a modo Experto en Marketing. |
| `!closer` | Cambia a modo Cerrador de Ventas. |
| `!migra` | Cambia a modo Consultor de Migraciones. |
| `!actual` | Te dice qué personalidad te está atendiendo ahora. |
| `!reset` | Borra tu historial local para empezar de cero. |

---

## 💓 4. PREVENCIÓN DE ERROR 408 (TIMEOUT)

Hemos implementado un sistema de **Triple Heartbeat**:

1.  **WebSocket Ping (cada 30s):** Mantiene la tubería de Baileys abierta con los servidores de WhatsApp.
2.  **HTTP Self-Ping (cada 30s):** Golpea el endpoint `/health` propio para evitar que el "Free Tier" de Render se duerma.
3.  **Presence Updates:** Simula que el bot está "componiendo" brevemente para mantener la sesión viva durante el procesamiento.

---

## ✅ 5. CÓMO VALIDAR QUE TODO FUNCIONA

1.  **Mira los logs de Render:** Deberías ver `💓 Heartbeat: Keeping Alex Awake...` cada 30 segundos.
2.  **Prueba el cambio de personalidad:** Envía `!closer` y luego pregunta "¿Cómo me mudo a España?". Debería intentar "cerrarte" una cita.
3.  **Prueba el Auto-Detección:** Si estás en modo Closer pero preguntas por "marketing", el bot detectará el cambio de tema en logs (aunque no te forzará el cambio para no ser intrusivo).

---
**¡Sistema listo para producción! 🎉**
