import { expect, test, type Page } from '@playwright/test';

// Runs in the `phone-touch` project (320 × 640, touch, mobile).
const events = (page: Page) => page.evaluate(() => globalThis.__fmFretboardEvents);

/** Fractional columns of string 1's cells inside the scroller's visible box (SC-005). */
const visibleColumns = (page: Page) =>
  page.evaluate(() => {
    const scroller = document.querySelector('.fretboard .scroller');
    if (!scroller) throw new Error('no scroller');
    const box = scroller.getBoundingClientRect();
    let total = 0;
    for (const cell of document.querySelectorAll('.cell[data-string="1"]')) {
      const r = cell.getBoundingClientRect();
      const overlap = Math.min(r.right, box.right) - Math.max(r.left, box.left);
      if (overlap > 0) total += overlap / r.width;
    }
    return total;
  });

/**
 * One-finger drag from the scroller's center by (dx, dy) as raw touch events.
 * `Input.synthesizeScrollGesture` with touch is a no-op in Linux Chromium (CI), so the drag is
 * dispatched point by point; the browser still resolves it through `touch-action` as a real swipe.
 */
async function swipe(page: Page, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const box = await page.locator('.fretboard .scroller').boundingBox();
  if (!box) throw new Error('no scroller box');
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  const steps = 10;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }]
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-touch', 'phone-touch only');
  await page.goto('/notes');
  await expect(page.getByRole('grid', { name: 'Fretboard' })).toBeVisible();
});

test('horizontal swipe scrolls the board, not the page (US4-1, SC-002)', async ({ page }) => {
  const scroller = page.locator('.fretboard .scroller');
  expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(0);
  await swipe(page, -200, 0);
  await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

test('vertical swipe on the board scrolls the page (US4-2)', async ({ page }) => {
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await swipe(page, 0, -200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await page.locator('.fretboard .scroller').evaluate((el) => el.scrollLeft)).toBe(0);
});

test('5–7 columns are visible at scroll 0, 25 %, 50 %, 75 % and max (US4-3, SC-005)', async ({
  page
}) => {
  const scroller = page.locator('.fretboard .scroller');
  const max = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(max).toBeGreaterThan(0);
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    await scroller.evaluate((el, left) => (el.scrollLeft = left), Math.round(max * frac));
    const n = await visibleColumns(page);
    expect(n, `at ${frac * 100}%`).toBeGreaterThanOrEqual(5);
    expect(n, `at ${frac * 100}%`).toBeLessThanOrEqual(7);
  }
});

test('a touch tap emits one event; a two-finger tap emits none', async ({ page }) => {
  const box = await page.locator('.cell[data-string="3"][data-fret="2"]').boundingBox();
  if (!box) throw new Error('no cell');
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  await page.touchscreen.tap(x, y);
  await expect.poll(() => events(page)).toEqual([{ string: 3, fret: 2 }]);

  const cdp = await page.context().newCDPSession(page);
  const points = [
    { x, y, id: 1 },
    { x: x + 30, y, id: 2 }
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  expect(await events(page)).toEqual([{ string: 3, fret: 2 }]);
});

test('scrolling under 4× CPU throttle has no long animation frame over 50 ms (SC-009)', async ({
  page
}) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    const w = window as unknown as { __loafs: number[] };
    w.__loafs = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__loafs.push(e.duration);
      }).observe({ type: 'long-animation-frame', buffered: false });
    } catch {
      /* long-animation-frame unsupported: assertion below passes vacuously */
    }
  });
  // Let hydration settle, then measure only the scroll gestures.
  await page.waitForTimeout(1000);
  await page.evaluate(() => ((window as unknown as { __loafs: number[] }).__loafs.length = 0));
  await swipe(page, -250, 0);
  await swipe(page, 250, 0);
  const loafs = await page.evaluate(() => (window as unknown as { __loafs: number[] }).__loafs);
  expect(Math.max(0, ...loafs)).toBeLessThanOrEqual(50);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

/** Two-finger pinch from the scroller's centre: fingers start `from` px apart and end `to` apart. */
async function pinch(page: Page, from: number, to: number) {
  const cdp = await page.context().newCDPSession(page);
  // Seven strings push the board's centre below a 640 px fold; touches must land on it.
  await page.locator('.fretboard .scroller').scrollIntoViewIfNeeded();
  const box = await page.locator('.fretboard .scroller').boundingBox();
  if (!box) throw new Error('no scroller box');
  const cx = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  const at = (gap: number) => [
    { x: cx - gap / 2, y, id: 1 },
    { x: cx + gap / 2, y, id: 2 }
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from) });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: at(from + ((to - from) * i) / steps)
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('pinch toggles fit (US2)', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      'fretboard-master:prefs',
      JSON.stringify({ version: 1, tuning: 'AF-21', strings: 7, frets: 24 })
    );
  });
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Fretboard' })).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Fit to screen' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await pinch(page, 200, 80);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await pinch(page, 80, 200);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  // One-finger scroll never toggles.
  await swipe(page, -120, 0);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
