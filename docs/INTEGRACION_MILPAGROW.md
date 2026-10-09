# Integración MilpaWeb ↔ MilpaGrow · Sprint 2

> El recorrido de descarga y la configuración de acceso se actualizaron después
> de este sprint: ahora se exige una cuenta y un código de correo para recibir
> el APK desde un servicio protegido, con usuarios e historial en Firestore.
> Consulta [ACCESO_DESCARGA.md](ACCESO_DESCARGA.md).
> Los contratos de demostraciones y administración de este documento se conservan.

MilpaWeb conserva la landing estática y añade una demo pública y un panel en
`/admin.html`. MilpaGrow mantiene Express, Firebase Authentication, Firestore y
el contrato `{ success, data }` / `{ success: false, error: { code, message } }`.
No se guardan solicitudes, versiones, contraseñas ni tokens en localStorage.
Sólo se guarda `milpagrow-theme`; la sesión administrativa vive en memoria.

## Estado y alcance

- Implementado en MilpaWeb: CTA de demo, formulario validado, reintentos con
  idempotencia, descarga directa, panel con código de correo, solicitudes,
  filtros, detalles, notas, carga con progreso, publicación e historial.
- Implementado en la rama del backend preparada junto a esta entrega:
  `server/modules/website/*`, montaje en `server/index.js`, script de permisos,
  dependencia `yauzl`, índices y TTL de Firestore y pruebas de integración.
- **Pendiente en el backend desplegado:** integrar esa rama/patch, instalar las
  dependencias, desplegar índices/reglas y configurar secretos y GitHub.
- Pendiente en producción: habilitar al primer administrador, desplegar ambos
  repositorios y ejecutar el recorrido de aceptación descrito abajo.
- Las pruebas usan Firebase emulado, un APK real local y respuestas simuladas
  de GitHub. La prueba real de publicación requiere el token del servidor.
  No se han enviado datos personales ni publicado releases en producción.

## Configuración centralizada

`scripts/preparar_render.py` genera `build/config.js` a partir de una lista
cerrada de variables públicas. Todos los módulos usan `website-api.js` para
resolver la misma URL base. La URL debe incluir `/api`; las rutas de las tablas
son relativas a ella. HTTPS es obligatorio salvo localhost/127.0.0.1.
La configuración de API y Firebase es opcional para la página estática; sólo
se necesita para demostraciones y administración. Cambiar la URL o proyecto de
Firebase requiere regenerar config.js. El desafío del formulario se consulta
al enfocarlo, no al abrir la landing.

La descarga es un enlace HTML permanente a
`https://github.com/WaltzP/MilpaWeb/releases/latest/download/MilpaGrow.apk`.
Funciona sin JavaScript y no consulta `/website/release`. Para actualizarla,
adjunta un archivo con el nombre exacto `MilpaGrow.apk` a una release pública,
marca **Set as latest release** y publica. No requiere reconstruir MilpaWeb.
Los metadatos de versión, fecha y tamaño no se muestran en la landing porque
el archivo puede cambiar sin desplegarla. La administración puede publicar en
GitHub mediante la API; como ese flujo no cambia la etiqueta Latest, hay que
marcarla manualmente en GitHub para ofrecer esa versión en la descarga directa.

| Variable pública (MilpaWeb) | Uso |
| --- | --- |
| `MILPAGROW_API_URL` | Ej.: `http://localhost:3000/api` o `https://api.example.com/api` |
| `MILPAGROW_FIREBASE_API_KEY` | Clave Web pública del mismo proyecto Firebase que la API |
| `MILPAGROW_FIREBASE_PROJECT_ID` | Identificador público de ese proyecto |

