# PLAN TÉCNICO PROFESIONAL: CONVERSIÓN SAAS FREEMIUM

## 1. Objetivo
Transformar el ATS de un "filtro" a un "entrenador" con modelo Freemium escalable.

## 2. Arquitectura General
- **Frontend**: Dashboard, Upload, Vista Parcial (Free) vs Completa (Pago).
- **Backend**: Parser, 3 Motores de Evaluación (Claridad, Empleabilidad, Presentación).
- **IA**: Híbrido (Reglas + LLM) para sugerencias.

## 3. Flujo Freemium (Core)
1.  **Ingreso Gratuito**: Email/Social, Upload CV. (Sin pagos).
2.  **Parsing/Normalización**: Extracción de datos (sin edad).
3.  **Evaluación (3 Motores)**:
    -   *Claridad*: ¿Se entiende el rol?
    -   *Empleabilidad*: ¿Cumple mínimos?
    -   *Presentación*: Longitud/Formato.
    -   **Output**: Score Global (0-100).
4.  **Feedback Limitado (Free)**:
    -   3 Problemas detectados.
    -   2 Sugerencias visibles.
    -   Resto: **LOCKED**.

## 4. Diferencial: Motor de Sugerencias
-   Corrección de texto.
-   Explicación de impacto.

## 5. Paywall Inteligente
-   Aparece al intentar: Ver detalle completo, Adaptar país, Simular entrevista.
-   Mensaje: "Tu perfil tiene potencial. Desbloqueá la versión lista para aplicar."

## features por Plan
| Feature | FREE | PAGO |
| :--- | :---: | :---: |
| Upload & Score | ✅ | ✅ |
| Problemas (Top 3) | ✅ | ✅ |
| Sugerencias (Top 2) | ✅ | ✅ |
| **Corrección Completa** | ❌ | ✅ |
| **Reescritura IA** | ❌ | ✅ |
| **Simulación Entrevista** | ❌ | ✅ |

## Estrategia de Implementación Inmediata
1.  Refinar `ATSScanner.jsx` para mostrar solo vista parcial en modo Free.
2.  Actualizar el backend (`careerCoach.js`) para devolver el análisis estructurado en los 3 ejes.
3.  Implementar el bloqueo UI "Blurred/Locked".
