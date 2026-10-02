import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  webServer: {
    // Serves the `--mode test` build (fault hook enabled) with host-like 404 routing. Run `pnpm build:test` first.
    command: `node scripts/serve-build.mjs build ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'phone',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } }
    },
    {
      name: 'phone-touch',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 640 },
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
    },
    // Navigation smoke only (tagged @smoke in e2e/navigation.spec.ts).
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@smoke/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@smoke/ },
    {
      name: 'nojs',
      use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
      testMatch: /nojs\.spec\.ts/
    }
  ]
});
