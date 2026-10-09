# Activar la descarga protegida en Render

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

1. Abre https://github.com/settings/personal-access-tokens/new.
2. Nombre: `Render MilpaGrow APK`. Elige una caducidad y recuerda renovarlo
   antes de que venza.
3. Resource owner: **WaltzP**.
4. Repository access: **Only select repositories**, sólo **MilpaGrow-APK**.
5. Repository permissions: **Contents → Read-only**. Metadata tiene lectura
   automáticamente.
6. Genera el token y pégalo directamente en `WEBSITE_APK_AUTH_TOKEN` dentro de
   Render. No se usa la credencial general del CLI de GitHub.

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

La rama preparada para este despliegue es `feat/descarga-apk-verificada`.
Después de guardar las variables, selecciona esa rama en **Settings → Build &
Deploy → Branch** del servicio de registro. Si el cambio de rama dispara un
despliegue, espera su resultado antes de iniciar otro manualmente.

En esta revisión `/health` responde `200`, pero `/api/registration/users` devuelve
`404`: todavía hay que desplegar los cambios nuevos del servidor. Una vez
publicados en la rama que Render despliega, usa **Manual Deploy → Deploy latest
commit** y espera el estado **Live**.

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
La nueva variable que falta en el `config.js` publicado es
`MILPAGROW_REGISTRATION_API_URL`.

Después de tener el servidor preparado, selecciona **Save, rebuild, and deploy**
con el código nuevo de la web: selecciona también
`feat/descarga-apk-verificada` como rama de **milpagrow-web**. Comprueba que el build
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
