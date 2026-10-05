import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  use: { ...base.use, locale: 'en-US' },
  projects: (base.projects ?? [])
    .filter((p) => ['phone', 'phone-touch', 'desktop', 'nojs'].includes(p.name as string))
    .map((p) => ({ ...p, use: { ...p.use, channel: 'chrome' } }))
});
