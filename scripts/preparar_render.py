"""Prepara la landing con su configuración pública; la versión llega desde la API."""

import os
import json
from pathlib import Path
import shutil
import sys
from urllib.parse import urlsplit


def configuracion_publica(environ):
    api_url = environ.get("MILPAGROW_API_URL", "").strip().rstrip("/")
    try:
        enlace = urlsplit(api_url)
        puerto = enlace.port
    except ValueError:
        raise ValueError("MILPAGROW_API_URL no es una URL válida.")
    local = enlace.scheme == "http" and enlace.hostname in {"localhost", "127.0.0.1"}
    if (
        not api_url
        or (enlace.scheme != "https" and not local)
        or not enlace.hostname
        or enlace.username is not None
        or enlace.password is not None
        or enlace.query or enlace.fragment
        or not enlace.path.endswith("/api")
        or any(caracter.isspace() for caracter in api_url)
        or (puerto is not None and not 0 < puerto <= 65535)
    ):
        raise ValueError("MILPAGROW_API_URL debe terminar en /api y usar HTTPS (HTTP sólo en localhost).")
    config = {
        "apiUrl": api_url,
        "firebaseApiKey": environ.get("MILPAGROW_FIREBASE_API_KEY", "").strip(),
        "firebaseProjectId": environ.get("MILPAGROW_FIREBASE_PROJECT_ID", "").strip(),
    }
    if not config["firebaseApiKey"] or not config["firebaseProjectId"]:
        raise ValueError("Configura MILPAGROW_FIREBASE_API_KEY y MILPAGROW_FIREBASE_PROJECT_ID del mismo proyecto que la API.")
    return config


def preparar_sitio():
    try:
        config = configuracion_publica(os.environ)
    except ValueError as error:
        sys.exit(str(error))
    proyecto = Path(__file__).resolve().parents[1]
    origen = proyecto / "dist"
    destino = proyecto / "build"
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(origen, destino, ignore=shutil.ignore_patterns("*.apk", "_headers"))
    serialized = json.dumps(config, ensure_ascii=True).replace("<", "\\u003c").replace(">", "\\u003e")
    (destino / "config.js").write_text(f"window.MILPAGROW_CONFIG = Object.freeze({serialized});\n", encoding="utf-8")
    print("Sitio preparado en build/. La versión pública se consultará desde la API.")


if __name__ == "__main__":
    preparar_sitio()
