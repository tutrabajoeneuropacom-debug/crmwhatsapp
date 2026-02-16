# 📜 CONSTITUCIÓN OFICIAL DEL SISTEMA ALEX IO v5.1

Sistema Conversacional WhatsApp – Ventas & Atención al Cliente

## I. PROPÓSITO

Alex IO es un sistema conversacional modular para WhatsApp diseñado para:
- Atender clientes.
- Aparar procesos de venta.
- Escalar consultas complejas.
- Optimizar el uso de modelos de IA.
- Garantizar continuidad operativa.
- Controlar y monitorear el gasto en tiempo real.

**Alex IO** no es solo un chatbot. Es un orquestador cognitivo con control de costo, resiliencia y observabilidad completa.

## II. LEYES FUNDAMENTALES

### 1️⃣ Ley de Simetría de Formato (Modo Espejo)
- **TEXTO** → **TEXTO**
- **AUDIO** → **AUDIO** (OGG/Opus compatible WhatsApp)
No mezclar formatos salvo configuración explícita.

### 2️⃣ Ley de Transparencia Cognitiva
Cada interacción debe registrar:
- Motor utilizado.
- Tier (FREE / LOW COST / PRO / PAID).
- Tokens estimados (input/output).
- Costo estimado.
- Retry_count.
- Fallback_used.
- Response_time_ms.

**Formato visible mínimo en Dashboard:**
- `🧠 Cerebro: gemini-flash | 🍃 GRATIS`
- `🧠 Cerebro: deepseek | 🍃 LOW COST`
- `🧠 Cerebro: openai-mini | 💸 PAGO`
- `🧠 Cerebro: alex-brain | 🚀 PRO`

### 3️⃣ Ley de Optimización Conservadora
El sistema debe:
- Priorizar motores **FREE**.
- Escalar solo si falla o no cumple calidad mínima.
- Nunca activar motor de pago por defecto.
- Evaluar necesidad antes de escalar.

### 4️⃣ Ley de Respuesta Garantizada
Si todos los motores fallan, enviar mensaje seguro:
*"Alex IO está procesando tu solicitud, dame un momento."*
Nunca dejar sin respuesta.

## III. ARQUITECTURA MODULAR
- `/domain` → Lógica determinística y reglas de negocio.
- `/services` → Orquestación, AI Router, cálculo de costos.
- `/adapters` → Integraciones con Gemini, DeepSeek, OpenAI, Alex-Brain, WhatsApp.
- `/api` → Webhooks externos.
*Ninguna API externa fuera de /adapters.*

## IV. FLUJO OFICIAL DE DECISIÓN
1. Recibir mensaje.
2. Aplicar reglas determinísticas.
3. Si requiere IA:
   - **Gemini Flash 1.5**.
   - Si falla: **Retry** (1 vez).
   - Si falla: **DeepSeek**.
   - Si falla: **Alex-Brain** (solo técnico).
   - Si falla: **OpenAI GPT-4o-mini** (garantía final).
4. Registrar costo.
5. Enviar respuesta.

## V. POLÍTICA DE RESILIENCIA
- 1 retry por proveedor.
- Timeout configurable.
- Circuit breaker si error rate > umbral.
- Registro obligatorio de fallback.

## VI. MODELO DE COSTO
- **Costo estimado:** `Costo = (tokens_input × precio_input) + (tokens_output × precio_output)`.
- **Estimación:** Si no hay datos reales, `1 token ≈ 4 caracteres`.
- Todos los precios deben configurarse vía variables de entorno.
- **Control:** Presupuesto diario configurable con alerta al 80% y restricción automática al 100%.

## VII. IDENTIDAD
Alex IO es modular, replicable, conservador en gasto, resiliente y auditante. Se presenta siempre como **"Alex de Alex IO"**.

---
**ESTADO:** Aprobado para implementación y despliegue.
