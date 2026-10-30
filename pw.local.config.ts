import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  // Shared local machine: cap workers so concurrent worktree runs do not starve each other.
  workers: /^\d+$/.test(process.env.PW_WORKERS ?? '')
    ? Number(process.env.PW_WORKERS)
    : (process.env.PW_WORKERS ?? '50%'),
  use: { ...base.use, locale: 'en-US' },
  projects: (base.projects ?? [])
    .filter((p) => ['desktop', 'nojs'].includes(p.name as string))
    // Installed Chrome locally; the bundled Chromium where browsers are pre-provisioned
    // (PLAYWRIGHT_BROWSERS_PATH, e.g. the autonomous container).
    .map((p) =>
      process.env.PLAYWRIGHT_BROWSERS_PATH ? p : { ...p, use: { ...p.use, channel: 'chrome' } }
    )
});
