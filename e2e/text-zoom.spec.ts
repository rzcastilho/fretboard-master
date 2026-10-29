import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, expectNoTruncationOrOverlap } from './support/helpers';

const ARRANGEMENTS = [
  { name: 'reflow-320', width: 320, height: 800, expected: 'reflow' },
  { name: 'reflow-800', width: 800, height: 1000, expected: 'reflow' },
  { name: 'wide', width: 1280, height: 900, expected: /^wide-/ }
] as const;

const TOOLS = ['notes', 'triads', 'caged'] as const;

/** Root font 200% (tokens are rem-based); the resize event makes the viewport store re-read it. */
const zoom200 = (page: Page) =>
  page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'; // CSSOM: allowed under the style-src CSP
    window.dispatchEvent(new Event('resize'));
  });

const seed = (page: Page, frets: number) =>
  page.addInitScript((f) => {
    if (localStorage.getItem('__seeded') === null) {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, tuning: 'AF-21', strings: 7, frets: f })
      );
      localStorage.setItem('__seeded', '1');
    }
  }, frets);

async function open(
  page: Page,
  tool: string,
  size: { width: number; height: number },
  zoom = true
) {
  await page.setViewportSize(size);
  await page.goto(`/${tool}`);
  await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  await expect(page.locator('main .grid')).toHaveAttribute('data-arrangement', /.+/);
  if (zoom) await zoom200(page);
}

/** Pairs of zone children (direct children of `.grid`) whose boxes overlap. */
const overlaps = (page: Page) =>
  page.evaluate(() => {
    const kids = [...document.querySelectorAll<HTMLElement>('main .grid > *')]
      .map((el) => ({ name: el.className || el.tagName, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 1 && r.height > 1);
    const out: string[] = [];
    kids.forEach((a, i) => {
      for (const b of kids.slice(i + 1)) {
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w > 1 && h > 1) out.push(`${a.name} × ${b.name}`);
      }
    });
    return out;
  });

test.describe('200% text size (US5)', () => {
  for (const a of ARRANGEMENTS) {
    for (const tool of TOOLS) {
      test(`${tool} at ${a.name}: no clipping, no overlap, controls reachable`, async ({
        page
      }) => {
        await open(page, tool, a);
        await expect
          .poll(() => page.locator('main .grid').getAttribute('data-arrangement'))
          .toMatch(a.expected instanceof RegExp ? a.expected : new RegExp(`^${a.expected}$`));
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(
          '32px'
        );
        await expectNoTruncationOrOverlap(page);
        expect(await overlaps(page)).toEqual([]);
        await expectNoHorizontalScroll(page);

        // Every visible control can be scrolled into view and sits inside the page width.
        const controls = page.locator('main').getByRole('button');
        const n = await controls.count();
        for (let i = 0; i < n; i++) {
          const c = controls.nth(i);
          if (!(await c.isVisible())) continue;
          await c.scrollIntoViewIfNeeded();
          const b = await c.boundingBox();
          expect(b, `control ${i} has a box`).not.toBeNull();
          expect((b?.width ?? 0) > 0 && (b?.height ?? 0) > 0).toBe(true);
        }
      });
    }
  }

  test('summary wraps at reflow, never truncated', async ({ page }) => {
    await open(page, 'triads', { width: 320, height: 800 });
    const summary = page.locator('.summary-row .summary').first();
    await expect(summary).toBeVisible();
    const m = await summary.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        overflowing: el.scrollWidth > el.clientWidth + 1,
        ellipsis: s.textOverflow === 'ellipsis',
        nowrap: s.whiteSpace === 'nowrap',
        lines: el.getBoundingClientRect().height / parseFloat(s.lineHeight)
      };
    });
    expect(m.overflowing).toBe(false);
    expect(m.ellipsis).toBe(false);
    expect(m.nowrap).toBe(false);
    expect(m.lines).toBeGreaterThan(1.5);
    // The toggle stays reachable beside/below it.
    await page
      .getByRole('button', { name: /details/i })
      .first()
      .scrollIntoViewIfNeeded();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('theme selector at 200% (US1)', () => {
  test('rows wrap inside 320 px on home, labels never truncated', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/');
    await zoom200(page);
    const selector = page.locator('fieldset.theme');
    await expect(selector).toBeVisible();
    const m = await selector.locator('label').evaluateAll((labels) =>
      labels.map((el) => {
        const r = el.getBoundingClientRect();
        const text = el.querySelector('span') as HTMLElement;
        return {
          right: r.right,
          clipped: text.scrollWidth > text.clientWidth + 1,
          ellipsis: getComputedStyle(text).textOverflow === 'ellipsis'
        };
      })
    );
    expect(m).toHaveLength(3);
    for (const row of m) {
      expect(row.clipped).toBe(false);
      expect(row.ellipsis).toBe(false);
      expect(row.right).toBeLessThanOrEqual(320);
    }
    await expectNoTruncationOrOverlap(page);
    await expectNoHorizontalScroll(page);
  });
});

test.describe('live re-evaluation (US5)', () => {
  const size = { width: 1400, height: 900 };
  const fit = (page: Page) => page.getByRole('button', { name: 'Fit to screen' });
  const minimap = (page: Page) => page.getByRole('slider', { name: 'Fretboard overview' });

  test('neck that fits at 100% overflows at 200%', async ({ page }) => {
    await seed(page, 24);
    await open(page, 'notes', size, false);
    await expect(fit(page)).toHaveCount(0);
    await expect(minimap(page)).toHaveCount(0);
  });

  test('same neck shows Fit to screen and minimap at 200%', async ({ page }) => {
    await seed(page, 24);
    await open(page, 'notes', size);
    await expect(fit(page)).toBeVisible();
    await expect(minimap(page)).toBeVisible();
  });
});
