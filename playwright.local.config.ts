import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  use: { ...base.use, locale: 'en-US' },
  projects: (base.projects ?? []).map((p) => ({ ...p, use: { ...p.use, channel: 'chrome' } }))
});
