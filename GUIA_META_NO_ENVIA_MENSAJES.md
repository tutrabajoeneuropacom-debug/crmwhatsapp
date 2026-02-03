# Guía de Resolución: WhatsApp Bot "Sordo" (Sin Webhooks)

**URL DIRECTA PARA CONFIGURAR:** [https://developers.facebook.com/apps/1222788103323500/whatsapp-business/wav2/apisetup/](https://developers.facebook.com/apps/1222788103323500/whatsapp-business/wav2/apisetup/)

Si el servidor está funcionando y la verificación del webhook (GET) es exitosa, pero **no llegan mensajes (POST)**, el problema es **100% de configuración en Meta**.

Sigue estos pasos en orden para resolverlo.

---

## 🟢 Paso 1: Agregar tu Número como "Tester" (CRÍTICO)

Mientras tu app de Meta esté en modo **"Development"**, solo puede recibir mensajes de números autorizados.

1. Ve a [Meta for Developers](https://developers.facebook.com/).
2. Selecciona tu App (`puentesglobales - Test2`).
3. En el menú izquierdo, busca **WhatsApp** > **API Setup**.
4. Desplázate hacia abajo hasta que veas la sección **"Send and receive messages"**.
5. Verás un campo "To" (Para). Haz clic en **"Manage phone number list"** o agrégalo directamente ahí.
### Cómo agregar el número (Interfaz en Español):

1.  En el **Menú de la Izquierda**, busca **WhatsApp**.
2.  Haz clic en **Prueba de API** (Justo debajo de "Inicio rápido").
3.  En la pantalla central, busca la sección **"Paso 2: Enviar mensajes con la API"**.
4.  Verás un campo que dice **"Para"**.
5.  Haz clic en ese menú desplegable y selecciona **"Administrar lista de números de teléfono"**.
6.  Ahí podrás agregar tu número y recibir el código.

**Prueba:** Intenta enviar "Hola" de nuevo. Si responde, ¡listo!

---

## 🟢 Paso 2: Verificar Suscripción a "messages" (MUY IMPORTANTE)

Si ya agregaste tu número, el siguiente paso es conectar el "cable".

⚠️ **¡CUIDADO!** Hay dos menús de "Configuración".
- NO uses el de arriba ("Configuración de la app").
- **USA EL DE ABAJO ("WhatsApp" > "Configuración").**

1. En el menú de la izquierda, despliega **WhatsApp**.
2. Haz clic en **Configuración** (dentro de WhatsApp).
3. Busca la sección **Campos del webhook** (en la parte inferior).
4. Verás una tabla con columnas: **Campo**, **Versión**, **Prueba**, **Suscribirse**.
5. Busca en esa lista **`messages`**.
6. En la columna "Suscribirse", haz clic en el botón (o check) para activarlo (**Esto ya lo hiciste, se ve excelente**).

---

## 🟢 Paso 3: La Prueba Definitiva ("Probar")

Ya que está activado, vamos a forzar un mensaje de prueba desde ahí mismo.

1.  En esa misma fila de **`messages`**, haz clic en el enlace azul **Probar**.
2.  **¡IMPORTANTE!** Se abrirá una ventana emergente.
3.  En esa ventana, haz clic en el botón azul **"Enviar prueba"** (Send Test).
    - *Si no haces clic aquí, no se envía nada.*
4.  **Ve inmediatamente a los logs de Render.**

**¿Apareció algo nuevo en los logs?**
- Si aparece `📨 Webhook received`: El "tubo" funciona. El problema es tu celular.
- Si **NO** aparece nada: El servidor no está recibiendo nada.

---

---

---

## 🟢 Paso 3: Probar con el "Test" de Meta

Para descartar problemas con tu celular, usemos el simulador del servidor de Meta.

1. Ve a **WhatsApp** > **Configuration**.
2. Busca el botón **"Test"** (suele estar arriba cerca del Callback URL).
3. Selecciona el campo `messages`.
4. Haz clic en **"Send Test"**.

**Resultado esperado:**
- Deberías ver en los logs de Render inmediatamente `📨 Webhook received`.
- Si esto funciona pero tu celular no, vuelve al Paso 1 (es problema de permisos de número).
- Si esto **NO** funciona (y el GET sí funciona), revisa el Paso 2 (suscripción).

---

## 🟢 Paso 4: Revisar URL del Webhook

Asegúrate de no tener espacios en blanco.

1. URL correcta: `https://crmwhatsapp-xari.onrender.com/api/webhook/whatsapp`
2. Si tienes `http` en lugar de `https`, cámbialo a `https`.

---

## Resumen

El servidor está perfecto. El "tubo" que conecta Meta con tu servidor está cortado en el extremo de Meta. Al hacer estos pasos, estarás conectando ese cable.
