# PLAN TÉCNICO: SISTEMA CONVERSACIONAL WHATSAPP (SAAS EMPRENDEDORES)

## 1. Visión del Producto
Sistema SaaS para emprendedores que automatiza la atención al cliente, monitorea oportunidades en WhatsApp e **integra leads con CRMs (Bitrix24, HubSpot, etc.)**.

## 2. Funcionalidades Core
1.  **Dashboard de Control**:
    -   Estado de conexión (QR Code).
    -   Log en vivo.
2.  **Motor de Escucha & Respuestas**:
    -   Detección de intenciones (IA).
    -   Respuestas automáticas.
3.  **Integración CRM (Nuevo)**:
    -   **Webhooks Salientes**: Enviar datos de leads (nombre, teléfono, mensaje) a Bitrix24/Zapier cuando se detecta una oportunidad.
    -   **Sincronización**: Crear prospectos automáticamente desde WhatsApp.

## 3. Arquitectura Técnica
-   **Frontend**: React (Vercel).
-   **Backend**: Node.js + `whatsapp-web.js` + Puppeteer (Render).
-   **Base de Datos**: Supabase (Nueva instancia).
-   **Integraciones External**: `axios` para POST a Webhooks de Bitrix24.

## 4. Flujo de Datos CRM
1.  Mensaje recibido en WhatsApp.
2.  IA analiza: ¿Es un Lead potencial? (Ej: Pide precio).
3.  **Si es Lead** -> Backend envía POST request a Webhook de Bitrix24.
4.  Bitrix24 crea el Lead en su pipeline.

## 5. Deployment (Separado)
-   Nuevo repositorio GitHub.
-   Nuevo proyecto Supabase.
-   Deploy Backend en Render (Docker).
-   Deploy Frontend en Vercel.