| Variable privada/configuración del servidor (MilpaGrow) | Uso |
| --- | --- |
| `WEBSITE_SPAM_SECRET` | Secreto aleatorio de al menos 32 caracteres: desafíos y hashes antispam |
| `GITHUB_RELEASE_TOKEN` | Token con Contents: read/write limitado al repositorio de instaladores |
| `GITHUB_RELEASE_OWNER` | `WaltzP` por defecto |
| `GITHUB_RELEASE_REPO` | `MilpaWeb` por defecto: conserva el repositorio de distribución actual |
| `TRUST_PROXY_HOPS` | 0 local/directo; 1 en Render si sólo se accede mediante su proxy |
| Credenciales Firebase Admin | `FIREBASE_SERVICE_ACCOUNT_BASE64` o JSON o ADC ya soportados por la API |
| `AUTH_TOKEN_SECRET` | Secreto existente para el código de acceso de MilpaGrow |
| `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` | Envío del código mediante el servicio existente |
| `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `PUBLIC_API_URL` | Configuración ya usada por el backend |

Nunca introducir secretos Admin, GitHub, Brevo o antispam en el build, las
variables públicas, HTML ni JavaScript. El script sólo exporta las tres claves
públicas indicadas. `.env.example` contiene exclusivamente valores de ejemplo.

### Desarrollo

1. En MilpaGrow, configurar el `.env` existente y las nuevas variables privadas.
2. Ejecutar `npm ci --prefix server` y `npm start --prefix server` (Node 22+).
3. En MilpaWeb, copiar `.env.example` a `.env` y configurar el mismo Firebase:

```bash
set -a
source .env
set +a
python3 scripts/preparar_render.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory build
```

Abrir `http://127.0.0.1:4173` y `/admin.html`. Usar una instancia de desarrollo
del proyecto para la prueba manual. Las pruebas automáticas tienen su propia
configuración ficticia y no necesitan credenciales reales.

### Producción en Render

1. Integrar y desplegar primero los cambios de MilpaGrow. Configurar los secretos
   del servidor y una cuenta de servicio del mismo proyecto que Flutter.
2. Ejecutar desde MilpaGrow `firebase deploy --only firestore:rules,firestore:indexes
   --project TU_PROYECTO`. Esperar que el índice de solicitudes esté listo.
   `websiteDemoDedup` y `websiteDemoLimits` usan TTL en `expiresAt`; los límites
   funcionan aunque la eliminación por TTL sea diferida.
3. Repositorio GitHub de instaladores público y token de permisos mínimos.
   Configurar el repositorio que ya contiene la APK; el navegador nunca lo recibe.
4. Configurar las tres variables públicas en el servicio estático MilpaWeb.
   `render.yaml` usa `python3 scripts/preparar_render.py` y publica `build/`.
5. Configurar/probar CORS para el dominio de MilpaWeb. La API existente permite
   CORS; los nuevos requests usan `Authorization`, `Idempotency-Key` y `PUT`.
   Si se restringe CORS, conservar los orígenes de Flutter y de la landing.
6. Verificar límites y tiempos del proxy: APK hasta 250 MiB; timeout de carga
   al servidor de 10 minutos, GitHub de 10 minutos y navegador de 15 minutos.
   La API escribe un temporal con permisos 0600 y lo elimina al terminar.
7. Habilitar el primer administrador y publicar un instalador desde el panel.
   Antes de esa publicación, `/website/release` devuelve `null`. La descarga
   directa sigue ofreciendo la release pública marcada Latest en GitHub.

El HTML del panel se sirve públicamente para mostrar el inicio de sesión; los
datos y cada operación están protegidos en el backend. Recargar o cerrar la
página borra la sesión en memoria y requiere iniciar sesión otra vez.

## Autenticación existente, reutilizada

El panel usa estos contratos de `server/modules/auth/auth.routes.js` y
`emailLogin.service.js`, también utilizados por Flutter:

| Método y ruta | Campos | Respuesta `data` | Errores principales |
| --- | --- | --- | --- |
| POST `/auth/login` | `{ email, password }` | `{ challenge, email, expiresInSeconds: 600, resendAfterSeconds: 60 }` | 401 `INVALID_CREDENTIALS`; 429 `LOGIN_LIMIT`; 500 `AUTH_CONFIG`; 502 `AUTH_NETWORK` |
| POST `/auth/login-code/resend` | `{ challenge }` | Igual que login | 400 `INVALID_LOGIN_CODE`; 429 `LOGIN_LIMIT` |
| POST `/auth/login-code/confirm` | `{ challenge, code }`, código de seis dígitos | `{ customToken }` | 400 `INVALID_LOGIN_CODE`; 429 `LOGIN_LIMIT` |

