# 🚀 ESTRATEGIA Y ARQUITECTURA: MOTOR DE IA "PUENTES GLOBALES"
## De "Chatbot" a "Equipo Virtual de Reclutamiento"

Este documento define la arquitectura técnica y comercial para la plataforma **Career Mastery Engine**. Ya no es una idea teórica, sino una estructura de software lista para escalar.

---

## 1. ARQUITECTURA DEL EQUIPO VIRTUAL (The Core)

No usamos "una IA". Hemos diseñado un **pipeline de agentes especializados** que replican un departamento de RRHH real.

### 🤖 Agente 1: El Gatekeeper (ATS Parser)
*   **Función:** Filtrado duro y análisis semántico.
*   **Lógica:** No dialoga. Analiza JSON vs JSON.
*   **Input:** CV (PDF) + Job Description.
*   **Output:** `Score (0-100)`, `Missing_Keywords`, `Critical_Flags`.
*   **Regla de Negocio:** Si Score < 80% → **BLOQUEO**. El usuario no pasa a entrevista hasta corregir su CV. "No quemamos cartuchos de entrevista si el papel no funciona".

### 🔎 Agente 2: "Alex" - El Recruiter (Hardcore Mode)
*   **Perfil:** Senior Technical Recruiter. Escéptico, distante, orientado a resultados.
*   **Objetivo:** Validar la veracidad del CV y encontrar "red flags".
*   **Configuración Técnica:**
    *   *Temp:* 0.3 (Baja creatividad, alta precisión).
    *   *System Prompt:* "Estás aquí para filtrar. Si la respuesta es vaga, interrumpe. Exige metodología STAR."
*   **Idiomas:** Español, Inglés, Alemán (Detección automática).

### 🎓 Agente 3: "Alex" - El Coach (Educational Mode)
*   **Perfil:** Mentor de Carrera Empático.
*   **Objetivo:** Enseñanza y mejora continua.
*   **Mecánica:** Interrumpe la simulación *meta-juego* para explicar errores.
*   **Configuración Técnica:**
    *   *Temp:* 0.7 (Más creativo y explicativo).
    *   *System Prompt:* "Eres un profesor. Si el usuario falla, explica por qué y dale un ejemplo mejor."

---

## 2. IMPLEMENTACIÓN TÉCNICA (The Stack)

### A. Prompt Engineering & Logic
*   **Memory Handling:** Ventana de contexto deslizante (últimos 10 mensajes) para mantener coherencia sin gastar tokens excesivos.
*   **Context Injection:** En la primera interacción, inyectamos invisiblemente al prompt:
    1.  El Rol buscado (ej: "Junior React Dev").
    2.  La Industria (ej: "Fintech").
    3.  Los Puntos Débiles del ATS (ej: "El candidato no menciona experiencia en Testing").
    *   *Resultado:* Alex pregunta: *"Veo que no mencionas Testing en tu CV, ¿cómo garantizas la calidad de tu código?"* (Pregunta quirúrgica real).

### B. Speech Pipeline
*   **Input:** Whisper (OpenAI) para transcripción precisa multilingüe.
*   **Processing:** LLM (GPT-4o) con latencia optimizada.
*   **Output:** ElevenLabs (Voces ultra-realistas) para inmersión total.

---

## 3. MODELO DE NEGOCIO Y ESCALABILIDAD

### A. Producto B2C (El Candidato)
*   **Freemium:** ATS Scan básico + Entrevista de diagnótico (5 mins).
*   **Premium:**
    *   Editor de CV con IA.
    *   Entrenador "Alex" ilimitado.
    *   Simuladores de Nicho (IT, Hospitality, Salud).

### B. Producto B2B (La Empresa / Academia)
*   **"Candidatos Pre-Verificados":**
    *   Ofrecemos a empresas una base de talento que ya pasó:
        1.  Filtro ATS > 85%.
        2.  Entrevista Técnica con Alex (con grabación y score).
    *   *Valor:* Ahorramos las primeras 2 rondas de entrevista a los recruiters humanos.
*   **Licenciamiento:** Vender la API de "Alex" a academias de inglés que quieran ofrecer módulos de "English for Work".

---

## 4. LANZAMIENTO MVP (Inmediato)
Objetivo: Validar venta y uso en **7 días**. Usamos lo que ya tenemos.

1.  **Día 1-2 (Deploy & Calidad):**
    *   Subir versión actual con el nuevo Logo y la Lógica ATS/Roleplay conectada.
    *   Verificar en producción que "Alex" responda fluidamente en Español, Inglés y Alemán.

2.  **Día 3-5 (Tráfico & Prueba):**
    *   Enviar tráfico real (LinkedIn/Ads) a la Landing Page.
    *   **Métrica Clave:** ¿Cuántos usuarios completan el Scanner ATS gratuito?

3.  **Día 6-7 (Validación de Venta):**
    *   A los usuarios con Score bajo (<60%), ofrecerles desbloquear el "Entrenador Alex" (Roleplay) con un pago único o suscripción.
    *   *Si pagan:* Tenemos negocio. Expandimos el roadmap.
    *   *Si no pagan:* Ajustamos el mensaje, no el código.

> **Filosofía MVP:** "Vender lo que ya hay". No construimos más funcionalidades complejas hasta validar que el usuario paga por desbloquear la entrevista.
