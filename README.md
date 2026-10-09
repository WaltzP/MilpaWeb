# MilpaWeb

Página de presentación de **MilpaGrow**, la aplicación de **NEREON** para organizar fincas agrícolas, porcinas y mixtas.

Aquí puedes conocer las funciones de la app, ver ejemplos de consultas a Milpi, resolver dudas y descargar el instalador para Android.

## Cómo usarla

1. Explora la página y conoce lo que ofrece MilpaGrow.
2. Pulsa **Descargar MilpaGrow para Android** e inicia sesión o crea tu cuenta.
3. Confirma el código enviado a tu correo y descarga el instalador.
4. Abre el archivo en tu teléfono e inicia sesión en la app con el mismo correo y contraseña. Allí completarás tu perfil y los datos de tu finca.

La aplicación requiere **Android 7.0 o superior**.

La página se adapta a teléfonos y computadoras, incluye un menú móvil y permite elegir entre tema claro y oscuro. Las pantallas y conversaciones mostradas son ejemplos; la gestión de la finca se realiza desde la aplicación.

La web se publica como sitio estático en Render. El acceso usa las cuentas de Firebase y el login Node de MilpaGrow; el servicio separado en `server/` envía el código de registro, guarda usuarios e historial en Firestore y entrega la APK después de comprobar la verificación. Cada permiso de descarga dura dos minutos y sólo puede usarse una vez.

La APK debe alojarse fuera del sitio estático: `WEBSITE_APK_PATH` apunta a un archivo privado del servidor, o `WEBSITE_APK_URL` a un origen HTTPS privado con `WEBSITE_APK_AUTH_TOKEN` si necesita autorización. Para actualizarla, sustituye el archivo o la URL en el servicio y configura `WEBSITE_APK_VERSION`. Si falta el instalador, la descarga se rechaza. El navegador recibe el archivo, sin conocer la URL privada ni su credencial.

**Activación pendiente:** configurar ese origen privado y desplegar el servidor y la web. Las APK que sigan disponibles en releases públicas de GitHub permiten descargar sin registro por fuera de la página; hay que retirar esa distribución pública al migrar, después de comprobar la nueva. Un instalador ya descargado también puede compartirse. Este cambio controla la entrega desde la web; el uso posterior se controla con el login de la app.

## Segundo sprint

- Solicitud de demostración sin cuenta, con validación, confirmación después de guardar y reintentos sin duplicados.
- Panel en `admin.html`: cuenta de MilpaGrow, código de correo y permiso administrativo comprobado por la API.
- Gestión de solicitudes, filtros, detalles, estados y notas persistentes en Firestore.
- Carga de APK con progreso, publicación, selección de versión e historial. Los tokens de GitHub permanecen en el servidor.
- Usuarios y descargas en el panel: correo, verificación pendiente o confirmada, fecha de registro y descargas iniciadas y entregadas. Sólo administradores con verificación pueden consultarlos.
- Diseño original, menú móvil, interacciones, temas claro/oscuro y movimiento reducido conservados.

Para construir y abrir una vista previa de la página, ejecuta:

```bash
python3 scripts/preparar_render.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory build
```

La configuración pública se centraliza en `config.js`, generado durante el build: exporta las cuatro variables de `.env.example` al entorno o configúralas en Render. Para cargar un `.env` local en Bash, usa `set -a`, `source .env` y `set +a` antes de construir. Abrir la landing no consulta la API; iniciar sesión, registrar cuentas, enviar demostraciones y administrar sí requieren sus servicios. El acceso requiere JavaScript.

Consulta [cuentas compartidas, desarrollo local y despliegue del registro](docs/ACCESO_DESCARGA.md). El repositorio de la app permanece sin cambios. La implementación se verifica localmente; su activación en Render requiere configurar el origen privado y desplegar primero el servicio de registro.

Consulta [contratos, configuración, primer administrador y despliegue](docs/INTEGRACION_MILPAGROW.md), [entrega al agente del backend](docs/ENTREGA_AGENTE_MILPAGROW.md) y [verificaciones](docs/VERIFICACIONES_SPRINT2.md).

## Pruebas

```bash
npm ci
npm ci --prefix server
npx playwright install chromium
npm test
```

Las pruebas del navegador usan servicios simulados. La compatibilidad de las cuentas se prueba con Firebase emulado y el backend original de MilpaGrow, sin editarlo; los comandos y límites están en [ACCESO_DESCARGA.md](docs/ACCESO_DESCARGA.md). Las verificaciones previas del panel y del APK se documentan en los archivos de Sprint 2.
