# MilpaWeb

Página de presentación de **MilpaGrow**, la aplicación de **NEREON** para organizar fincas agrícolas, porcinas y mixtas.

Aquí puedes conocer las funciones de la app, ver ejemplos de consultas a Milpi, resolver dudas y descargar el instalador para Android.

## Cómo usarla

1. Explora la página y conoce lo que ofrece MilpaGrow.
2. Pulsa **Descargar MilpaGrow para Android**.
3. Abre el archivo descargado en tu teléfono y sigue los pasos de instalación.

La aplicación requiere **Android 7.0 o superior**.

La página se adapta a teléfonos y computadoras, incluye un menú móvil y permite elegir entre tema claro y oscuro. Las pantallas y conversaciones mostradas son ejemplos; la gestión de la finca se realiza desde la aplicación.

La web se publica como sitio estático en Render. El botón descarga directamente el archivo `MilpaGrow.apk` de la release marcada **Latest** en [GitHub Releases](https://github.com/WaltzP/MilpaWeb/releases). La descarga funciona sin API, Firebase, servidor Node ni JavaScript.

Para actualizar la app, crea una release en GitHub, adjunta el nuevo APK con el nombre exacto `MilpaGrow.apk`, marca **Set as latest release** y publica. El enlace permanente `/releases/latest/download/MilpaGrow.apk` ofrecerá ese archivo sin reconstruir la web. [Documentación de GitHub](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases).

## Segundo sprint

- Solicitud de demostración sin cuenta, con validación, confirmación después de guardar y reintentos sin duplicados.
- Panel en `admin.html`: cuenta de MilpaGrow, código de correo y permiso administrativo comprobado por la API.
- Gestión de solicitudes, filtros, detalles, estados y notas persistentes en Firestore.
- Carga de APK con progreso, publicación, selección de versión e historial. Los tokens de GitHub permanecen en el servidor.
- Diseño original, menú móvil, interacciones, temas claro/oscuro y movimiento reducido conservados.

Para construir y abrir la página con descarga directa, ejecuta:

```bash
python3 scripts/preparar_render.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory build
```

Las demostraciones y el panel son opcionales y requieren la API de MilpaGrow. Su configuración pública se centraliza en `config.js`, generado durante el build: exporta las tres variables de `.env.example` al entorno o configúralas en Render. Para cargar un `.env` local en Bash, usa `set -a`, `source .env` y `set +a` antes de construir. La API se consulta al usar el formulario o el panel; abrir la página y descargar el APK no hace llamadas a ella.

Consulta [contratos, configuración, primer administrador y despliegue](docs/INTEGRACION_MILPAGROW.md), [entrega al agente del backend](docs/ENTREGA_AGENTE_MILPAGROW.md) y [verificaciones](docs/VERIFICACIONES_SPRINT2.md).

## Pruebas

```bash
npm ci
npx playwright install chromium
npm test
```

Las pruebas del navegador usan servicios simulados. La persistencia, autorización y validación de un APK real se verifican por separado con los emuladores Firebase en MilpaGrow; los comandos y límites están en la documentación.
