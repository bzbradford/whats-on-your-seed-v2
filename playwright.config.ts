import { defineConfig, devices } from '@playwright/test';

// E2E tests run against the production Pages build (dist/) served by `vite preview`.
// Parity tests (tests/e2e/parity.spec.ts) also load the frozen legacy app from
// legacy/static/ and compare screenshots of the two.
const LEGACY_URL = 'http://127.0.0.1:8081/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Serves the existing dist/; `pnpm test:e2e` builds first. Invoke vite directly:
      // a pnpm wrapper here leaves the server orphaned and Playwright hangs on exit.
      command: 'vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // The frozen legacy app, the visual/behaviour reference for the port.
      command: 'python3 legacy/serve.py --port 8081 --no-browser',
      url: LEGACY_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
