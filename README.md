# RE+ Leads | VMS Energy

Formulario estatico para captura de leads en evento, con enfoque offline-first y modo PWA.

## Archivos

- `index.html`: interfaz del formulario.
- `styles.css`: estilo visual.
- `app.js`: guardado local, cola de envio y exportacion CSV.
- `manifest.webmanifest`: configuracion de app instalable.
- `service-worker.js`: cache local para uso sin red.

## Como usar

1. Abre `index.html` en la laptop o tablet del booth.
2. Captura cada lead y presiona `Guardar lead`.
3. Si no hay red, el registro queda guardado localmente.
4. Cuando vuelva la red, usa `Intentar envio` si ya configuraste el webhook.
5. Como respaldo, usa `Exportar CSV` para sacar todos los registros.
6. Usa `Exportar y marcar corte` para generar un archivo de corte con timestamp.
7. Usa `Preparar correo` para abrir tu cliente de email con el mensaje listo.

## Configurar envio automatico a OneDrive

La forma recomendada para escribir en `Registro_REplus.xlsx` en OneDrive es:

1. Crear un flujo en Power Automate con trigger `When an HTTP request is received`
2. Agregar una accion `Add a row into a table`
3. Seleccionar:
   - Location: OneDrive for Business
   - Document Library: OneDrive
   - File: `Registro_REplus.xlsx`
   - Table: una tabla de Excel, por ejemplo `LeadsREPlus`
4. Mapear las columnas del Excel con los campos del JSON que envia esta app
5. Copiar la URL del trigger HTTP y pegarla en `WEBHOOK_URL` dentro de `app.js`

En `app.js`, cambia:

```js
const WEBHOOK_URL = "";
```

por la URL del flujo HTTP de Power Automate.

El formulario enviara cada lead como JSON via `POST`.

### Campos que enviara al flujo

- `nombreContacto`
- `empresa`
- `paisCiudad`
- `industria`
- `cargoContacto`
- `email`
- `telefono`
- `asesorEquipo`
- `consumoMensual`
- `demandaMaxima`
- `nivelTension`
- `penalizacionesDemanda`
- `plantaSolar`
- `respaldo`
- `respaldoTexto`
- `interesPrincipal`
- `interesPrincipalTexto`
- `serviciosInteres`
- `serviciosInteresTexto`
- `horizonteProyecto`
- `notas`
- `ctaEvaluacion`
- `createdAt`
- `ultimoCorte`
- `syncStatus`
- `syncAttempts`

## Envio por correo

El boton `Preparar correo` abre el cliente de correo dirigido a `mcalderon@vmsenergy.com`.

Limitacion importante:

- El navegador no puede adjuntar automaticamente el CSV a un correo
- Primero hay que exportar el CSV y luego adjuntarlo manualmente

## Uso en telefono

Si, la PWA puede usarse en telefono.

- En Android: abre la URL en Chrome y usa `Agregar a pantalla de inicio`
- En iPhone: abre la URL en Safari y usa `Compartir > Agregar a inicio`
- Una vez instalada, puede abrirse como app y seguir capturando aunque la red falle

Importante: para que el navegador permita instalarla como PWA, conviene servirla desde `https` o desde un servidor local durante pruebas.

## Recomendacion para el evento

La opcion mas segura para RE+ es esta combinacion:

1. Captura local en el dispositivo
2. Exportacion manual a CSV como respaldo inmediato
3. Sincronizacion automatica a un webhook cuando haya conectividad

Eso evita depender de internet en el momento de la captura.

## Opciones de almacenamiento y envio

### Opcion 1: Simple y rapida

- Almacenaje: `localStorage` en el navegador
- Envio: CSV manual + webhook cuando haya red
- Ideal para: una sola laptop o tablet y volumen moderado

### Opcion 2: Mas robusta

- Almacenaje: `IndexedDB`
- Envio: cola de sincronizacion con reintentos
- Ideal para: muchos registros, adjuntos, o uso prolongado

### Opcion 3: Operacion multi-dispositivo

- Almacenaje: local en cada equipo
- Envio: cada dispositivo sincroniza a Airtable, Sheets o CRM
- Respaldo: exportar CSV por dispositivo al cierre del dia
- Ideal para: varios asesores capturando en paralelo

## Recomendacion concreta

Si el evento puede tener mala red, yo usaria:

- Frontend local como este formulario
- Webhook de Power Automate o Google Apps Script
- Consolidacion final en Excel, Google Sheets o CRM
- Exportacion CSV al final de cada jornada aunque todo haya sincronizado bien

## Branding

El proyecto ya esta preparado para recibir los logos finales de VMS y RE+.

- Si me compartes los archivos del logotipo, los integro en el header y en los iconos de la PWA
- Lo ideal es recibirlos en `SVG` o `PNG` con fondo transparente

## Nota tecnica

No pude correr validacion automatica con `node` en esta maquina porque no esta instalado. La verificacion fue estructural sobre los archivos generados.
