# Entrega para el agente de WaltzP/MilpaGrow

## Objetivo

Integrar y desplegar el backend del segundo sprint de la landing de MilpaGrow,
manteniendo los contratos que ya consume MilpaWeb. La implementación está
terminada en una rama local de MilpaGrow; no está desplegada ni subida al remoto.

- Rama del backend: `feat/landing-sprint2`.
- Commit: `d5edff61ee8960bd6a07fec9d0748a3153363e6b`.
- Base revisada: `21463a9` del repositorio MilpaGrow.
- La rama se encuentra en `/home/waltz/StudioProjects/MilpaGrow`; su rama de
  trabajo `develop` se conserva. También hay una copia preparada en
  `/tmp/milpagrow-sprint2-backend`.
- Alternativa transportable: [integration/milpagrow-sprint2.patch](../integration/milpagrow-sprint2.patch).
- Rama de la landing: `feat/sprint2-demo-admin`, en MilpaWeb. Obtener su commit
  final con `git log -1 --oneline` en ese repositorio.

## Ya implementado

| Archivo / área | Cambio |
| --- | --- |
| `server/modules/website/website.routes.js` | Endpoints públicos y privados, parsers limitados y stream de APK |
| `admin.js` | Middleware existente de sesión verificada + lectura de permiso Firebase Admin en cada operación |
| `demos.js`, `validation.js` | Persistencia transaccional, idempotencia, deduplicación, validación, desafío firmado y límites persistentes |
| `releases.js`, `apk.js`, `github.js` | Stream a temporal, validación APK, SHA-256, GitHub Releases, historial y publicación atómica del manifest |
| `server/index.js` | Montaje `/api/website` antes del parser JSON general y configuración explícita del proxy |
| `server/scripts/setWebsiteAdmin.js` | Asigna/retira `milpagrowAdmin` a una cuenta verificada, conservando otros claims |
| `server/package.json` y lockfile | Añade `yauzl` para validar APK sin extraerlo |
| `firestore.indexes.json` | Índice de estado/fecha/documento y TTL para deduplicación y límites |
| `.env.example` | Variables privadas de distribución y antispam sin credenciales |
| `server/test/website*.test.js` | Pruebas de seguridad, persistencia, carga y transportes GitHub |
| `docs/INTEGRACION_MILPAGROW.md` | Contratos exactos y configuración; copia incluida en el commit del backend |

Se reutilizan `/auth/login`, `/auth/login-code/resend`,
`/auth/login-code/confirm`, `verifyFirebaseToken`, `firebaseAdmin` y el envelope
HTTP existente. No se modifica el acceso de Flutter ni se concede la verificación
del código mediante custom claims permanentes.

El permiso se lee del registro Firebase Admin del usuario en cada operación:
`customClaims.milpagrowAdmin === true`. La revocación funciona inmediatamente con
tokens anteriores. Las reglas Firestore existentes deniegan acceso directo a
las nuevas colecciones; todas sus lecturas y escrituras pasan por la API.

## Ya probado

- Firebase Auth y Firestore emulados: 9 comprobaciones, sin omisiones, incluyendo
  guardar una demo sin cuenta, duplicados concurrentes, cinco estados, notas,
  conflictos de revisión y todas las operaciones denegadas a cuentas sin permiso.
- APK real existente del proyecto: transmisión, validación de estructura y hash,
  errores de carga/publicación, conservación del manifest anterior e historial.
- GitHub simulado: borrador, headers privados, transmisión efectiva de bytes,
  rechazo de assets incompletos, repositorio privado y confirmación de publicación.
- Suite del backend: 249 pruebas aprobadas; 3 integraciones existentes omitidas
  fuera del entorno de emuladores. La integración nueva se ejecutó aparte.
- MilpaWeb: recorridos en Chromium de escritorio/móvil, validaciones, reintentos,
  gestión, publicación, temas, teclado y tamaños de 320–1440 px.

El binario real usado corresponde a `com.example.milpa_grow`, versión `1.0.0`,
código `1`, Android mínimo SDK 24 (Android 7.0). GitHub y Brevo se simularon:
no se publicaron releases ni se enviaron correos reales durante las pruebas.

## Integración pendiente

1. Revisar el commit y aplicar mediante el flujo normal del repositorio. En la
   copia local, la rama ya está disponible; para una copia distinta, usar el patch:

```bash
git switch -c feat/landing-sprint2
git am /ruta/MilpaWeb/integration/milpagrow-sprint2.patch
npm ci --prefix server
```

2. Comprobar que `server/index.js` conserva el montaje antes de `express.json`
   general: una APK binaria no puede pasar por un parser JSON/multipart.
3. Ejecutar la suite y la integración con emuladores:

```bash
npm test --prefix server
MILPAGROW_TEST_APK=/ruta/al/MilpaGrow.apk firebase emulators:exec \
  --only auth,firestore --project demo-milpagrow \
  --config firebase.emulators.json \
  'node --test server/test/website.integration.test.js'
```

4. Desplegar índices y reglas Firestore del proyecto real; esperar que el índice
   `websiteDemoRequests` esté disponible. Mantener denegadas las nuevas colecciones
   para clientes Firebase directos.
5. Configurar `WEBSITE_SPAM_SECRET`, `GITHUB_RELEASE_TOKEN`, owner/repo y proxy.
   Reutilizar Firebase Admin, Brevo y `AUTH_TOKEN_SECRET` existentes. Ninguno debe
   exportarse a Flutter ni a MilpaWeb. El repositorio de instaladores es público.
6. Habilitar la cuenta inicial con `setWebsiteAdmin.js`; probar el código de correo
   real y una cuenta sin permiso administrativo.
7. Desplegar API y landing, subir/publicar un APK real desde el panel y verificar
   su enlace público sin sesión. La carga sola no debe cambiar el manifest.

No quedan endpoints por diseñar ni implementar en este paquete. Quedan su
integración en la rama de despliegue, configuración y aceptación en producción.
Si cambian campos/rutas, actualizar conjuntamente MilpaWeb y su documentación.

## Límites que deben conservarse visibles para el equipo

La defensa antispam es básica (trampa, desafío temporal, idempotencia y límites),
sin CAPTCHA. La validación del APK comprueba ZIP, manifiesto Android binario y
DEX, y verifica tamaño/hash en la transferencia; no certifica la firma ni extrae
versión/SDK. Los metadatos los registra el administrador y deben coincidir con
el build. Límite de archivo: 250 MiB. Los requisitos de proxy, timeout, archivos
temporales y recuperación de operaciones están en la documentación de integración.
