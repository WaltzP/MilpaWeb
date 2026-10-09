# Cuentas compartidas antes de descargar MilpaGrow

Para activar la fuente privada ya preparada en GitHub y los servicios existentes,
consulta [la guía con las URLs y pasos de Render](ACTIVAR_RENDER.md).

El botón de descarga de la landing abre `acceso.html`. El usuario elige
**Iniciar sesión** o **Crear cuenta**, confirma el código enviado a su correo
y solicita un permiso temporal para recibir la APK desde el servicio Node.
La landing, la demo, el panel administrativo y la publicación del instalador
conservan sus servicios.

Todos los cambios están en MilpaWeb. El repositorio de MilpaGrow se usa como
referencia y durante las pruebas de compatibilidad; no se cambia ni despliega.

## Cómo se comparten las cuentas

- El registro Node crea la cuenta en **Firebase Authentication del mismo
  proyecto que la app**. No hay otra base de usuarios ni sincronización.
- Envía el código de seis dígitos mediante Brevo. Después de comprobarlo marca
  `emailVerified: true` y emite un token para esa sesión.
- El login llama los endpoints originales de MilpaGrow: `/api/auth/login`,
  `/api/auth/login-code/confirm` y `/api/auth/login-code/resend`. La web y la
  app comprueban la contraseña y el código con el mismo backend.
- Se canjea el custom token en Firebase y el nuevo servicio comprueba su firma,
  proyecto, revocación, dirección actual y claims `email_login_verified` y
  `email_login_address` antes de mostrar el botón final.
- Si un registro quedó pendiente, el login con contraseña y código de correo
  permite confirmar también esa dirección, sin crear una segunda cuenta.
- El registro web **no escribe `users`, fincas, roles ni datos de perfil**.
  El `FarmGate` de la app encontrará el perfil pendiente y mostrará su flujo
  habitual. Una cuenta existente conserva sus datos y permisos.
- La colección privada `websiteRegisteredUsers` registra cada cuenta por su
  UID de Firebase, correo, origen (`website` o `app`), estado pendiente o
  verificado, fechas y contadores de descargas. Se crea al registrar desde la
  web y se actualiza al confirmar el código. Una cuenta existente se incorpora
  después de verificar su sesión. No se duplica en Firebase Authentication.

## Descarga y control de usuarios

El botón final no contiene un enlace público al instalador. Envía
`POST /api/registration/download-grant` con el ID token de Firebase. El servidor
comprueba firma, revocación, cuenta y verificación del código, y crea un permiso
aleatorio de 256 bits que vence en 120 segundos. Guarda sólo su hash en
`websiteDownloadGrants`. No incluye correos ni tokens de Firebase en la URL.

El navegador solicita `GET /api/registration/download/:grant`. Se comprueba de
nuevo que la cuenta no esté desactivada y que su correo y revocación coincidan;
una transacción consume el permiso una sola vez y registra la descarga en
`websiteDownloads`. El servidor transmite `MilpaGrow.apk` como adjunto, sin
redireccionar al origen del archivo ni cargar toda la APK en memoria. Un permiso
vencido, inventado, utilizado, o una sesión sin código no entregan el archivo.
`HEAD` no consume el permiso. No se admiten reanudaciones con el mismo permiso;
el usuario puede solicitar otra descarga desde su sesión verificada.

El historial distingue `started`, `completed` y `failed`, y conserva UID, correo,
versión, tamaño y fechas. El contador de entregadas se incrementa cuando termina
la transferencia en el servidor; no confirma instalación ni uso. Si un proceso
se termina durante la transferencia, el evento puede permanecer en `started`.
Hay un máximo de 10 permisos por cuenta por hora, además del límite por IP.

En `admin.html`, **Usuarios y descargas** consulta
`GET /api/registration/users`, con páginas de 50 cuentas. Exige la sesión con
código y el permiso actual `milpagrowAdmin: true` en Firebase Admin. Revocar ese
permiso bloquea inmediatamente la consulta, aunque el token conserve claims
antiguos. La lista muestra correo, origen, verificación y contadores. El detalle
de cada transferencia permanece en Firestore; no se publica una API de usuarios
sin autorización.

## Origen privado de la APK

Configura **una** fuente en el servicio Node:

- `WEBSITE_APK_PATH`: ruta a `MilpaGrow.apk` fuera de `build/` y `dist/`.
- `WEBSITE_APK_URL`: URL HTTPS del archivo en un almacenamiento privado.
  Si exige un token Bearer, configúralo en `WEBSITE_APK_AUTH_TOKEN`.

