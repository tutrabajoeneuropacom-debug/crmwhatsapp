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
| `NODE_VERSION` | `20.x` | **Recomendado** (Evita warnings de deprecación) |

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
| `!status` | Informe técnico del estado del bot (Uptime, RAM, etc). |
| `!reiniciar` | Fuerza un reinicio manual de la conexión de WhatsApp. |
| `!reset` | Borra tu historial local para empezar de cero. |

---

## 💓 4. PREVENCIÓN DE ERROR 408 (DEATH LOOP FIX)

Hemos blindado el sistema contra el bucle infinito de reconexión:

1.  **Reconexión Exponencial:** Si falla, el bot espera 2s, 4s, 8s... hasta un máximo de 30s.
2.  **Límite de Intentos:** Después de 5 fallos seguidos, el bot entra en **Cooldown** (5 minutos) antes de volver a intentar. Esto evita que Render bloquee tu IP por spam de conexiones.
3.  **Wipe Controlado:** Solo se borra la sesión local en el primer intento fallido si no hay Supabase.

---

## ✅ 5. CÓMO VALIDAR QUE TODO FUNCIONA

1.  **Mira los logs de Render:** Deberías ver `💓 [ALEX] Heartbeat OK` cada 30 segundos.
2.  **Usa Supabase:** Es la única forma de evitar el Error 408 permanente en Render. Sin Supabase, el bot perderá la sesión en cada despliegue.
3.  **Actualiza Node:** Configura `NODE_VERSION=20` en Render Settings -> Environment para eliminar los avisos de Supabase.

---
**¡Sistema listo para producción! 🎉**
