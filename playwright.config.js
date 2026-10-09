import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '*.spec.js', fullyParallel: true, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: {
    command: 'python3 scripts/preparar_render.py && python3 -m http.server 4173 --bind 127.0.0.1 --directory build',
    url: 'http://127.0.0.1:4173', reuseExistingServer: false,
    env: { MILPAGROW_API_URL: 'http://127.0.0.1:3000/api', MILPAGROW_FIREBASE_API_KEY: 'public-test-key', MILPAGROW_FIREBASE_PROJECT_ID: 'demo-milpagrow' },
  },
});
