import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("build", Path(__file__).resolve().parents[1] / "scripts/preparar_render.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class BuildConfiguration(unittest.TestCase):
    def test_static_download_needs_no_api_configuration(self):
        self.assertFalse(any(build.configuracion_publica({}).values()))

    def test_public_whitelist_and_urls(self):
        values = {"MILPAGROW_API_URL": "https://api.example.com/api/", "MILPAGROW_FIREBASE_API_KEY": "public-key", "MILPAGROW_FIREBASE_PROJECT_ID": "demo", "GITHUB_RELEASE_TOKEN": "must-not-appear", "WEBSITE_SPAM_SECRET": "must-not-appear"}
        self.assertEqual(build.configuracion_publica(values), {"apiUrl": "https://api.example.com/api", "firebaseApiKey": "public-key", "firebaseProjectId": "demo"})
        for url in ["", "http://api.example.com/api", "https://user:pass@api.example.com/api", "https://api.example.com/api?secret=value", "https://api.example.com/api#fragment", "https://api.example.com/downloads"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                build.configuracion_publica({**values, "MILPAGROW_API_URL": url})
        self.assertEqual(build.configuracion_publica({**values, "MILPAGROW_API_URL": "http://localhost:3000/api"})["apiUrl"], "http://localhost:3000/api")


if __name__ == "__main__":
    unittest.main()
