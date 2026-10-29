import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe } from './support/helpers';

type Tool = 'notes' | 'triads' | 'caged';
const TOOLS: readonly Tool[] = ['notes', 'triads', 'caged'];

const seed = (page: Page, frets: number) =>
  page.addInitScript((n) => {
    if (localStorage.getItem('__seeded') === null) {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, tuning: 'AF-1', frets: n })
      );
      localStorage.setItem('__seeded', '1');
    }
  }, frets);

const open = async (page: Page, tool: Tool, width: number, height: number, frets = 12) => {
  await page.setViewportSize({ width, height });
  await seed(page, frets);
  await page.goto(`/${tool}`);
  await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  await expect(page.locator('main .grid')).toHaveAttribute('data-arrangement', /.+/);
};

const grid = (page: Page) => page.locator('main .grid');
const zone = (page: Page, z: 'b' | 'c' | 'd' | 'e') => grid(page).locator(`.${z}`).first();
const box = async (loc: Locator) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error('no box');
  return b;
};
const minimap = (page: Page) => page.getByRole('slider', { name: 'Fretboard overview' });
const fitToggle = (page: Page) => page.getByRole('button', { name: 'Fit to screen' });

test.describe('reflow (US3)', () => {
  for (const tool of TOOLS) {
    test(`reflow order: ${tool}`, async ({ page }) => {
      await open(page, tool, 320, 800);
      await expect(grid(page)).toHaveAttribute('data-arrangement', 'reflow');
      const [b, c, e, d] = await Promise.all(
        (['b', 'c', 'e', 'd'] as const).map((z) => box(zone(page, z)))
      );
      expect(b.y).toBeLessThan(c.y);
      expect(c.y).toBeLessThan(e.y);
      expect(e.y).toBeLessThan(d.y);
    });

    test(`reflow zone B rows: ${tool}`, async ({ page }) => {
      await open(page, tool, 320, 800);
      const rows = zone(page, 'b').locator('.controls-row');
      await expect(rows).toHaveCount(2);
      // Rows wrap (029): every control stays inside the screen width, never in a menu.
      for (const row of await rows.all()) {
        const r = await box(row);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(320);
        await expect(row).not.toHaveAttribute('data-overflow', /.+/);
      }
      await expect(zone(page, 'b').locator('[aria-haspopup]')).toHaveCount(0);
    });
  }

  test('context summary: collapse and expand', async ({ page }) => {
    await open(page, 'triads', 390, 844);
    const show = page.getByRole('button', { name: 'Show details' });
    await expect(show).toHaveAttribute('aria-expanded', 'false');
    await expect(zone(page, 'd').getByText('C major · Root position · C – E – G')).toBeVisible();
    const content = page.locator(`#${await show.getAttribute('aria-controls')}`);
    await expect(content).toBeHidden();
    await show.click();
    const hide = page.getByRole('button', { name: 'Hide details' });
    await expect(hide).toHaveAttribute('aria-expanded', 'true');
    await expect(content).toBeVisible();
    await hide.click();
    await expect(content).toBeHidden();
  });

  test('context summary: the choice is kept across tools', async ({ page }) => {
    await open(page, 'triads', 390, 844);
    await page.getByRole('button', { name: 'Show details' }).click();
    await page.getByRole('link', { name: 'CAGED' }).first().click();
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(page.getByRole('button', { name: 'Hide details' })).toBeVisible();
  });
});

test.describe('wide (US3)', () => {
  test('1440 / 24 frets: wide-stacked, no Fit to screen, no minimap', async ({ page }) => {
    await open(page, 'notes', 1440, 900, 24);
    await expect(grid(page)).toHaveAttribute('data-arrangement', 'wide-stacked');
    await expect(fitToggle(page)).toHaveCount(0);
    await expect(minimap(page)).toHaveCount(0);
    const [c, e, d] = await Promise.all((['c', 'e', 'd'] as const).map((z) => box(zone(page, z))));
    expect(c.y).toBeLessThan(e.y);
    expect(Math.abs(e.y - d.y)).toBeLessThan(2);
  });

  test('1440 / 12: wide-side', async ({ page }) => {
    await open(page, 'notes', 1440, 900, 12);
    await expect(grid(page)).toHaveAttribute('data-arrangement', 'wide-side');
    const [b, c, e, d] = await Promise.all(
      (['b', 'c', 'e', 'd'] as const).map((z) => box(zone(page, z)))
    );
    // Left column B, C, E; right column D.
    expect(d.x).toBeGreaterThan(c.x + c.width - 2);
    expect(b.y).toBeLessThan(c.y);
    expect(c.y).toBeLessThan(e.y);
  });

  test('2560 / 24: wide-side', async ({ page }) => {
    await open(page, 'notes', 2560, 1440, 24);
    await expect(grid(page)).toHaveAttribute('data-arrangement', 'wide-side');
  });

  test('1024 / 24: wide-stacked with the minimap shown', async ({ page }) => {
    await open(page, 'notes', 1024, 800, 24);
    await expect(grid(page)).toHaveAttribute('data-arrangement', 'wide-stacked');
    await expect(minimap(page)).toBeVisible();
  });

  test('wide threshold keeps state', async ({ page }) => {
    await open(page, 'notes', 1440, 900, 12);
    await expect(grid(page)).toHaveAttribute('data-arrangement', 'wide-side');
    const chip = page.getByRole('button', { name: 'E', exact: true }).first();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width: 800, height: 1000 });
    await expect(grid(page)).toHaveAttribute('data-arrangement', 'reflow');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(grid(page)).toHaveAttribute('data-arrangement', 'wide-side');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('no page horizontal scroll (US3)', () => {
  for (const width of [320, 600, 1024, 1280, 2560]) {
    for (const tool of TOOLS) {
      test(`${tool} at ${width}`, async ({ page }) => {
        await open(page, tool, width, width >= 1024 ? 900 : 800, 24);
        await expectNoHorizontalScroll(page);
      });
    }
  }
});

test.describe('arrangement a11y (US3)', () => {
  test('axe: reflow collapsed and expanded', async ({ page }) => {
    await open(page, 'caged', 390, 844);
    await runAxe(page);
    await page.getByRole('button', { name: 'Show details' }).click();
    await runAxe(page);
  });

  test('axe: reflow at 800 and wide', async ({ page }) => {
    await open(page, 'triads', 800, 1000);
    await runAxe(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await runAxe(page);
  });
});

test.describe('arrangement screenshots (US3)', () => {
  const CASES = [
    { name: 'reflow', tool: 'notes', width: 390, height: 844, frets: 12 },
    { name: 'wide-side', tool: 'caged', width: 1440, height: 900, frets: 12 },
    { name: 'wide-stacked', tool: 'notes', width: 1440, height: 900, frets: 24 }
  ] as const;

  for (const c of CASES) {
    test(`arrangement screenshot: ${c.name}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, c.tool, c.width, c.height, c.frets);
      await expect(grid(page)).toHaveAttribute('data-arrangement', c.name);
      await expect(page).toHaveScreenshot(`arrangement-${c.name}.png`, { fullPage: true });
    });
  }
});