Por ejemplo, en Render se puede usar el endpoint
`https://api.github.com/repos/OWNER/PRIVATE_REPO/releases/assets/ASSET_ID` de
un repositorio **privado**, y un token con permiso de lectura de Contents
limitado a ese repositorio. El servicio pide `application/octet-stream` y sigue
la redirección internamente; ninguna credencial se entrega al navegador.
[Contrato de descarga de assets de GitHub](https://docs.github.com/en/rest/releases/assets#get-a-release-asset).

`WEBSITE_APK_VERSION` identifica la versión en el historial. Al actualizar la
APK, cambia el archivo o la URL y esa versión. Sin fuente o ante un fallo del
origen se devuelve `503 APK_UNAVAILABLE`; no hay enlace público de reserva.
El panel anterior de instaladores continúa usando la API de publicación de la
app; publicar allí no actualiza automáticamente este origen privado.

Antes de exigir registro en todas las vías, migra también las releases públicas
que contienen APK. Mantener una APK pública en GitHub permite saltarse la web.
No se han eliminado releases ni cambiado la visibilidad de repositorios en
esta sesión. Los archivos ya descargados pueden compartirse.

El registro de la app sigue verificando con un **enlace**. El registro web
ofrece un **código**, como se pidió, sin alterar ese comportamiento de Flutter.
La app seguirá solicitando su código de seguridad al iniciar una nueva sesión.

## Configuración

La web continúa siendo estática. `server/` es un **servicio Node separado**,
dedicado al registro y comprobación de acceso. No reemplaza el backend de la app.

| Variables públicas del sitio estático | Valor |
| --- | --- |
| `MILPAGROW_API_URL` | `https://milpagrow.onrender.com/api`, o la API vigente de la app |
| `MILPAGROW_FIREBASE_API_KEY` | Clave pública de Authentication del mismo Firebase |
| `MILPAGROW_FIREBASE_PROJECT_ID` | Identificador del Firebase que usa la app |
| `MILPAGROW_REGISTRATION_API_URL` | URL del nuevo servicio terminada en `/api/registration` |

| Variables privadas del servicio Node | Valor |
| --- | --- |
| `FIREBASE_PROJECT_ID`, `MILPAGROW_FIREBASE_PROJECT_ID` | Ambas variables valen `nereon-milpagrow`, el proyecto de Firebase de la app |
| `FIREBASE_SERVICE_ACCOUNT_JSON` o `FIREBASE_SERVICE_ACCOUNT_BASE64` | Credencial Admin del mismo proyecto, sólo en Node |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternativa local: ruta privada a la credencial existente |
| `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` | Servicio y remitente ya usados por MilpaGrow |
| `WEBSITE_REGISTRATION_SECRET` | Secreto aleatorio de al menos 32 caracteres; Render lo genera |
| `WEBSITE_ALLOWED_ORIGINS` | Origen exacto del sitio, por ejemplo `https://milpagrow-web.onrender.com`; varios separados por comas |
| `TRUST_PROXY_HOPS` | `1` en Render; `0` en local |
| `WEBSITE_APK_PATH` o `WEBSITE_APK_URL` | Fuente privada de la APK; sólo una de las dos |
| `WEBSITE_APK_AUTH_TOKEN` | Token Bearer privado para el origen HTTPS, si lo exige |
| `WEBSITE_APK_VERSION` | Versión que se registra al entregar el archivo |

Las credenciales y los correos no se publican en el build. La sesión queda en
memoria; localStorage conserva únicamente la preferencia de tema. No se guardan
contraseñas, códigos ni tokens en localStorage o sessionStorage.

El servicio usa las colecciones privadas `websiteRegistrationChallenges`,
`websiteRegistrationRateLimits`, `websiteRegisteredUsers`, `websiteDownloadGrants`
y `websiteDownloads` del mismo Firestore. Las reglas actuales de
MilpaGrow niegan por defecto el acceso del cliente a estas colecciones; Admin
escribe sin cambiar las reglas de la app. Opcionalmente se puede habilitar TTL
en `deleteAfter` de desafíos, límites y permisos para limpiar registros vencidos.
No habilites TTL en usuarios o historial si deseas conservarlos.

## Desarrollo local

Instalar dependencias con `npm ci` y `npm ci --prefix server`. Si la app tiene
su configuración local y `server/serviceKey.json`, preparar los `.env` de la
web sin editar la app ni mostrar secretos:

```bash
node scripts/configurar_acceso_local.mjs /ruta/a/MilpaGrow
npm start --prefix server
```

El script no sobrescribe `.env` existentes. También se pueden completar los
dos `.env.example` manualmente.
Para probar la entrega del archivo en local, añade a `server/.env`
`WEBSITE_APK_PATH=/ruta/privada/MilpaGrow.apk` y `WEBSITE_APK_VERSION`.

El servidor carga `server/.env` por ruta absoluta: se puede ejecutar con
`npm start --prefix server`, con `node server/index.js` desde la raíz o con
`node index.js` desde `server/`. Las variables configuradas en Render tienen
prioridad sobre ese archivo. `WEBSITE_ALLOWED_ORIGINS` admite una barra final
y normaliza cada dirección al origen que envía el navegador.

En otra terminal construir la web:

```bash
set -a
source .env
set +a
python3 scripts/preparar_render.py
npm run preview
```

Abrir `http://127.0.0.1:4173/acceso.html`. Esa configuración local usa cuentas
reales si apunta al Firebase real; las pruebas automatizadas descritas abajo
usan respuestas simuladas o el proyecto `demo-milpagrow`.

## Despliegue sin interrumpir la página existente

1. Crear primero el servicio **milpagrow-web-registration** desde este
   repositorio. `render.yaml` incluye Node 22, raíz `server`, `npm ci
   --ignore-scripts`, `npm start`, `/health` y plan gratuito. También se puede
   crear manualmente desde Render con esos valores.
2. Copiar al nuevo servicio, dentro de Render, la configuración privada de
   Firebase y Brevo usada por la app. No es necesario editar ni reiniciar
   MilpaGrow. Configurar el origen exacto de la web y comprobar `/health`.
   `render.yaml` ya incluye
   `WEBSITE_ALLOWED_ORIGINS=https://milpagrow-web.onrender.com`. Si el servicio
   se creó manualmente, añadir esa variable en **Environment** y volver a
   desplegar; sólo corresponde al servicio Node de registro. Configura también
   `FIREBASE_PROJECT_ID` y `MILPAGROW_FIREBASE_PROJECT_ID` con el valor
   `nereon-milpagrow`. El Blueprint rellena ambos automáticamente. Añade
   también `BREVO_API_KEY` y `BREVO_FROM_EMAIL`, copiando sus valores privados
   del servicio Render que ejecuta la API actual de MilpaGrow. No los pongas
   en el repositorio, `render.yaml` ni en el chat. `BREVO_FROM_NAME` es opcional.
3. Si Brevo restringe IPs, permitir la salida del nuevo servicio Node según la
   configuración del proveedor. Comprobar el remitente existente. Configurar
   el origen privado de la APK descrito arriba y comprobar una descarga
   autenticada antes de publicar la web; `/health` sólo confirma que el servicio
   está iniciado, no que el instalador o el correo estén disponibles.
4. En el sitio estático **milpagrow-web**, configurar las cuatro variables
   públicas. La nueva URL será, normalmente,
   `https://milpagrow-web-registration.onrender.com/api/registration`.
5. Publicar el sitio estático después de que el servicio esté listo. El build
   en Render **falla si falta cualquiera de las cuatro variables**, para evitar
   reemplazar la descarga pública existente con un acceso sin configurar.
6. Comprobar registro, recepción real del correo, login web de una cuenta de la
   app, descarga del APK, historial de usuarios en administración y login en
   la app de la cuenta creada en la web. Después de comprobar la nueva entrega,
   retirar la distribución pública de APK para impedir la descarga externa.

Estado de esta entrega: implementación y pruebas locales completas. No se ha
creado el servicio ni publicado esta versión en Render desde esta sesión; falta
acceso al panel de despliegue. La versión pública permanece intacta. La recepción
real de correos de registro desde el nuevo servicio debe comprobarse al activarlo.

Este cambio reemplaza el enlace público de la página por la entrega protegida
del servicio Node. Su activación requiere configurar la fuente privada. No se
ha modificado ninguna release pública existente.

## Verificación

```bash
npm test
```

Pasan 4 pruebas del build, 26 del servicio Node y 52 del navegador
(móvil y escritorio). Se prueban registro, cuenta existente, código erróneo,
reenvío, recuperación, cancelaciones, errores de red, descarga, almacenamiento,
temas y las funciones anteriores de demo y administración. Incluyen permisos
de descarga de un solo uso, expiración, revocación de cuentas, concurrencia,
historial, bloqueo sin código y consultas exclusivas de administradores.

La comprobación de compatibilidad importa el backend **original** de la app
como lectura y usa Firebase Auth y Firestore emulados. El envío Brevo es
simulado; se prohíben conexiones de la prueba a los servicios de producción:

```bash
export MILPAGROW_REPOSITORY_PATH=/ruta/a/MilpaGrow
firebase emulators:exec --only auth,firestore --project demo-milpagrow \
  --config firebase.emulators.json 'npm run test:integration --prefix server'
```

Pasan los dos recorridos: web → app con perfil pendiente, y app → web
con perfil y permisos existentes conservados. Incluyen el login y middleware
reales de MilpaGrow y comprueban que una sesión sin código no tiene acceso.

Los códigos duran 10 minutos, tienen cinco intentos como máximo y espera de
60 segundos para reenviar; los hashes y límites se guardan en transacciones de
Firestore y sobreviven a reinicios. Los fallos de correo invalidan el código.
Un registro interrumpido se recupera con el login existente; no se borra la cuenta.

Referencias: [cuentas y verificación Firebase Admin](https://firebase.google.com/docs/auth/admin/manage-users),
[canje de custom tokens](https://firebase.google.com/docs/reference/rest/auth#section-verify-custom-token)
y [configuración de servicios Render](https://render.com/docs/blueprint-spec).
