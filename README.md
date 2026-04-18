# Operación Hipócrates · Expediente interactivo

Web estática para GitHub Pages, pensada como actividad gamificada de estadística **sin notebook** y con estructura de **expediente de investigación**.

## Qué incluye
- `index.html`: estructura principal
- `styles.css`: estilos y estética tipo dossier
- `app.js`: lógica interactiva
- `data.js`: datos agregados y registros de fallecimiento integrados

## Qué hace esta versión
- añade una **pantalla inicial de briefing** inspirada en el caso real de Shipman;
- elimina spoilers directos de la solución;
- convierte la práctica en una **sala de análisis con rutas abiertas**;
- incorpora una vista específica de **edad**;
- añade **expediente**, **notas persistentes** y **borrador exportable**;
- refuerza la diferencia entre **anomalía estadística** y **culpabilidad**.

## Publicación en GitHub Pages
1. Crea un repositorio nuevo en GitHub.
2. Sube estos archivos a la raíz del repositorio.
3. Ve a **Settings → Pages**.
4. En **Build and deployment**, selecciona:
   - **Source**: Deploy from a branch
   - **Branch**: `main` y carpeta `/(root)`
5. Guarda los cambios. GitHub te dará la URL pública.

## Personalización rápida
- Para cambiar textos o narrativa, edita `index.html`.
- Para cambiar métricas o lógica de desbloqueo, edita `app.js`.
- Para cambiar colores, layout o estética, edita `styles.css`.
- Si actualizas el dataset, regenera `data.js`.

## Enfoque didáctico
La web está diseñada para que el alumnado:
- explore evidencias sin programar;
- distinga entre descriptiva, contexto e inferencia;
- compare rutas de análisis diferentes;
- no confunda anomalía estadística con culpabilidad;
- termine redactando un informe PDF externo a partir de un borrador exportable.

## Nota técnica
La visualización usa `Chart.js` desde CDN. Si prefieres evitar dependencias externas, puedes descargar la librería y servirla localmente.


## Ajuste de diseño didáctico
- La vista inicial de tasa bruta se presenta en orden neutro (alfabético).
