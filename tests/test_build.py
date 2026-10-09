import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("build", Path(__file__).resolve().parents[1] / "scripts/preparar_render.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class BuildConfiguration(unittest.TestCase):
    def test_landing_preview_needs_no_api_configuration(self):
        self.assertFalse(any(build.configuracion_publica({}).values()))

    def test_public_whitelist_and_urls(self):
        values = {"MILPAGROW_API_URL": "https://api.example.com/api/", "MILPAGROW_FIREBASE_API_KEY": "public-key", "MILPAGROW_FIREBASE_PROJECT_ID": "demo", "GITHUB_RELEASE_TOKEN": "must-not-appear", "WEBSITE_SPAM_SECRET": "must-not-appear"}
        self.assertEqual(build.configuracion_publica(values), {"apiUrl": "https://api.example.com/api", "firebaseApiKey": "public-key", "firebaseProjectId": "demo", "registrationApiUrl": ""})
        for url in ["", "http://api.example.com/api", "https://user:pass@api.example.com/api", "https://api.example.com/api?secret=value", "https://api.example.com/api#fragment", "https://api.example.com/downloads"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                build.configuracion_publica({**values, "MILPAGROW_API_URL": url})
        self.assertEqual(build.configuracion_publica({**values, "MILPAGROW_API_URL": "http://localhost:3000/api"})["apiUrl"], "http://localhost:3000/api")

    def test_registration_url_and_private_keys(self):
        values = {"MILPAGROW_API_URL": "https://milpagrow.example/api", "MILPAGROW_FIREBASE_API_KEY": "public-key", "MILPAGROW_FIREBASE_PROJECT_ID": "same-project", "MILPAGROW_REGISTRATION_API_URL": "https://registration.example/api/registration/", "FIREBASE_SERVICE_ACCOUNT_JSON": "private", "BREVO_API_KEY": "private", "WEBSITE_REGISTRATION_SECRET": "private"}
        config = build.configuracion_publica(values)
        self.assertEqual(config["registrationApiUrl"], "https://registration.example/api/registration")
        self.assertNotIn("private", str(config))
        for url in ["http://remote.example/api/registration", "https://user:password@registration.example/api/registration", "https://registration.example/api/registration?token=secret", "https://registration.example/api", "https://registration.example:99999/api/registration"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                build.configuracion_publica({**values, "MILPAGROW_REGISTRATION_API_URL": url})

    def test_render_rejects_incomplete_auth_configuration_to_preserve_live_download(self):
        with self.assertRaises(ValueError):
            build.configuracion_publica({"RENDER": "true"})
        with self.assertRaises(ValueError):
            build.configuracion_publica({"RENDER": "true", "MILPAGROW_API_URL": "https://api.example/api", "MILPAGROW_FIREBASE_API_KEY": "public-key", "MILPAGROW_FIREBASE_PROJECT_ID": "same-project"})


if __name__ == "__main__":
    unittest.main()
