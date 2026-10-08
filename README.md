# MilpaWeb

Página de presentación y descarga de MilpaGrow, desarrollada por NEREON para fincas agrícolas, porcinas y mixtas. Es una web estática en español: HTML, CSS y JavaScript, sin framework ni paquetes que instalar.

Su función es explicar la aplicación Android y ofrecer su instalador. Los registros, las gráficas y las conversaciones con Milpi que se muestran son ejemplos ilustrativos. La web no inicia sesión, no consulta Firebase ni llama al asistente de la aplicación.

## Qué muestra la página

| Parte | Para qué sirve |
| --- | --- |
| Cabecera | Logo, enlaces a las secciones, cambio de tema y menú móvil. |
| Presentación, `#inicio` | Explica el propósito de MilpaGrow y dirige a la descarga. El teléfono es una representación de la app. |
| Sobre MilpaGrow, `#conoce` | Describe a quién está dirigida la aplicación y quién la desarrolla. |
| Funciones, `#funciones` | Permite explorar cultivos, porcinos, diagnóstico por foto y gestión mediante pestañas. |
| Milpi, `#milpi` | Muestra tres conversaciones de ejemplo sobre cultivos, animales y administración de finca. |
| Primeros pasos, `#como-empezar` | Explica cómo crear una cuenta, registrar una finca y añadir registros en la app. |
| Preguntas frecuentes | Resuelve dudas sobre requisitos, instalación, diagnóstico y trabajo con otros miembros. |
| Descarga, `#descargar` | Enlaza al instalador Android e informa su tamaño y requisitos. |
| Pie de página | Identifica a NEREON y permite volver al inicio. |

Las pestañas explican funciones de la aplicación, no ejecutan esas operaciones desde el navegador:

- **Cultivos:** registro de variedades y superficie, monitoreos, observaciones y seguimiento.
- **Porcinos:** animales y lotes, historial de peso, consumo y planes de alimentación.
- **Diagnóstico:** análisis de fotografías de plantas desde sus monitoreos.
- **Gestión:** áreas productivas, ingresos, egresos, reportes, miembros y avisos.

## Archivos y carpetas

| Ruta | Uso |
| --- | --- |
| `dist/` | Archivos editables de la página. Aunque se llama `dist`, en este proyecto no se genera con un compilador. |
| `dist/index.html` | Estructura, textos, iconos SVG, navegación, preguntas frecuentes y enlace de descarga. |
| `dist/milpagrow.css` | Fuentes locales, colores, tarjetas, tamaños, diseño adaptable, tema oscuro y animaciones. Incluye reglas para reducir el movimiento. |
| `dist/milpagrow.js` | Cambia las pestañas y los ejemplos de Milpi, guarda el tema, controla el menú móvil, anima las secciones y muestra el mensaje de descarga. |
| `dist/assets/` | Imágenes de la marca y paisaje. |
| `dist/assets/fonts/` | Fuentes Sora y Space Grotesk, junto con sus licencias OFL, que deben conservarse al distribuirlas. |
| `dist/downloads/MilpaGrow.apk` | Instalador original para la descarga local. Se conserva en esta carpeta y queda excluido de Git. |
| `dist/_headers` | Cabeceras HTTP para proveedores que admiten ese formato; Render se configura mediante `render.yaml` o su panel. |
| `scripts/preparar_render.py` | Genera `build/`, sustituye la descarga local por una URL HTTPS y excluye la APK del contenido publicado. Usa únicamente la biblioteca estándar de Python. |
| `render.yaml` | Configuración de Render: sitio estático, preparación, carpeta publicada, variable de descarga y cabeceras. |
| `.gitignore` | Excluye las APK, la carpeta generada y los archivos de configuración local del repositorio. |
| `.git/` | Repositorio independiente en la rama `main`, preparado con un historial nuevo para subir la web. |
| `DESPLIEGUE_RENDER.md` | Guía de publicación del código, la APK y la página. |

Los recursos se llaman `logo-milpagrow.png`, `icono-milpagrow.png`, `logo-nereon.png`, `milpi.png` y `paisaje-finca.jpeg`. El logo de NEREON queda disponible como recurso, aunque la página actual identifica al equipo mediante texto.

## Cómo funciona el JavaScript

- `appModules` contiene los textos y las vistas de ejemplo de los cuatro módulos. `showModule` actualiza el panel y permite cambiar de pestaña con flechas, Inicio y Fin.
- `renderIcon`, `renderPreviewRow` y `renderModulePreview` construyen los iconos y las tarjetas de ejemplo a partir de contenido fijo.
- `milpiExamples` contiene las tres conversaciones predefinidas. Elegir una pregunta cambia el ejemplo visible.
- `applyTheme` aplica el tema y actualiza el botón. La única información que se guarda en el navegador es la preferencia `milpagrow-theme`.
- `closeNavigation` cierra el menú móvil al elegir un enlace, pulsar Escape, hacer clic fuera o pasar al ancho de escritorio.
- `sectionObserver` activa la aparición de secciones al desplazarse. Si se prefiere movimiento reducido, las animaciones se desactivan.
- El botón de descarga abre el enlace del instalador. El mensaje indica lo que debe hacer el visitante; no confirma que la descarga haya terminado.

Las preguntas frecuentes usan `details` y `summary` de HTML y funcionan sin JavaScript.

## Abrir en local

La ubicación de trabajo es `/home/waltz/Documentos/MilpaWeb`:

```bash
cd /home/waltz/Documentos/MilpaWeb
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Abre `http://localhost:8765` y detén el servidor con Ctrl+C. También puedes abrir `dist/index.html` directamente para revisar la página.

## Desplegar en Render

Sigue [DESPLIEGUE_RENDER.md](DESPLIEGUE_RENDER.md). La ruta preparada publica la página en Render y descarga la APK desde una publicación pública en GitHub Releases.

El instalador pesa **123.470.635 bytes**, aproximadamente 123 MB o 118 MiB. GitHub bloquea archivos mayores de 100 MiB en repositorios Git normales y recomienda Releases para distribuir binarios. Este repositorio está preparado con un historial nuevo que excluye la APK. Puedes subirlo directamente y adjuntar el instalador a una Release pública. [Documentación de GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

Para actualizar el instalador, publica la nueva APK en Releases, cambia `MILPAGROW_APK_URL` en Render, actualiza el tamaño visible en `dist/index.html` y vuelve a desplegar. Para conservar la descarga local, reemplaza también `dist/downloads/MilpaGrow.apk`.

## Estado y verificación

La carpeta contiene un repositorio local en `main`. El repositorio de GitHub, la Release del instalador y el despliegue en Render aún no se han creado.

Se verificaron la sintaxis de JavaScript, las referencias a archivos, las anclas, los selectores de las pestañas y la equivalencia del CSS después de los cambios de nombres y formato. Las cinco imágenes renombradas conservan sus bytes originales.

También se comprobó la preparación de Render en una copia temporal: genera los recursos completos, excluye la APK, exige una URL HTTPS y conserva el HTML original. Se usó un enlace de prueba; falta comprobar la descarga desde la Release pública real.

La APK conserva el SHA-256:

```text
c674ff17f4f3d52dbbcf3c4312d2098446fcd5cf51a82906bb9462ede5f20f06
```

No se ha repetido la revisión visual en un navegador durante la preparación de esta carpeta.
