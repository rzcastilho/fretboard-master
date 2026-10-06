import base from './playwright.config';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  ...base,
  use: { ...base.use, locale: 'en-US' },
  projects: [
    { name: 'ff', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } }
  ]
});
