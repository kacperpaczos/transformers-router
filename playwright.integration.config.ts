import { defineConfig } from '@playwright/test';

const NO_WEB_SERVER = !!process.env.NO_WEB_SERVER;

export default defineConfig({
  testDir: './tests/integration-browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Sequential dla stabilności
  timeout: 300000, // 5 minut na test (ładowanie modeli)
  
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    viewport: { width: 1280, height: 720 },
    // CORS headers dla ładowania modeli
    extraHTTPHeaders: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  
  webServer: NO_WEB_SERVER
    ? undefined
    : {
        command: 'node tests/integration-browser/server.mjs',
        port: 3001,
        timeout: 120000,
        reuseExistingServer: !process.env.CI,
      },
  
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-integration-report' }],
    ['json', { outputFile: 'playwright-integration-results.json' }],
  ],
});
