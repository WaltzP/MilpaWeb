"""Prepara la landing y el acceso de cuentas antes de descargar el APK."""

import os
import json
from pathlib import Path
import shutil
import sys
from urllib.parse import urlsplit


def configuracion_publica(environ):
    api_url = environ.get("MILPAGROW_API_URL", "").strip().rstrip("/")
    config = {
        "apiUrl": api_url,
        "firebaseApiKey": environ.get("MILPAGROW_FIREBASE_API_KEY", "").strip(),
        "firebaseProjectId": environ.get("MILPAGROW_FIREBASE_PROJECT_ID", "").strip(),
        "registrationApiUrl": environ.get("MILPAGROW_REGISTRATION_API_URL", "").strip().rstrip("/"),
    }
    # Se puede previsualizar la landing sin servicios; el acceso necesita configuración.
    if environ.get("RENDER") == "true" and not all(config.values()):
        raise ValueError("Antes de publicar el acceso, configura las cuatro variables públicas MILPAGROW_* y despliega el servicio de registro. El build se detiene para conservar la web anterior.")
    if not any(config.values()):
        return config
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
    if not config["firebaseApiKey"] or not config["firebaseProjectId"]:
        raise ValueError("Configura MILPAGROW_FIREBASE_API_KEY y MILPAGROW_FIREBASE_PROJECT_ID del mismo proyecto que la API.")
    if config["registrationApiUrl"]:
        try:
            registro = urlsplit(config["registrationApiUrl"])
            puerto_registro = registro.port
        except ValueError:
            raise ValueError("MILPAGROW_REGISTRATION_API_URL no es una URL válida.")
        local_registro = registro.scheme == "http" and registro.hostname in {"localhost", "127.0.0.1"}
        if (registro.scheme != "https" and not local_registro) or not registro.hostname or registro.username is not None or registro.password is not None or registro.query or registro.fragment or not registro.path.endswith("/api/registration") or any(c.isspace() for c in config["registrationApiUrl"]) or (puerto_registro is not None and not 0 < puerto_registro <= 65535):
            raise ValueError("MILPAGROW_REGISTRATION_API_URL debe terminar en /api/registration y usar HTTPS (HTTP sólo en localhost).")
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
    print("Sitio preparado en build/. Descarga protegida con cuenta y código por correo.")


if __name__ == "__main__":
    preparar_sitio()
