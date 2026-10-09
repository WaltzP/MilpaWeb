# MilpaWeb

Página de presentación de **MilpaGrow**, la aplicación de **NEREON** para organizar fincas agrícolas, porcinas y mixtas.

Aquí puedes conocer las funciones de la app, ver ejemplos de consultas a Milpi, resolver dudas y descargar el instalador para Android.

## Cómo usarla

1. Explora la página y conoce lo que ofrece MilpaGrow.
2. Pulsa **Descargar MilpaGrow para Android**.
3. Abre el archivo descargado en tu teléfono y sigue los pasos de instalación.

La aplicación requiere **Android 7.0 o superior**.

La página se adapta a teléfonos y computadoras, incluye un menú móvil y permite elegir entre tema claro y oscuro. Las pantallas y conversaciones mostradas son ejemplos; la gestión de la finca se realiza desde la aplicación.

La web se publica en Render y consulta la versión vigente desde la API de MilpaGrow. El instalador se ofrece desde GitHub Releases mediante un enlace público, sin iniciar sesión.

La descarga permanece disponible si la API falla o todavía no tiene la ruta de versiones: `dist/android-release.js` contiene los metadatos de la versión pública `android-inicial`, comprobados contra el APK y GitHub. La API tiene prioridad cuando responde; durante un fallo se conserva la última versión confirmada. Una respuesta válida sin versión deshabilita la descarga. Al actualizar la versión de respaldo, comprueba su enlace público, tamaño, SHA-256 y metadatos Android antes de cambiar ese archivo.

## Segundo sprint

- Solicitud de demostración sin cuenta, con validación, confirmación después de guardar y reintentos sin duplicados.
- Panel en `admin.html`: cuenta de MilpaGrow, código de correo y permiso administrativo comprobado por la API.
- Gestión de solicitudes, filtros, detalles, estados y notas persistentes en Firestore.
- Carga de APK con progreso, publicación, selección de versión e historial. Los tokens de GitHub permanecen en el servidor.
- Diseño original, menú móvil, interacciones, temas claro/oscuro y movimiento reducido conservados.

La configuración pública se centraliza en `config.js`, generado durante el build. Copia `.env.example` a `.env`, configura las tres variables públicas y ejecuta:

```bash
set -a
source .env
set +a
python3 scripts/preparar_render.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory build
```

En Render, configura esas mismas variables y usa el blueprint `render.yaml`. Las versiones del APK se actualizan desde la API sin reconstruir la landing.

Consulta [contratos, configuración, primer administrador y despliegue](docs/INTEGRACION_MILPAGROW.md), [entrega al agente del backend](docs/ENTREGA_AGENTE_MILPAGROW.md) y [verificaciones](docs/VERIFICACIONES_SPRINT2.md).

## Pruebas

```bash
npm ci
npx playwright install chromium
npm test
```

Las pruebas del navegador usan servicios simulados. La persistencia, autorización y validación de un APK real se verifican por separado con los emuladores Firebase en MilpaGrow; los comandos y límites están en la documentación.
