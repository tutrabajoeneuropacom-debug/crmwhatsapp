# GUÍA DE DESPLIEGUE: TODO EN RENDER (ALL-IN-RENDER)

Es totalmente posible y muy cómodo tener Frontend y Backend en Render.
Deberás crear **dos servicios separados** en tu Dashboard de Render, ambos conectados al mismo repositorio de GitHub.

---

## SERVICIO 1: BACKEND (Node.js / Docker)
Este es el cerebro (WhatsApp + API).

1.  En Render, crea un **"New Web Service"**.
2.  Conecta tu repositorio.
3.  **Configuración Clave:**
    *   **Name:** `whatsapp-saas-backend`
    *   **Root Directory:** `server`  <-- IMPORTANTE
    *   **Environment:** `Docker` (Recomendado) o `Node`.
    *   **Region:** (Elige la más cercana, ej: Oregon o Frankfurt).
4.  **Variables de Entorno (Environment Variables):**
    *   `PORT`: `3000`
    *   `SUPABASE_URL`: ...
    *   `SUPABASE_SERVICE_ROLE_KEY`: ...
    *   `CRM_WEBHOOK_URL`: ...

---

## SERVICIO 2: FRONTEND (Static Site)
Este es tu Dashboard Visual.

1.  En Render, crea un **"New Static Site"**.
2.  Conecta el **mismo repositorio**.
3.  **Configuración Clave:**
    *   **Name:** `whatsapp-saas-frontend`
    *   **Root Directory:** `client` <-- IMPORTANTE
    *   **Build Command:** `npm install && npm run build`
    *   **Publish Directory:** `dist`
4.  **Variables de Entorno:**
    *   `VITE_API_URL`: (Pega aquí la URL que Render generó para tu Backend en el paso anterior, ej: `https://whatsapp-saas-backend.onrender.com`).
    *   `VITE_SUPABASE_URL`: ...
    *   `VITE_SUPABASE_ANON_KEY`: ...
5.  **Rewrites (Importante para React Router):**
    *   Ve a la pestaña "Redirects/Rewrites".
    *   Añade una regla:
        *   **Source:** `/*`
        *   **Destination:** `/index.html`
        *   **Action:** `Rewrite`

---

### VENTAJAS DE USAR SOLO RENDER
*   Todo en un solo lugar (Facturación, Logs).
*   La red interna de Render es muy rápida.
*   Simplifica la gestión de accesos.
