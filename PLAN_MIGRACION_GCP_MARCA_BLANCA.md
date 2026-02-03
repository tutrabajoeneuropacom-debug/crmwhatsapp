# Plan de Migración a Google Cloud (GCP) y Transformación a Marca Blanca (SaaS)

Este documento detalla la estrategia técnica para migrar la infraestructura actual (Render/Supabase/Vercel) al ecosistema de Google Cloud Platform (GCP) y adaptar la arquitectura para soportar múltiples clientes como una solución "Marca Blanca" (White Label).

## 1. Mapeo de Infraestructura (El "Google Stack")

Para consolidar todo en Google, reemplazaremos los servicios actuales por sus equivalentes nativos en GCP, ganando control, seguridad y escalabilidad empresarial.

| Componente | Stack Actual | Stack Google Cloud (Propuesto) | Ventajas |
| :--- | :--- | :--- | :--- |
| **Backend** | Render (Node.js) | **Cloud Run** | Serverless, escala a cero (ahorro de costos), contenedores nativos, integración profunda con otros servicios de Google. |
| **Frontend** | Vercel (React) | **Firebase Hosting** | CDN global ultra-rápida, despliegue simple, certificados SSL automáticos. |
| **Base de Datos** | Supabase (Postgres) | **Cloud SQL** (PostgreSQL) o **Firebase** | **Cloud SQL:** Si quieres SQL puro y control total. <br>**Firebase:** Si prefieres desarrollo rápido (NoSQL) y Auth integrado (similar a la experiencia Supabase). |
| **Almacenamiento** | Supabase Storage | **Cloud Storage** | Almacenamiento de objetos masivo y barato (para los CVs, audios, etc.). |
| **IA** | OpenAI (GPT-4) | **Vertex AI** (Gemini Pro) | Menor latencia (todo en la misma red), privacidad de datos empresarial, y costos potencialmente menores. |
| **Auth** | Supabase Auth | **Firebase Auth** / **Identity Platform** | Autenticación robusta (Email, Google, Teléfono) lista para usar. |

---

## 2. Estrategia de Marca Blanca (White Label / Multi-tenancy)

Para vender esto a otras empresas como "su" bot, necesitamos que una sola instancia de tu software sirva a múltiples clientes de forma aislada.

### A. Base de Datos Multi-Tenant
Actualmente, tu base de datos probablemente asume un solo dueño.
*   **Cambio:** Agregar una columna `tenant_id` (ID de Organización) a **todas** las tablas importantes (`users`, `conversations`, `logs`, `uploads`).
*   **Seguridad:** Implementar reglas (Row Level Security) para que un cliente NUNCA pueda leer datos del cliente B.

### B. Gestión Dinámica de Credenciales (El "Cerebro")
Ahora mismo, `WHATSAPP_PHONE_NUMBER_ID` y `OPENAI_API_KEY` están "quemadas" en las variables de entorno (`.env`). Esto solo permite **un** bot.
*   **Cambio:** Crear una tabla `tenants_config` en la base de datos:
    ```json
    {
      "tenant_id": "empresa_x",
      "whatsapp_phone_id": "123456789",
      "whatsapp_token": "token_seguro_encryp...",
      "openai_key": "sk-proj-...",
      "brand_name": "Empresa X",
      "system_prompt_branding": "Eres el asistente de Empresa X..."
    }
    ```
*   **Lógica del Webhook:** Cuando llega un mensaje de WhatsApp, el servidor mira el campo `metadata.phone_number_id` del webhook, busca en la BD a qué cliente pertenece, carga *sus* claves, y responde con *su* personalidad.

### C. Frontend Personalizable
*   **Subdominios:** `cliente1.tuapp.com`, `cliente2.tuapp.com`.
*   **Configuración Dinámica:** Al cargar la web, el frontend consulta una API: "¿Quién es este dominio?". La API devuelve: Logo, Colores Primarios, Título.

---

## 3. Hoja de Ruta de Implementación (Fasses)

### Fase 1: Dockerización y Cloud Run (Infraestructura)
1.  Asegurar que el `Dockerfile` actual funciona perfectamente.
2.  Crear proyecto en GCP.
3.  Desplegar el backend en **Cloud Run**.
4.  Apuntar el dominio actual a Cloud Run.
*Resultado: Mismo software, corriendo en Google.*

### Fase 2: Base de Datos Dinámica
1.  Crear instancia de **Cloud SQL**.
2.  Migrar esquema de Supabase a Cloud SQL.
3.  Implementar la tabla `tenants` y la lógica de carga de credenciales en el código Node.js.
*Resultado: El sistema ya soporta configuración dinámica, aunque siga teniendo un solo cliente.*

### Fase 3: Frontend y Branding
1.  Mover frontend a **Firebase Hosting**.
2.  Implementar lógica de "Theming" en React.
3.  Configurar DNS para soportar wildcards (`*.tuapp.com`).

### Fase 4: Migración de IA (Opcional pero Recomendado)
1.  Crear adaptadores en el código (ya tenemos `aiRouter.js`, es fácil) para usar **Vertex AI (Gemini)**.
2.  Comparar calidad y costos.

## 4. Costos Estimados (Google Cloud)
Para una startup en crecimiento:
*   **Cloud Run:** Free tier generoso (2 millones de peticiones/mes gratis). Pagas solo por CPU/memoria usados al procesar mensajes.
*   **Cloud SQL:** Es el componente más caro. Una instancia micro cuesta ~$10-20 USD/mes. *Truco:* Usar **Firestore** (NoSQL) puede ser mucho más barato al inicio (pago por uso real).
*   **Firebase Hosting:** Gratis (límites generosos).

## Conclusión
La migración es **totalmente viable** y es el paso correcto para escalar comercialmente. La arquitectura actual en Node.js modularizada facilita mucho este proceso. Lo más complejo no es "mover a Google", sino **refactorizar el código para que deje de pensar en "un solo bot" y empiece a pensar en "cientos de bots"**.
