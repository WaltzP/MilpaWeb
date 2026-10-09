# Activar la descarga protegida en Render

## Estado de la activación

El 9 de octubre de 2026 se conectó Render directamente con Codex mediante
OAuth y el usuario completó la autorización. Los servicios existentes están
en el espacio **Nereon**, `tea-dakc3fou01pc73ek212g`:

- Web: `srv-db451nbtqb8s73e3oq50`.
- Registro: `srv-db4asum0tbcc73dp2v4g`.

Los cambios se publicaron en **main**, commit
`3cbca6f6d98bada1c461c35bbd084171b0ccffc6`, y ambos servicios se desplegaron.
Se añadió la URL del registro al build de la web y se configuró en el servidor
la credencial privada del proyecto Firebase existente, que faltaba en Render.
El backend principal de la app conserva su configuración.

Comprobaciones de la página publicada:

- El botón de descarga lleva a `acceso.html`; el registro se muestra y la
  descarga permanece oculta antes de validar el acceso.
- `/api/registration/users` sin sesión devuelve `401`.
- Una sesión sin la verificación de correo no puede solicitar el permiso:
  devuelve `403`. Una sesión de prueba con verificación devuelve `200`.
- La cuenta temporal y sus registros se retiraron después de comprobarlo.
- Render entregó la APK privada completa: `123470635` bytes, versión
  `android-inicial`; la descarga quedó registrada como completada en Firestore.
- La release pública anterior de MilpaWeb quedó como borrador y su asset
  devuelve `404` sin autenticación.

La página y la descarga autenticada están activas. El código de verificación
por correo aún debe confirmarse con una cuenta real en el sitio: una consulta
local de Brevo fue rechazada porque la IP de este equipo no está autorizada.
Se conservaron las credenciales de correo existentes de Render.

El código pasó 82 pruebas de build, servidor y navegador, además de las pruebas
de integración con los emuladores de Firebase. La fuente privada también se
descargó completa y se verificó durante la preparación. La recepción real del
código por correo todavía necesita una comprobación del flujo publicado.
Una consulta de Brevo desde el equipo local fue rechazada por la lista de IPs
autorizadas; se conservaron las variables de correo existentes de Render.
El cambio local de `server/mail.js` pertenece al usuario y debe conservarse.

## Fuente privada preparada

Repositorio: https://github.com/WaltzP/MilpaGrow-APK (privado).

Release: https://github.com/WaltzP/MilpaGrow-APK/releases/tag/android-inicial.

La APK es una copia exacta de la release pública `android-inicial` de MilpaWeb:
123470635 bytes, SHA-256
`c674ff17f4f3d52dbbcf3c4312d2098446fcd5cf51a82906bb9462ede5f20f06`.

Variables nuevas del servicio **milpagrow-web-registration**:

```dotenv
WEBSITE_APK_URL=https://api.github.com/repos/WaltzP/MilpaGrow-APK/releases/assets/624663933
WEBSITE_APK_AUTH_TOKEN=TOKEN_DE_LECTURA_DEL_REPOSITORIO_PRIVADO
WEBSITE_APK_VERSION=android-inicial
```

No configures `WEBSITE_APK_PATH` a la vez que esa URL. El instalador se entrega
desde Node después de comprobar el registro y el código, sin enviar el token de
GitHub ni la URL del origen al navegador.

## Crear el token de lectura

