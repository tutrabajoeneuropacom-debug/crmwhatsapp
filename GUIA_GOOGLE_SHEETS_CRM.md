# GUÍA DE INTEGRACIÓN: GOOGLE SHEETS COMO CRM

Sigue estos pasos para convertir una Hoja de Cálculo de Google en tu CRM receptor de Leads de WhatsApp.

## 1. Preparar la Hoja de Cálculo
1.  Ve a [Google Sheets](https://sheets.google.com/) y crea una hoja nueva llamada **"Leads WhatsApp"**.
2.  En la primera fila (encabezados), escribe:
    *   Columna A: `Fecha`
    *   Columna B: `Nombre`
    *   Columna C: `Teléfono`
    *   Columna D: `Mensaje`
    *   Columna E: `Fuente`

## 2. Crear el Script Receptor
1.  En la hoja, ve al menú **Extensiones** > **Apps Script**.
2.  Se abrirá una pestaña nueva con código. Borra todo y pega esto:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Parsear los datos que vienen del Bot de WhatsApp
    var data = JSON.parse(e.postData.contents);
    var fields = data.fields || {}; // Adaptador para el formato Bitrix que ya programamos
    
    // Extraer datos (Formato Bitrix o Plano)
    var timestamp = new Date();
    var name = fields.NAME || data.name || "Desconocido";
    var phone = "N/A";
    
    // Manejo seguro del teléfono (array u objeto)
    if (Array.isArray(fields.PHONE) && fields.PHONE.length > 0) {
      phone = fields.PHONE[0].VALUE;
    } else {
      phone = data.phone || "N/A";
    }
    
    var query = fields.COMMENTS || data.query || "";
    var source = "WhatsApp Bot";

    // Guardar en la hoja
    sheet.appendRow([timestamp, name, phone, query, source]);

    return ContentService.createTextOutput(JSON.stringify({"status": "success"})).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. Publicar y Obtener URL
1.  Haz clic en el botón azul **"Implementar" (Deploy)** (arriba a la derecha) > **"Nueva implementación"**.
2.  En la ventana que sale:
    *   **Tipo:** Selecciona el engranaje ⚙️ > **Aplicación web**.
    *   **Descripción:** "Webhook WhatsApp".
    *   **Ejecutar como:** "Yo" (Tu email).
    *   **Quién tiene acceso:** **"Cualquier usuario" (Anyone)** <-- ¡CRUCIAL!
3.  Haz clic en **"Implementar"**.
4.  Te pedirá permisos ("Autorizar acceso"), dáselos. (Si sale "Google no ha verificado esta aplicación", dale a Avanzado > Ir a proyecto (no seguro)).
5.  Copia la **URL de la aplicación web** (termina en `/exec`).

## 4. Configurar en Render
1.  Esa URL larga es tu `CRM_WEBHOOK_URL`.
2.  Pégala en las variables de entorno de Render.