El custom token se canjea mediante Firebase Authentication REST
`accounts:signInWithCustomToken` con la clave Web pública. El panel mantiene el
ID token y el refresh token en memoria y renueva el ID token con Secure Token
API cuando hace falta. El backend verifica firma, revocación y proyecto mediante
`verifyFirebaseToken`, exige `email_verified`, `email_login_verified` y que
`email_login_address` coincida con el correo. No se cambia ni omite ese flujo.

Después se lee el usuario de Firebase Admin y se exige
`customClaims.milpagrowAdmin === true` **en cada operación administrativa**.
La retirada del permiso bloquea también tokens emitidos previamente.
Ningún campo de un request, perfil editable ni localStorage concede permisos.

## Endpoints nuevos

### Públicos, sin cuenta ni Authorization

| Método y ruta | Campos / headers | Respuesta `data` | Errores |
| --- | --- | --- | --- |
| GET `/website/release` | Ninguno | Manifest público o `null` | 503 `WEBSITE_CONFIG`; 500 `UNEXPECTED_ERROR` |
| GET `/website/demo-challenge` | Ninguno | `{ challenge, minWaitMs: 2000 }` | 503 `WEBSITE_CONFIG` |
| POST `/website/demo-requests` | JSON abajo; header `Idempotency-Key` UUID | HTTP 202 `{ accepted: true }` después de confirmar la transacción | 400 `VALIDATION_ERROR`, `SPAM_REJECTED`, `CHALLENGE_EXPIRED`; 409 `IDEMPOTENCY_CONFLICT`; 429 `DEMO_RATE_LIMIT`, `AUTH_RATE_LIMIT`; 413 `PAYLOAD_TOO_LARGE` |

```json
{
  "name": "Ana Productora",
  "email": "ana@example.com",
  "phone": "+505 8888 8888",
  "activity": "mixta",
  "message": "Me gustaría conocer cómo organizar los registros de mi finca.",
  "website": "",
  "challenge": "DESAFIO_RECIBIDO_DEL_SERVIDOR"
}
```

Validación compartida con la interfaz: nombre 2–100 caracteres; correo válido
hasta 254; teléfono opcional hasta 30 y formado por dígitos, espacios, `+` inicial,
paréntesis, puntos y guiones; actividad `agricola|porcina|mixta|otra`; mensaje
10–2000. Se recortan espacios y el servidor normaliza el correo a minúsculas.
Rechaza tipos incorrectos, controles y campos inesperados. JSON máximo 16 KiB.

El campo trampa `website` debe estar vacío. El desafío firmado dura una hora y
requiere al menos dos segundos. Firestore limita a 10 solicitudes/IP y 3/correo
por ventana de 15 minutos; los identificadores se protegen con HMAC.
`TRUST_PROXY_HOPS` debe reflejar el proxy real para separar correctamente IPs.
Un request idéntico se deduplica durante 24 horas. El mismo UUID también evita
duplicados de reintentos concurrentes o respuestas perdidas. La interfaz conserva
el UUID en memoria mientras los campos no cambien y sólo borra los campos al
recibir confirmación. No devuelve información de solicitudes previas al público.
Es protección básica; no incluye CAPTCHA ni un servicio de detección de bots.

Respuesta de demo (transacción ya confirmada):

```json
{ "success": true, "data": { "accepted": true } }
```

Manifest público:

```json
{
  "success": true,
  "data": {
    "id": "android-12",
    "version": "1.2.0",
    "versionCode": 12,
    "notes": "Mejoras de registro y seguimiento.",
    "minAndroid": "7.0",
    "sizeBytes": 128974848,
    "sha256": "HASH_SHA256_DEL_APK",
    "downloadUrl": "https://github.com/WaltzP/MilpaWeb/releases/download/milpagrow-android-12/MilpaGrow.apk",
    "publishedAt": "2026-10-08T12:00:00Z"
  }
}
```

### Privados: ID token Firebase + verificación existente + permiso administrativo

Todos requieren `Authorization: Bearer ID_TOKEN` y devuelven `Cache-Control:
no-store`. No se aceptan custom tokens directamente como autorización.

