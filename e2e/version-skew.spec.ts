import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { expect, test, type Request } from '@playwright/test';

// Needs both `build/` (version N, served by preview) and `build-next/` (N+1): `pnpm build:test:skew`.
const nextDir = join(process.cwd(), 'build-next');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain'
};

function resolve(pathname: string): string | null {
  const clean = pathname.replace(/\/$/, '') || '/index';
  const candidates = [join(nextDir, clean), join(nextDir, `${clean}.html`)];
  return candidates.find((p) => existsSync(p) && extname(p) !== '') ?? null;
}

test.skip(!existsSync(nextDir), 'build-next/ missing; run `pnpm build:test:skew`');
test.skip(({ browserName }) => browserName !== 'chromium', 'single-browser check');

test('open session keeps its version across a publish; reload picks up the new one', async ({
  page
}) => {
  const failed: Request[] = [];
  const bad: string[] = [];
  page.on('requestfailed', (r) => failed.push(r));
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });

  await page.goto('/');
  await page.waitForLoadState('load');
  const entries = () => page.evaluate(() => performance.getEntriesByType('navigation').length);
  const before = await entries();

  // Simulate a publish: every later request is served from version N+1; N's hashed files are gone.
  await page.route('**/*', async (route) => {
    const { pathname } = new URL(route.request().url());
    const file = resolve(pathname);
    if (!file) return route.fulfill({ status: 404, body: 'gone' });
    return route.fulfill({
      status: 200,
      contentType: types[extname(file)] ?? 'application/octet-stream',
      body: readFileSync(file)
    });
  });

  const nav = page.getByRole('navigation', { name: 'Tools' });
  await page.getByRole('link', { name: /^Triads/ }).click();
  await expect(page).toHaveURL(/\/triads$/);
  await nav.getByRole('link', { name: 'Fretboard Notes' }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await nav.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await nav.getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('banner').getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);

  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  const [maj, min, patch] = pkg.version.split('.').map(Number);
  const next = `${maj}.${min}.${patch + 1}`;

  expect(failed).toEqual([]);
  expect(bad).toEqual([]);
  expect(await entries()).toBe(before);
  await expect(page.getByText(`Version ${pkg.version}`, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(`Version ${next}`, { exact: true })).toBeVisible();
});