1. Abre [Crear el token con lectura ya seleccionada](https://github.com/settings/personal-access-tokens/new?name=Render+MilpaGrow+APK&target_name=WaltzP&expires_in=365&contents=read).
2. Nombre: `Render MilpaGrow APK`. Elige una caducidad y recuerda renovarlo
   antes de que venza.
3. Resource owner: **WaltzP**.
4. Repository access: **Only select repositories**, sólo **MilpaGrow-APK**.
5. Repository permissions: **Contents → Read-only**. Metadata tiene lectura
   automáticamente.
6. Genera el token y pégalo directamente en `WEBSITE_APK_AUTH_TOKEN` dentro de
   Render. No se usa la credencial general del CLI de GitHub.

El valor debe ser el token **completo** que muestra GitHub después de pulsar
**Generate token**; los tokens de este tipo comienzan con `github_pat_`.
Una cadena aleatoria generada en Render no concede acceso al repositorio.
El nombre de la variable es exactamente `WEBSITE_APK_AUTH_TOKEN`, y Render
sólo almacena el token en su campo de valor.

Referencias: [tokens de GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
y [permisos para descargar assets](https://docs.github.com/en/rest/releases/assets#get-a-release-asset).

## Configurar el servicio de registro existente

En https://dashboard.render.com abre **milpagrow-web-registration → Environment**.
Añade las tres variables anteriores y elige **Save only** mientras se prepara
el despliegue del código. Las variables no se aplican hasta desplegar.

Conserva la configuración existente de Firebase, Brevo y el secreto de registro.
El servicio también requiere estos valores públicos:

```dotenv
FIREBASE_PROJECT_ID=nereon-milpagrow
MILPAGROW_FIREBASE_PROJECT_ID=nereon-milpagrow
WEBSITE_ALLOWED_ORIGINS=https://milpagrow-web.onrender.com
TRUST_PROXY_HOPS=1
NODE_VERSION=22
NODE_ENV=production
```

Si hay otros dominios de la web, inclúyelos en `WEBSITE_ALLOWED_ORIGINS`,
separados por comas. No incluyas rutas como `/acceso.html`.

Configuración del servicio:

| Campo | Valor |
| --- | --- |
| Repository | `WaltzP/MilpaWeb` |
| Runtime | Node |
| Root Directory | `server` |
| Build Command | `npm ci --ignore-scripts` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

Los cambios ya están en `main`, la rama que despliegan los dos servicios.

Al cambiar variables, comprueba si Render inició un despliegue automáticamente.
Si no lo inició, usa **Manual Deploy → Deploy latest commit** y espera el estado
**Live**; evita iniciar otro despliegue mientras ya haya uno en curso.

No publiques primero la web: comprueba antes que el servidor nuevo está
disponible. Un `401 AUTH_REQUIRED` al consultar `/api/registration/users` sin
sesión confirma que la ruta nueva está instalada y protegida; no sustituye la
prueba de descarga autenticada.

## Activar la web estática

En **milpagrow-web → Environment**, conserva la clave pública de Firebase y
configura:

```dotenv
MILPAGROW_API_URL=https://milpagrow.onrender.com/api
MILPAGROW_FIREBASE_PROJECT_ID=nereon-milpagrow
MILPAGROW_REGISTRATION_API_URL=https://milpagrow-web-registration.onrender.com/api/registration
```

`MILPAGROW_FIREBASE_API_KEY` debe conservar la clave pública del mismo proyecto.
`MILPAGROW_REGISTRATION_API_URL` ya está incluida en el `config.js` publicado.

Después de tener el servidor preparado, selecciona **Save, rebuild, and deploy**
con el código nuevo de la web: conserva
`main` como rama de **milpagrow-web**. Comprueba que el build
usa `python3 scripts/preparar_render.py` y publica `build/`.
Las variables del sitio estático se incorporan durante el build: sólo reiniciar
el servidor Node no cambia el `config.js` de la web.

[Variables y opciones de despliegue de Render](https://render.com/docs/configure-environment-variables).

## Comprobar y cerrar la migración

1. Abre https://milpagrow-web.onrender.com/acceso.html.
2. Registra una cuenta o inicia sesión con la cuenta de la app.
3. Recibe y confirma el código de seis dígitos.
4. Descarga `MilpaGrow.apk` y comprueba que se entrega completa.
5. En administración, revisa **Usuarios y descargas**. Tu cuenta administrativa
   debe tener `milpagrowAdmin: true`.
6. Comprueba que el enlace de origen privado no entrega la APK sin el token y
   que el permiso de descarga del servicio no funciona una segunda vez.
7. Después de validar el nuevo flujo, retira las APK de las releases públicas
   que permitan saltarse el registro. La copia pública original aún existe;
   no se eliminó durante la preparación de la fuente privada.

Los usuarios e historial se guardan en Firestore. No hace falta una base de
datos de Render para este cambio.

El servicio Free de Render puede tardar alrededor de un minuto en despertar y
tiene restricciones para tráfico saliente elevado; comprueba su capacidad antes
de usarlo para distribuir muchas APK de este tamaño.
[Límites del plan Free](https://render.com/docs/free).

## Actualizar la APK más adelante

Sube la nueva APK a una nueva release de **WaltzP/MilpaGrow-APK**. Obtén la URL
API del asset (no el enlace de la página de la release):

```bash
gh api repos/WaltzP/MilpaGrow-APK/releases/latest \
  --jq '.assets[] | select(.name == "MilpaGrow.apk") | .url'
```

Actualiza `WEBSITE_APK_URL` y `WEBSITE_APK_VERSION` sólo en el servicio Node,
y selecciona **Save and deploy**. No hace falta reconstruir la web si sus URLs
de servicios no cambian. El token sigue sirviendo mientras esté vigente y tenga
acceso al repositorio privado.
