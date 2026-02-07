# 📄 Informe Técnico: Diagnóstico de Falla en Despliegue SaaS WhatsApp

**Fecha:** 07 de Febrero, 2026
**Proyecto:** WhatsApp Conversational Core (SaaS Dashboard)
**Estado Actual:** En proceso de mitigación final (Backend Switch).

---

## 1. Resumen Ejecutivo
El dashboard SaaS (`crmwhatsapp-frontend`) presentaba un estado persistente de "Desconectado" y "Esperando QR". Tras el análisis, se determinó que existía una **incompatibilidad arquitectónica crítica**: el Frontend espera comunicarse vía **WebSocket (Socket.io)** con un servidor **Baileys (Web Scraping)** para obtener un QR, pero el Backend desplegado en Render estaba ejecutando una instancia de **WhatsApp Cloud API (Meta Oficial)** a través de `index-minimal.js`, la cual no utiliza QRs ni WebSockets.

Adicionalmente, se identificaron fallos en la construcción de Docker y configuración de entorno que impedían cualquier comunicación efectiva.

## 2. Análisis de Causa Raíz (RCA)

### A. Incompatibilidad de Protocolo (Bloqueante)
*   **Frontend (`WhatsAppConnect.jsx`):** Diseñado para escuchar eventos `wa_qr` y `wa_status` mediante `socket.io-client`.
*   **Backend (`index-minimal.js`):** Implementaba endpoints REST para la API de Meta. **No tenía servidor Socket.io**.
*   **Consecuencia:** El frontend intentaba conectar a un socket inexistente, quedando en un estado de espera infinita ("Esperando actividad...").

### B. Pérdida de Archivos Críticos
*   El archivo original `index-baileys.js` (responsable de la lógica legacy con QR) **no se encontró** en el directorio del servidor durante la auditoría.
*   El `package.json` apuntaba a `index-minimal.js`, forzando el modo Cloud API incompatible con el dashboard visual actual.

### C. Configuración de Despliegue (Docker)
*   **Contexto Erróneo:** Inicialmente, Render intentaba construir el Dockerfile desde la subcarpeta `server/`, perdiendo acceso al código del `client/`.
*   **Environment VITE:** El frontend se desplegó inicialmente sin la variable `VITE_API_URL` correcta, apuntando a `localhost` o `undefined`, rompiendo los enlaces HTTP.

## 3. Acciones Correctivas Ejecutadas

### ✅ 1. Reingeniería del Backend (Monolito Baileys)
Se ha creado un nuevo archivo `server/index-baileys.js` que integra:
*   **Servidor HTTP + Express:** Para servir endpoints de estado.
*   **Socket.io:** Para el canal de comunicación en tiempo real con el frontend.
*   **Motor Baileys:** Para generar la sesión de WhatsApp y el QR.
*   **Integración IA Directa:** Se eliminaron dependencias externas rotas (`openaiClient`) y se integró OpenAI/DeepSeek directamente en el núcleo para asegurar estabilidad.

### ✅ 2. Unificación de Docker
*   Se movió y ajustó el `Dockerfile` a la raíz del proyecto.
*   Se configuró como *Multi-stage Build* para compilar Frontend y Backend en una sola imagen robusta.

### ✅ 3. Corrección de Entorno
*   Se modificó `package.json` para iniciar con `node index-baileys.js`.
*   Se actualizaron las variables de entorno en Render para apuntar el Frontend al Backend correcto.

## 4. Validación y Próximos Pasos

Para dar por resuelta la incidencia, se requiere confirmar los siguientes puntos en el entorno de Producción (Render):

1.  **Backend Logs:** Verificar que en los logs de Render aparezca:
    > `🚀 Baileys Server with Socket.io running on port 10000`
    > (Si aparece "Error" o "Crash", revisar claves de API).
2.  **Conexión Socket:** En el Front, abrir Developer Tools (Network -> WS) y confirmar que la conexión WebSocket devuelve código 101 (Switching Protocols).
3.  **Generación de QR:** Una vez el socket conecta, el evento `wa_qr` debe dispararse en menos de 10 segundos.

---

**Anexo Técnico: Stack Final**
*   **Runtime:** Node.js v18 (Docker Alpine)
*   **Protocolo:** HTTP/1.1 + WebSocket (Socket.io v4)
*   **Librería WA:** @whiskeysockets/baileys v6.6
*   **AI:** OpenAI GPT-4o / DeepSeek (vía Axios)

**Autor:** Agente Técnico - Google Deepmind (Antigravity)
