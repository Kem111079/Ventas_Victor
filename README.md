# Ventas de Víctor · App instalable

Aplicación móvil PWA para registrar ventas al contado y crédito, abonos, ajustes, saldos, estados de cuenta e informes Excel.

## Publicar en GitHub Pages

1. Cree un repositorio nuevo en GitHub.
2. Suba **todo el contenido de esta carpeta**, respetando las subcarpetas.
3. Verifique que la rama principal se llame `main`.
4. Entre a **Settings → Pages**.
5. En **Build and deployment → Source**, seleccione **GitHub Actions**.
6. Abra la pestaña **Actions** y espere que el flujo “Publicar Ventas de Víctor” termine con marca verde.
7. GitHub mostrará la dirección pública de la aplicación.

## Instalar en Android

1. Abra la dirección de GitHub Pages en Chrome.
2. Pulse **Instalar en este teléfono** dentro de la app.
3. Si el botón no aparece, use el menú de Chrome → **Instalar aplicación** o **Agregar a pantalla principal**.

## Instalar en iPhone o iPad

1. Abra la dirección en Safari.
2. Pulse **Compartir**.
3. Seleccione **Agregar a pantalla de inicio**.

## Protección de datos

- Los registros se guardan localmente en el dispositivo y navegador donde se utiliza la app.
- No borre los datos del navegador sin generar antes un respaldo JSON.
- Genere respaldos periódicos desde **Más → Guardar respaldo**.
- Al cambiar de teléfono, restaure el archivo JSON desde la aplicación.

## Archivos esenciales

- `index.html`: aplicación completa.
- `manifest.webmanifest`: identidad e instalación de la PWA.
- `service-worker.js`: funcionamiento sin conexión.
- `assets/icons/`: logo e iconos.
- `.github/workflows/deploy-pages.yml`: publicación automática en GitHub Pages.
- `.nojekyll`: publicación directa como sitio estático.

## Actualizaciones

Reemplace los archivos en el repositorio y confirme los cambios. GitHub Pages publicará la nueva versión automáticamente. Los registros locales se conservan mientras no cambie la dirección del sitio ni se borren los datos del navegador.
