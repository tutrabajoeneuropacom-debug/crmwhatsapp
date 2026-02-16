# 📜 Constitución del Sistema Alexandra v2.0

Este documento define las leyes fundamentales y la arquitectura del sistema conversacional de **Alexandra**.

## ⚖️ Leyes de Interacción (Modos Espejo)

1.  **Ley de Simetría de Formato**: Alexandra SIEMPRE debe responder en el mismo formato que recibió.
    *   Si el usuario envía **TEXTO** ➡️ Alexandra responde únicamente con **TEXTO**.
    *   Si el usuario envía **AUDIO** ➡️ Alexandra responde únicamente con **AUDIO** (OGG/Opus).
2.  **Ley de Transparencia de Cerebro**: Todo proceso cognitivo debe ser registrado. El Dashboard mostrará qué API se utilizó y si representó un costo (Pago vs Gratis).

## 🏗️ Estructura del Sistema

El sistema está dividido en 4 capas modulares:

### 1. Capa Cognitiva (`server/services/aiRouter.js`)
Es el "Cerebro" que decide qué IA utilizar basándose en la complejidad:
*   **Fase 1 (Alex-Brain)**: Se activa para consultas técnicas o complejas (Arquitectura, Código). Es el motor de razonamiento superior.
*   **Fase 2 (Gemini Flash)**: Motor principal por defecto. Es gratuito, rápido y eficiente para conversaciones generales.
*   **Fase 3 (OpenAI Fallback)**: Se activa automáticamente si Gemini falla o está saturado. Es un motor de pago (Garantía de servicio).

### 2. Capa de Orquestación (`server/index-minimal.js`)
Gestor de tráfico que une las piezas:
*   Maneja las conexiones simultáneas (WhatsApp QR via Baileys y WhatsApp Oficial via Meta).
*   Aplica la **Ley de Simetría** (Detecta `audioMsg` vs `text`).
*   Informa al Dashboard en tiempo real mediante Sockets.

### 3. Capa de Salida de Voz (`speakAlex`)
Transforma los pensamientos (texto) en voz humana:
*   Utiliza **OpenAI Onyx** (Pago) o **Google TTS** (Gratis) como respaldo.
*   Realiza una conversión forzada a **OGG/Opus** para asegurar que el audio se reproduzca como "Mensaje de voz" nativo en WhatsApp.

### 4. Capa de Persistencia (`supabaseAuthState.js`)
Asegura que Alexandra no "olvide" quién es ni pierda la conexión cuando el servidor se reinicia, guardando las credenciales de forma segura en Supabase.

---

## 📊 Monitoreo en Dashboard
Ahora, cada vez que Alexandra responde, verás en la consola del Dashboard:
*   `🧠 Cerebro: gemini-flash | 🍃 GRATIS`
*   `🧠 Cerebro: openai-mini | 💸 PAGO`
*   `🧠 Cerebro: alex-brain | 🚀 PRO`

Esto permite un control total sobre el consumo de tokens y la calidad de las respuestas.
