# Cuentas compartidas antes de descargar MilpaGrow

El botón de descarga de la landing abre `acceso.html`. El usuario elige
**Iniciar sesión** o **Crear cuenta**, confirma el código enviado a su correo
y obtiene el enlace al mismo APK de GitHub Releases. La landing, la demo, el
panel administrativo y la publicación del instalador conservan sus servicios.

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
| `FIREBASE_PROJECT_ID`, `MILPAGROW_FIREBASE_PROJECT_ID` | Ambos deben ser el proyecto de la app |
| `FIREBASE_SERVICE_ACCOUNT_JSON` o `FIREBASE_SERVICE_ACCOUNT_BASE64` | Credencial Admin del mismo proyecto, sólo en Node |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternativa local: ruta privada a la credencial existente |
| `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` | Servicio y remitente ya usados por MilpaGrow |
| `WEBSITE_REGISTRATION_SECRET` | Secreto aleatorio de al menos 32 caracteres; Render lo genera |
| `WEBSITE_ALLOWED_ORIGINS` | Origen exacto del sitio, por ejemplo `https://milpagrow-web.onrender.com`; varios separados por comas |
| `TRUST_PROXY_HOPS` | `1` en Render; `0` en local |

Las credenciales y los correos no se publican en el build. La sesión queda en
memoria; localStorage conserva únicamente la preferencia de tema. No se guardan
contraseñas, códigos ni tokens en localStorage o sessionStorage.

El servicio usa las nuevas colecciones privadas `websiteRegistrationChallenges`
y `websiteRegistrationRateLimits` del mismo Firestore. Las reglas actuales de
MilpaGrow niegan por defecto el acceso del cliente a estas colecciones; Admin
escribe sin cambiar las reglas de la app. Opcionalmente se puede habilitar TTL
en `deleteAfter` de ambas colecciones para limpiar registros de límites vencidos.

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
   desplegar; sólo corresponde al servicio Node de registro.
3. Si Brevo restringe IPs, permitir la salida del nuevo servicio Node según la
   configuración del proveedor. Comprobar el remitente existente.
4. En el sitio estático **milpagrow-web**, configurar las cuatro variables
   públicas. La nueva URL será, normalmente,
   `https://milpagrow-web-registration.onrender.com/api/registration`.
5. Publicar el sitio estático después de que el servicio esté listo. El build
   en Render **falla si falta cualquiera de las cuatro variables**, para evitar
   reemplazar la descarga pública existente con un acceso sin configurar.
6. Comprobar registro, recepción real del correo, login web de una cuenta de la
   app, descarga del APK y login en la app de la cuenta creada en la web.

Estado de esta entrega: implementación y pruebas locales completas. No se ha
creado el servicio ni publicado esta versión en Render desde esta sesión; falta
acceso al panel de despliegue. La versión pública permanece intacta. La recepción
real de correos de registro desde el nuevo servicio debe comprobarse al activarlo.

El APK mantiene su enlace público de GitHub: este cambio exige la cuenta en el
recorrido del botón de la web, no convierte GitHub Releases en almacenamiento
privado. No se cambia el archivo, su release ni su nombre.

## Verificación

```bash
npm test
```

Pasan 4 pruebas del build, 18 del servicio Node y 44 del navegador
(móvil y escritorio). Se prueban registro, cuenta existente, código erróneo,
reenvío, recuperación, cancelaciones, errores de red, descarga, almacenamiento,
temas y las funciones anteriores de demo y administración.

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
