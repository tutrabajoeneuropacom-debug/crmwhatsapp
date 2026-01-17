# 🧠 ESTRATEGIA DE "ALEX": EL ENTREVISTADOR VIRTUAL (V2.0)

Este documento define la lógica pedagógica y técnica para el motor de entrevistas de Career Mastery Engine.

## 1. Visión del Producto
No es un chatbot. Es un **Simulador de Entrenamiento Laboral**.
- **Roles:** Recruiter (Alex) + Coach (Sistema).
- **Objetivo:** Que el usuario falle aquí para no fallar en la entrevista real.

---

## 2. Flujo de Interacción (The Loop)

### A. El Ciclo de Turnos
1.  **Alex (Recruiter):** Hace una pregunta profesional (Audio/Texto).
2.  **Usuario:** Responde (Voz/Texto).
3.  **Sistema (Coach):** Analiza la respuesta en tiempo real.
    -   *Feedback Inmediato:* ¿Qué estuvo mal? ¿Qué faltó? (Se muestra visualmente).
    -   *Sugerencia:* "¿Cómo lo diría un Senior?".
4.  **Alex (Recruiter):** Reacciona a la respuesta (no al feedback) y lanza la siguiente pregunta (o indaga).

---

## 3. Lógica de Capas (Pressure Layers)

El sistema no dispara preguntas al azar. Sigue una curva de dificultad:

### CAPA 1: "The Icebreaker" (Validación Básica)
-   *Objetivo:* Evaluar claridad y "elevator pitch".
-   *Preguntas:* "Cuéntame de ti", "¿Por qué buscas cambio?", "¿Fortalezas/Debilidades?".
-   *Feedback Focus:* Estructura, duración, seguridad.

### CAPA 2: "The Work Probe" (Validación Técnica/CV)
-   *Input:* Se basa estrictamente en el CV y el Job Description cargado.
-   *Objetivo:* Detectar mentiras o exageraciones. Explicar responsabilidades.
-   *Preguntas:* "En [Empresa X] mencionas [Logro Y], ¿cómo lo mediste exactamente?".
-   *Feedback Focus:* Datos concretos, tecnicismos correctos.

### CAPA 3: "The STAR Behavior" (Situacional)
-   *Objetivo:* Evaluar resolución de conflictos y soft skills.
-   *Preguntas:* "Cuéntame un error que cometiste", "Un conflicto con un par".
-   *Feedback Focus:* Metodología STAR (Situación, Tarea, Acción, Resultado). Si falta el "Resultado", el Coach avisa.

### CAPA 4: "The Pressure Cooker" (Cierre/Negociación)
-   *Objetivo:* Control emocional y venta personal.
-   *Preguntas:* "¿Por qué tú y no otro?", "Expectativa Salarial", "¿Tienes otras ofertas?".
-   *Feedback Focus:* Diplomacia, valor, no regalarse.

---

## 4. Estructura de Datos (JSON Response)

Para lograr esto, el Backend (`interviewCoach.js`) debe retornar un JSON estructurado en cada turno, no solo texto plano.

```json
{
  "alex_reply": "Entiendo. Pero si el servidor se cae, ¿cuál es tu plan B?",
  "alex_mood": "skeptical",
  "coach_feedback": {
    "score": 75,
    "bad": "Fuiste muy vago en la parte técnica.",
    "good": "Buen tono de voz.",
    "tip": "Menciona herramientas específicas como Docker o Kubernetes."
  },
  "stage": "CAPA_2_TECHNICAL"
}
```

## 5. Implementación Técnica
-   **Backend:** `interviewCoach.js` usará `response_format: { type: "json_object" }` con GPT-4o.
-   **Frontend:** `InterviewSimulator.jsx` necesita 2 áreas visuales:
    1.  **Chat/Avatar:** Donde habla Alex.
    2.  **Coach Panel (Hud):** Donde aparecen los "Popups" de corrección en tiempo real.

---
CONFIDENCIAL - PUENTES GLOBALES
