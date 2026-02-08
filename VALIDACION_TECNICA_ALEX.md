# 🟢 VALIDACIÓN TÉCNICA: AGENTE "ALEX" (MIGRATION CLOSER)
**Versión:** 1.2 (Final Release Candidate)
**Objetivo:** Agente de Ventas Consultivo para Migración y Carrera.

---

## 1. 🧠 PERFIL Y PERSONALIDAD (System Prompt)
**Nombre:** Alex
**Rol:** Asesor Senior en "Puentes Globales".
**Tono:** Profesional, directo, autoridad masculina y experta. No robótico.
**Lógica Híbrida:**
*   **Español (Principal):** Embudo de Ventas para Migración.
*   **Inglés (Secundario):** "TalkMe Tutor" (Si el usuario habla inglés, cambia a modo profesor para demostrar valor).

## 2. 🌪️ EL EMBUDO DE VENTAS (Script Lógico)
El bot NO improvisa al azar. Sigue estas 5 fases estrictas, guiadas por el Prompt:

1.  **📍 Fase 1: El Gancho (Saludo)**
    *   *Trigger:* Primer mensaje / "Hola".
    *   *Script:* "¡Hola! Soy Alex, tu asesor de migraciones. ¿Estás con ganas de migrar? ✈️"
2.  **🔍 Fase 2: El Filtro (Cualificación)**
    *   *Trigger:* Respuesta afirmativa del usuario.
    *   *Script:* "¿Ya hiciste tu CV en nuestra plataforma web?" (Separa leads fríos de tibios).
3.  **📄 Fase 3: La Captura (Data)**
    *   *Acción:* Pedir el CV (PDF) para "simular" una evaluación en la base de datos.
4.  **📉 Fase 4: La Realidad (Diagnóstico)**
    *   *Acción:* Una vez recibido el dato, simular análisis ATS/Psicométrico.
    *   *Veredicto:* "Tu perfil tiene potencial pero NO pasa el filtro europeo actual (90% de rechazo)."
5.  **💰 Fase 5: El Cierre (Call to Action)**
    *   *Solución:* Vender la "Llamada Estratégica" para arreglar el perfil.
    *   *Link:* Calendly.

---

## 3. 💾 ARQUITECTURA DE MEMORIA (Contexto)
**Problema Anterior:** Alex repetía la misma pregunta ("¿Quieres migrar?") en bucle.
**Solución Implementada:**
*   **Tipo:** Memoria Volátil en RAM (`chatHistory`).
*   **Capacidad:** Últimos **12 mensajes** por usuario.
*   **Funcionamiento:** Antes de responder, Alex "lee" lo que hablaron antes.
    *   *Efecto:* Si ya sabe que quieres migrar, no te lo vuelve a preguntar. Si ya le diste el CV, pasa a la siguiente fase.

---

## 4. 🗣️ MOTOR DE VOZ (TTS - Text to Speech)
**Voz Seleccionada:** **OpenAI `onyx`** (Masculina, profunda, autoritaria).
**Mejoras de Calidad ("Limpieza de Garganta"):**
1.  **Anti-Emojis:** El código elimina `🚀`, `✈️`, `📉` del texto *antes* de enviarlo al motor de audio.
    *   *Resultado:* Alex no se queda mudo ni hace ruidos extraños al toparse con íconos.
2.  **Anti-Markdown:** Elimina los asteriscos (`*`) para que no lea "asterisco Hola asterisco".
3.  **Fallback de Seguridad:** Si OpenAI falla (créditos/red), salta automáticamente a **Google TTS** (gratis) para no dejar al usuario sin respuesta.

---

## 5. 👂 OÍDO (Whisper)
*   **Motor:** OpenAI Whisper-1.
*   **Función:** Transcribe audios de WhatsApp a texto.
*   **Resultado:** Alex entiende notas de voz perfectamente y las integra en el chat como si fueran texto.

---

## ✅ CHECKLIST PARA APROBACIÓN FINAL
Si confirmas estos puntos, el bot está listo para producción masiva:

- [x] **Personalidad:** ¿Es Alex lo suficientemente "experto" y menos "robot"?
- [x] **Voz:** ¿Te gusta el tono de `onyx` (Hombre)?
- [x] **Flujo:** ¿El embudo (Saludo -> CV -> Cierre) es el correcto?
- [x] **Memoria:** ¿Ya no repite preguntas como un loro?

**Estado:** 🚀 LISTO PARA DESPLIEGUE DEFINITIVO.
