# Operación Hipócrates · Web interactiva

Web estática para GitHub Pages, pensada como actividad gamificada de estadística sin notebook.

## Qué incluye
- `index.html`: estructura principal
- `styles.css`: estilos
- `app.js`: lógica interactiva
- `data.js`: datos agregados y registros de fallecimiento integrados

## Publicación en GitHub Pages
1. Crea un repositorio nuevo en GitHub.
2. Sube estos archivos a la raíz del repositorio.
3. Ve a **Settings → Pages**.
4. En **Build and deployment**, selecciona:
   - **Source**: Deploy from a branch
   - **Branch**: `main` y carpeta `/root`
5. Guarda los cambios. GitHub te dará la URL pública.

## Personalización rápida
- Para cambiar textos o preguntas, edita `index.html`.
- Para cambiar lógica o métricas, edita `app.js`.
- Para cambiar colores o layout, edita `styles.css`.
- Si actualizas el dataset, regenera `data.js`.

## Enfoque didáctico
La web está diseñada para que el alumnado:
- explore evidencias sin programar;
- distinga entre descriptiva, comparación e inferencia;
- no confunda anomalía estadística con culpabilidad;
- termine redactando un informe PDF externo.

## Nota técnica
La visualización usa `Chart.js` desde CDN. Si prefieres evitar dependencias externas, puedes descargar la librería y servirla localmente.
