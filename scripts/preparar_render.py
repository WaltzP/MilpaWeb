"""Prepara la página pública con un enlace externo para descargar la APK."""

import os
from html import escape
from pathlib import Path
import shutil
import sys
from urllib.parse import urlsplit


def preparar_sitio():
    apk_url = os.environ.get("MILPAGROW_APK_URL", "").strip()
    if not apk_url:
        sys.exit("Configura MILPAGROW_APK_URL con el enlace público HTTPS de MilpaGrow.apk.")

    try:
        enlace = urlsplit(apk_url)
        puerto = enlace.port
    except ValueError:
        sys.exit("MILPAGROW_APK_URL no es una URL válida.")

    if (
        enlace.scheme != "https"
        or not enlace.hostname
        or enlace.username is not None
        or enlace.password is not None
        or any(caracter.isspace() for caracter in apk_url)
        or (puerto is not None and not 0 < puerto <= 65535)
    ):
        sys.exit("MILPAGROW_APK_URL debe ser un enlace público HTTPS, sin credenciales.")

    proyecto = Path(__file__).resolve().parents[1]
    origen = proyecto / "dist"
    destino = proyecto / "build"
    pagina = (origen / "index.html").read_text(encoding="utf-8")
    descarga_local = 'href="downloads/MilpaGrow.apk" download="MilpaGrow.apk"'
    if pagina.count(descarga_local) != 1:
        sys.exit("No se encontró el enlace de descarga esperado en dist/index.html.")

    pagina = pagina.replace(descarga_local, f'href="{escape(apk_url, quote=True)}"')
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(origen, destino, ignore=shutil.ignore_patterns("*.apk", "_headers"))
    (destino / "index.html").write_text(pagina, encoding="utf-8")
    print("Sitio preparado en build/. La APK se descargará desde el enlace configurado.")


if __name__ == "__main__":
    preparar_sitio()