| Método y ruta | Campos / query | Respuesta `data` |
| --- | --- | --- |
| GET `/website/admin/session` | Ninguno | `{ uid, email }` |
| GET `/website/admin/demo-requests` | `status` opcional y `cursor` de página | `{ items: [solicitud], nextCursor }`, páginas de 25 |
| GET `/website/admin/demo-requests/:id` | ID válido | Una solicitud |
| PATCH `/website/admin/demo-requests/:id` | `{ status, notes, revision }` | Solicitud actualizada |
| GET `/website/admin/releases` | `cursor` opcional | `{ items: [version], nextCursor, currentReleaseId, maxBytes: 262144000 }` |
| POST `/website/admin/releases` | `{ version, versionCode, notes, minAndroid }` | HTTP 201 versión en `draft` |
| PUT `/website/admin/releases/:id/apk` | Binario real; Content-Type `application/vnd.android.package-archive` o `application/octet-stream` | Versión en `uploaded` tras verificar GitHub |
| POST `/website/admin/releases/:id/publish` | Sin body | Manifest público; también permite seleccionar una versión ya publicada |

Estados de demo: `pendiente`, `contactada`, `agendada`, `realizada`, `cerrada`.
Notas hasta 5000 caracteres. `revision` comienza en 0 y aumenta al guardar.
Un conflicto devuelve 409 `DEMO_CHANGED`; no sobrescribe notas de otro admin.
Paginación ordena por `createdAt` y documento, ambos descendentes.

```json
{
  "success": true,
  "data": {
    "id": "ID_DE_SOLICITUD",
    "name": "Ana Productora",
    "email": "ana@example.com",
    "phone": "",
    "activity": "mixta",
    "message": "Quiero conocer MilpaGrow para organizar mi finca.",
    "status": "pendiente",
    "notes": "",
    "revision": 0,
    "createdAt": 1791460800000,
    "updatedAt": 1791460800000
  }
}
```

Ejemplo de actualización:

```json
{ "status": "agendada", "notes": "Demo acordada para el viernes.", "revision": 0 }
```

Ejemplo de registro de instalador:

```json
{ "version": "1.2.0", "versionCode": 12, "notes": "Mejoras de seguimiento y registro.", "minAndroid": "7.0" }
```

El código debe ser entero entre 1 y 2100000000 y único; la versión debe seguir
un formato como `1.2.0`. Novedades 10–5000 caracteres. Android mínimo numérico.
El operador debe usar los valores reales del build de Flutter (`version` de
pubspec y Android mínimo). La validación del APK comprueba su estructura ZIP,
manifiesto Android binario y DEX; no certifica su firma ni extrae esos metadatos.

La carga se transmite a disco, calcula SHA-256, valida el archivo y crea un
release borrador con tag `milpagrow-android-CODIGO`. Guarda IDs de release y
asset. Verifica que GitHub confirma estado `uploaded`, tamaño y digest si está
presente. La landing sigue ofreciendo su versión anterior durante esta fase.

Al publicar, la API comprueba que el repositorio es público, que el asset sigue
completo y pertenece al release, publica el borrador y **sólo entonces**, mediante
una transacción de Firestore, actualiza la versión y el manifest público. Conserva
el historial; seleccionar una versión anterior no vuelve a subir el archivo.
Si GitHub falla no cambia el manifest. Una respuesta perdida tras publicar se
puede reintentar; el release ya publicado se reutiliza. Operaciones concurrentes
en una misma versión tienen una reserva de 20 minutos; una operación interrumpida
se puede reintentar cuando vence esa reserva desde el historial.

Estados internos: `draft`, `uploading`, `uploaded`, `publishing`, `published`,
`failed`. Cada registro incluye metadatos, `id`, `tag`, `createdAt`, `updatedAt`,
`createdBy`; tras cargar incluye `sizeBytes`, `sha256`, `githubReleaseId`,
`githubAssetId`, `downloadUrl`, `uploadedBy`; tras publicar incluye `publishedAt`
y `publishedBy`. Reservas usan `leaseUntil`, `previousStatus`; `error` contiene un
mensaje sanitizado. El manifest público excluye los usuarios y datos internos.

