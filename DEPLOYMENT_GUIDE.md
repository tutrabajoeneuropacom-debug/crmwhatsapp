# GUÍA DE DESPLIEGUE (DEPLOYMENT GUIDE)

Tu arquitectura es correcta: **GitHub + Supabase + Render**.
Para que funcione, asegúrate de configurar las "Root Directories" (directorios raíz) correctamente, ya que tienes `client` y `server` en el mismo repositorio.

---

## 1. GITHUB (Repositorio)
Asegúrate de que tu repo tenga esta estructura:
```
/ (raíz)
  ├── client/  (Frontend)
  ├── server/  (Backend)
  └── ...
```

---

## 2. RENDER (Backend)
Al crear el "Web Service" en Render conectado a tu GitHub:

*   **Name:** `whatsapp-saas-backend` (o lo que quieras)
*   **Root Directory:** `server`  <-- **MUY IMPORTANTE**
*   **Environment:** `Docker` (Recomendado, ya creé el Dockerfile) o `Node`.
    *   *Si eliges Docker:* No necesitas configurar build commands.
    *   *Si eliges Node:*
        *   Build Command: `npm install`
        *   Start Command: `node index.js`
*   **Environment Variables (Variables de Entorno):**
    *   `PORT`: `3000`
    *   `SUPABASE_URL`: (Tu URL de Supabase)
    *   `SUPABASE_SERVICE_ROLE_KEY`: (Tu llave service_role de Supabase)
    *   `CRM_WEBHOOK_URL`: (Tu Webhook de Bitrix24, opcional)
    *   `OPENAI_API_KEY`: (Tu llave de OpenAI)

---

## 3. SUPABASE (Base de Datos)
1.  Ve al **SQL Editor**.
2.  Copia y pega el código SQL que te di anteriormente para crear la tabla `profiles` y `message_logs`.
3.  Ve a **Project Settings > API** para obtener tu URL y Keys.

---

## 4. VERCEL (Frontend)
Al importar el proyecto desde GitHub:

*   **Root Directory:** `client` <-- **MUY IMPORTANTE**
    *   (Vercel te preguntará "¿Quieres editar el Root Directory?", dile que SÍ y selecciona `client`).
*   **Build Command:** `npm run build` (Default)
*   **Output Directory:** `dist` (Default)
*   **Environment Variables:**
    *   `VITE_API_URL`: (La URL que te dio Render, ej: `https://whatsapp-saas-backend.onrender.com`)
    *   `VITE_SUPABASE_URL`: (Tu URL de Supabase)
    *   `VITE_SUPABASE_ANON_KEY`: (Tu llave anon/public de Supabase)

---

### ¿Cómo saber si funcionó?
1.  Abre tu URL de Vercel.
2.  Deberías ver el Dashboard "WhatsApp Command Center".
3.  Si Render está cargando, verás "Esperando QR..." o el QR code.
4.  Escanea el QR y ¡listo!
