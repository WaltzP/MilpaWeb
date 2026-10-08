# Subir MilpaWeb a GitHub y Render

La carpeta preparada está en `/home/waltz/Documentos/MilpaWeb`. Contiene la web actualizada y un repositorio local en `main` con su primer commit. La APK está disponible en `dist/downloads/MilpaGrow.apk`, pero queda excluida del historial por `.gitignore`.

No hace falta crear otra copia de la web ni volver a ejecutar `git init`.

## 1. Crear el repositorio en GitHub

En [GitHub → New repository](https://github.com/new):

- Nombre: `MilpaWeb`.
- Visibilidad: `Public` para que la descarga de la Release sea accesible.
- Deja sin marcar las opciones para generar README, `.gitignore` y licencia: la carpeta local ya contiene los archivos.

Pulsa **Create repository**. [Documentación de GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository).

Desde una terminal, sustituye `TU_USUARIO` por tu usuario u organización:

```bash
cd /home/waltz/Documentos/MilpaWeb
git remote add origin https://github.com/TU_USUARIO/MilpaWeb.git
git push -u origin main
```

La APK se conserva en tu computadora. Los archivos del sitio y su configuración son los que se suben al repositorio.

## 2. Adjuntar la APK a una Release

En el repositorio de GitHub:

1. Abre **Releases → Draft a new release**.
2. Crea la etiqueta `android-inicial` apuntando a `main`.
3. Usa el título **MilpaGrow para Android**.
4. Adjunta `/home/waltz/Documentos/MilpaWeb/dist/downloads/MilpaGrow.apk`.
5. Espera a que termine la subida y pulsa **Publish release**.
6. Copia el enlace del archivo `MilpaGrow.apk` dentro de **Assets**.

El enlace tendrá esta forma; usa la dirección real de tu publicación:

```text
https://github.com/TU_USUARIO/MilpaWeb/releases/download/android-inicial/MilpaGrow.apk
```

Prueba que el enlace descarga el archivo desde una ventana privada, sin pedir inicio de sesión. [Guía de Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release).

El instalador pesa unos 123 MB. GitHub bloquea archivos mayores de 100 MiB en el historial Git y recomienda Releases para distribuir binarios. [Límites de GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

## 3. Publicar en Render

La opción más directa es **New → Blueprint**:

1. Conecta el repositorio `MilpaWeb` y selecciona `main`.
2. Usa el `render.yaml` de la raíz.
3. Cuando Render solicite `MILPAGROW_APK_URL`, pega el enlace HTTPS de la APK publicada.
4. Inicia el despliegue y espera a que termine correctamente.
5. Abre la URL del sitio que asigne Render y prueba el botón de descarga.

El Blueprint configura el sitio estático, el comando de preparación y las cabeceras. [Referencia de Render](https://render.com/docs/blueprint-spec).

También puedes usar **New → Static Site** y completar manualmente:

| Campo | Valor |
| --- | --- |
| Name | `milpagrow-web`, o un nombre disponible |
| Branch | `main` |
| Root Directory | Vacío |
| Build Command | `python3 scripts/preparar_render.py` |
| Publish Directory | `build` |
| Variable `MILPAGROW_APK_URL` | URL pública HTTPS de `MilpaGrow.apk` |
| Variable `SKIP_INSTALL_DEPS` | `true` |

En el formulario manual, añade las reglas de cabeceras de `render.yaml` desde **Headers**. Con Blueprint, se aplican desde el archivo. [Primer despliegue](https://render.com/docs/your-first-deploy), [cabeceras](https://render.com/docs/static-site-headers).

El comando usa únicamente Python para copiar los recursos a `build/` y configurar el enlace de descarga. El valor de `MILPAGROW_APK_URL` queda escrito en el HTML público; debe ser un enlace público de descarga.

## Revisar la página en local

Para ver la web y descargar la APK que se conserva en tu computadora:

```bash
cd /home/waltz/Documentos/MilpaWeb
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Abre `http://localhost:8765`. Detén el servidor con Ctrl+C.

Para revisar la salida que publicará Render, configura la URL real de tu Release:

```bash
cd /home/waltz/Documentos/MilpaWeb
export MILPAGROW_APK_URL='https://github.com/TU_USUARIO/MilpaWeb/releases/download/android-inicial/MilpaGrow.apk'
python3 scripts/preparar_render.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory build
```

`build/` se genera de nuevo en cada preparación y queda excluida de Git. El script comprueba el formato de la URL, pero no descarga ni valida el instalador remoto.

## Actualizaciones

Edita los archivos de esta carpeta y publica los cambios de código con:

```bash
cd /home/waltz/Documentos/MilpaWeb
git add .
git commit -m "Actualizar página de MilpaGrow"
git push origin main
```

Para cambiar la APK, adjunta la nueva versión a otra Release, actualiza `MILPAGROW_APK_URL` en Render y vuelve a desplegar. Actualiza también el tamaño visible en `dist/index.html` y reemplaza la copia local si quieres conservarla para las pruebas.