Errores comunes privados: 401 `AUTH_REQUIRED`/`INVALID_TOKEN`; 403
`EMAIL_NOT_VERIFIED`/`MFA_REQUIRED`/`ADMIN_REQUIRED`; 400 `VALIDATION_ERROR`;
404 `DEMO_NOT_FOUND`/`RELEASE_NOT_FOUND`; 409 `DEMO_CHANGED`/`VERSION_EXISTS`/
`RELEASE_BUSY`/`RELEASE_STATE`/`RELEASE_TAG_EXISTS`/`RELEASE_PUBLISHED`/
`PRIVATE_RELEASE_REPO`/`ASSET_INCOMPLETE`/`ASSET_MISMATCH`; 400 `INVALID_APK`/
`APK_INCOMPLETE`; 413 `APK_TOO_LARGE`; 415 `APK_CONTENT_TYPE`; 503 `GITHUB_CONFIG`;
502 `GITHUB_NETWORK`/`GITHUB_ERROR`/`GITHUB_ASSET`/`GITHUB_PUBLISH`;
500 `UNEXPECTED_ERROR`. JSON mal formado: 400 `INVALID_JSON`.

```json
{ "success": false, "error": { "code": "ADMIN_REQUIRED", "message": "Acceso denegado. Esta cuenta no tiene permiso administrativo." } }
```

## Primer administrador

1. Crear la cuenta mediante la app existente y verificar su correo. No hay
   registro público de administradores en la landing.
2. Con credenciales **Firebase Admin** del proyecto configuradas en el entorno
   del servidor, ejecutar desde MilpaGrow:

```bash
node server/scripts/setWebsiteAdmin.js admin@example.com grant
```

El script verifica correo y cuenta habilitada, mantiene otros custom claims y
asigna únicamente `milpagrowAdmin`. No concede la verificación de código.
3. Abrir `/admin.html`, iniciar sesión y confirmar el código recibido por correo.
4. Para retirar permiso:

```bash
node server/scripts/setWebsiteAdmin.js admin@example.com revoke
```

El script requiere variables de credenciales en su entorno. Si están en `.env`,
exportarlas con `set -a; source .env; set +a` en una terminal del servidor antes
de ejecutarlo. No crear un endpoint público que asigne este permiso.

## Comprobación después de desplegar

1. Abrir landing en celular/escritorio, temas claro/oscuro; probar menú, pestañas,
   ejemplos de Milpi, teclado y movimiento reducido. Descargar también con
   JavaScript desactivado y la API caída; abrir la página no debe consultar la API.
2. Sin cuenta, enviar una demo válida. Confirmar que aparece en Firestore y luego
   se muestra la confirmación. Simular desconexión: campos intactos, botón activo
   para reintentar y una sola solicitud en el servidor.
3. Iniciar sesión con una cuenta verificada **sin** permiso admin y confirmar
   acceso denegado. Repetir un request privado con ese ID token: HTTP 403.
   Un token de contraseña sin código de correo debe recibir `MFA_REQUIRED`.
4. Como administrador, abrir la solicitud, filtrar por estado, recorrer los cinco
   estados y guardar notas. Recargar, volver a iniciar sesión y verificar que
   persisten. Probar una lista vacía y una API temporalmente no disponible.
5. Subir un APK real con sus metadatos. Observar progreso y resultado. Comprobar
   que aparece como listo para publicar y aún no modifica la descarga pública.
6. Publicar desde el historial. Abrir GET `/api/website/release` sin token y
   comprobar versión, fecha, bytes, requisito y enlace. Marcar esa release como
   Latest en GitHub; abrir la landing y descargar el APK sin iniciar sesión.
7. Subir un archivo inválido o provocar error de GitHub: la versión anterior
   permanece. Publicar una segunda versión y seleccionar la anterior; ambas
   siguen en el historial.
8. Revocar permiso al admin y comprobar HTTP 403 con su sesión anterior.
9. Verificar DevTools: ningún token GitHub, secreto Admin ni dato de demo en
   almacenamiento local/config.js; Firestore directo niega nuevas colecciones.

## Fuentes de los servicios

Los contratos de acceso proceden del código existente de MilpaGrow. El canje
se ajusta a [Firebase Authentication REST](https://firebase.google.com/docs/reference/rest/auth#section-verify-custom-token),
el permiso a [Firebase Admin custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
y la distribución a [GitHub Releases y assets](https://docs.github.com/en/rest/releases/assets).
