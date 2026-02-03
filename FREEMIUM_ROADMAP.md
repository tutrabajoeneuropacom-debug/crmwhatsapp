# 🚀 ROADMAP: ATS Freemium SaaS Architecture

Este documento define la hoja de ruta técnica para transformar el ATS en un producto SaaS escalable.

## 1️⃣ Fase 1: Fundamentos del Modelo Freemium (Backend)
**Objetivo:** Soportar usuarios Free vs Premium y proteger el valor.

- [ ] **Base de Datos (Supabase):**
    - [ ] Agregar columna `subscription_tier` ('free', 'basic', 'pro') a `profiles`.
    - [ ] Agregar columna `credits_remaining` (para modelos de pago por uso).
    - [ ] Agregar tabla `analysis_logs` para tracking de uso.
- [ ] **Backend (API):**
    - [ ] Middleware `checkSubscription`.
    - [ ] Modificar `analyzeCV` para devolver feedback censurado ("LOCKED") si es Free.
    - [ ] Endpoint `upgrade-plan` (Mock para inicio, luego Stripe).

## 2️⃣ Fase 2: Experiencia de Usuario (Frontend)
**Objetivo:** Mostrar valor inmediato pero incentivar la conversión.

- [ ] **ATS Scanner:**
    - [ ] Mostrar Score General (Gratis).
    - [ ] Mostrar 2 problemas/sugerencias (Gratis).
    - [ ] **Blur/Lock** en el resto del análisis detallado.
    - [ ] Botón "Desbloquear Reporte Completo" (Paywall Trigger).
- [ ] **Corrector/Editor CV:**
    - [ ] Modo "Read Only" para Free.
    - [ ] Modo "Edit & Export" para Premium.

## 3️⃣ Fase 3: Motor Avanzado & Roleplays
**Objetivo:** Diferenciación y Retención (Producto PRO).

- [ ] **Entrevistas Simuladas:**
    - [ ] Limitar duración audio para Free (ej. 1 min).
    - [ ] Escenarios básicos (General HR) para Free.
    - [ ] Escenarios PRO (IT, Call Center, Hospitality) bloqueados.
- [ ] **Reportes de Progreso:**
    - [ ] Gráficas de mejora en el tiempo (Solo Pro).

## 4️⃣ Fase 4: Monetización & Analytics
- [ ] Integración Stripe/MercadoPago.
- [ ] Dashboard de Conversión (Admin).

---

## 🛠️ Stack Tecnológico Definido

- **Frontend:** React 18 + Vite + Tailwind + Framer Motion (Stable).
- **Backend:** Node.js Express + OpenAI (GPT-4o) + Supabase.
- **DB:** Supabase (PostgreSQL).
- **Payments:** Stripe (Futuro).
- **Analytics:** PostHog o Supabase Analytics.

---

## 📋 Próximo Paso Inmediato (TODO)

1. Ejecutar script SQL para actualizar esquema de `profiles`.
2. Implementar lógica de "Censura" en el backend `careerCoach.js`.
