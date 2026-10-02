import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe } from './support/helpers';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Tools' });

test('card opens tool with five named zones @smoke', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Triads — What is a chord made of?' }).click();
  await expect(page).toHaveURL(/\/triads$/);
  await expect(page.getByRole('banner')).toBeVisible();
  for (const name of ['Main controls', 'Fretboard', 'Composition', 'Actions']) {
    await expect(page.getByRole('region', { name })).toBeVisible();
  }
});

test('nav order and aria-current @smoke', async ({ page }) => {
  await page.goto('/triads');
  await expect(nav(page).getByRole('link')).toHaveText([
    'Home',
    'Fretboard Notes',
    'Triads',
    'About'
  ]);
  await expect(nav(page).locator('[aria-current="page"]')).toHaveText('Triads');
});

test('history: Home → Triads → Notes, Back/Forward @smoke', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /^Triads/ }).click();
  await nav(page).getByRole('link', { name: 'Fretboard Notes' }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/triads$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/triads$/);
});

test('re-selecting current tool adds no history entry @smoke', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /^Triads/ }).click();
  await expect(page).toHaveURL(/\/triads$/);
  const before = await page.evaluate(() => history.length);
  await nav(page).getByRole('link', { name: 'Triads' }).click();
  await expect(page).toHaveURL(/\/triads$/);
  expect(await page.evaluate(() => history.length)).toBe(before);
});

test('keyboard reaches cards and nav; focus lands on h1', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const card = page.getByRole('link', { name: /^Fretboard Notes/ });
  await card.focus();
  await expect(card).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const triads = nav(page).getByRole('link', { name: 'Triads' });
  await triads.focus();
  await expect(triads).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/triads$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

for (const [path, heading, title] of [
  ['/notes', 'Fretboard Notes', 'Fretboard Notes — Fretboard Master'],
  ['/triads', 'Triads', 'Triads — Fretboard Master'],
  ['/about', 'About Fretboard Master', 'About — Fretboard Master']
] as const) {
  test(`direct open and reload ${path} @smoke`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await page.reload();
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  });
}

test('/triads/ redirects to /triads', async ({ page }) => {
  await page.goto('/triads/');
  await expect(page).toHaveURL(/\/triads$/);
  await expect(page).toHaveTitle('Triads — Fretboard Master');
});

test('layout: fretboard largest; context panel placement', async ({ page }, info) => {
  await page.goto('/triads');
  const box = async (name: string) => {
    const r = await page.getByRole('region', { name }).boundingBox();
    if (!r) throw new Error(`no box for ${name}`);
    return r;
  };
  const [b, c, d, e] = await Promise.all(
    ['Main controls', 'Fretboard', 'Composition', 'Actions'].map(box)
  );
  const area = (r: { width: number; height: number }) => r.width * r.height;
  expect(area(c)).toBeGreaterThan(area(b));
  expect(area(c)).toBeGreaterThan(area(d));
  expect(area(c)).toBeGreaterThan(area(e));
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 1024) {
    expect(d.x).toBeGreaterThanOrEqual(c.x + c.width - 1);
  } else {
    expect(d.y).toBeGreaterThanOrEqual(c.y + c.height - 1);
    expect(e.y).toBeLessThan(d.y);
  }
  void info;
});

for (const path of ['/notes', '/triads']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe ${path} ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await runAxe(page);
    });
  }
  for (const width of [320, 360, 600, 1024, 1280, 2560]) {
    test(`no horizontal scroll ${path} @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await expectNoHorizontalScroll(page);
    });
  }
}
