import { expect, test, type Locator, type Page } from '@playwright/test';

import { expandDetails, expectNoHorizontalScroll, runAxe } from './support/helpers';

for (const path of ['/notes', '/triads']) {
  test.describe(`fretboard layout on ${path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
    });

    test('zone C shows the grid with 138 cells', async ({ page }) => {
      const zone = page.getByRole('region', { name: 'Fretboard' });
      const grid = zone.getByRole('grid', { name: 'Fretboard' });
      await expect(grid).toBeVisible();
      await expect(grid.getByRole('row')).toHaveCount(6);
      await expect(grid.getByRole('gridcell')).toHaveCount(138);
      await expect(zone.getByText('The fretboard will appear here.')).toHaveCount(0);
    });

    test('string 2 fret 1 is C and string 6 open is E', async ({ page }) => {
      // /notes marks the natural notes, which appends ", note" to those cell names
      await expect(
        page.getByRole('gridcell', { name: /^C, string 2, fret 1(, note)?$/ })
      ).toHaveCount(1);
      await expect(
        page.getByRole('gridcell', { name: /^E, string 6, open(, note)?$/ })
      ).toHaveCount(1);
    });

    test('inlays, fret numbers 1–22 with bold inlay frets, and string labels', async ({ page }) => {
      const grid = page.getByRole('grid', { name: 'Fretboard' });
      await expect(grid.locator('.inlay')).toHaveCount(10);
      const numbers = grid.locator('.fret-number');
      await expect(numbers).toHaveCount(22);
      await expect(numbers).toHaveText(Array.from({ length: 22 }, (_, i) => `${i + 1}`));
      const weight = (n: number) =>
        numbers.nth(n - 1).evaluate((el) => Number(getComputedStyle(el).fontWeight));
      expect(await weight(3)).toBeGreaterThan(await weight(4));
      expect(await weight(12)).toBeGreaterThan(await weight(11));
      await expect(grid.locator('.string-label')).toHaveText([
        '1 E',
        '2 B',
        '3 G',
        '4 D',
        '5 A',
        '6 E'
      ]);
      const label = await grid.locator('.string-label').first().boundingBox();
      const nut = await grid.locator('.nut').boundingBox();
      expect(label && nut && label.x + label.width <= nut.x).toBe(true);
    });

    test('no number under the open column', async ({ page }) => {
      const grid = page.getByRole('grid', { name: 'Fretboard' });
      const openCell = await grid.locator('[data-string="6"][data-fret="0"]').boundingBox();
      const first = await grid.locator('.fret-number').first().boundingBox();
      if (!openCell || !first) throw new Error('missing box');
      expect(first.x).toBeGreaterThanOrEqual(openCell.x + openCell.width - 1);
      await expect(grid.locator('.fret-number', { hasText: /^0$/ })).toHaveCount(0);
    });
  });
}

// Fixtures and pointer events run on /triads, which honours the test-build fixture and event hooks.
async function withFixture(page: Page, name: string): Promise<void> {
  await page.addInitScript((n) => {
    globalThis.__fmFretboardFixture = n as typeof globalThis.__fmFretboardFixture;
  }, name);
  await page.goto('/triads');
  await expandDetails(page);
}

test.describe('markers (US2)', () => {
  test('all-markers fixture is distinguishable in grayscale', async ({ page }) => {
    await withFixture(page, 'all-markers');
    const grid = page.getByRole('grid', { name: 'Fretboard' });
    for (const fn of ['root', 'third', 'fifth', 'degree', 'neutral']) {
      await expect(grid.locator(`.marker.${fn}`).first()).toBeVisible();
    }
    for (const emphasis of ['highlighted', 'normal', 'dimmed']) {
      await expect(grid.locator(`.marker.${emphasis}`).first()).toBeVisible();
    }
    // CSP is style-src 'self': a <style> tag is blocked, CSSOM writes are not.
    await page.evaluate(() => {
      document.documentElement.style.filter = 'grayscale(1)';
    });
    await expect(grid).toHaveScreenshot('all-markers-grayscale.png', { animations: 'disabled' });
  });

  test('labels-spelled fixture shows E♯ and B𝄫 with the accidentals font', async ({ page }) => {
    await withFixture(page, 'labels-spelled');
    const labels = page.getByRole('grid', { name: 'Fretboard' }).locator('.marker text');
    await expect(labels.filter({ hasText: /^E♯$/ })).toHaveCount(1);
    await expect(labels.filter({ hasText: /^B\u{1D12B}$/u })).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.fonts.check("12px 'FM Accidentals'", '♯\u{1D12B}'))
    ).toBe(true);
  });

  test('accidentals font is not requested on / or on a plain /notes', async ({ page }) => {
    const fontRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/fonts/fm-accidentals.woff2')) fontRequests.push(r.url());
    });
    await page.goto('/');
    await page.goto('/notes');
    await expandDetails(page);
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    expect(fontRequests).toEqual([]);
  });
});

async function boxOf(loc: Locator) {
  const box = await loc.boundingBox();
  if (!box) throw new Error('no bounding box');
  return box;
}

test.describe('fretboard pointer interaction (US3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmFretboardEvents = [];
    });
    // A blank board, in view and unscrolled (the triads shape would auto-scroll it).
    await withFixture(page, 'empty');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(page.locator('.fretboard .marker')).toHaveCount(0);
    // Reset until settled: the initial auto-scroll toward the triads shape may still be running.
    await expect
      .poll(() =>
        page.locator('.fretboard .scroller').evaluate(async (el) => {
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          el.scrollTo({ left: 0, behavior: 'instant' });
          const y = el.getBoundingClientRect().top;
          await new Promise((r) => setTimeout(r, 200));
          return el.scrollLeft === 0 && el.getBoundingClientRect().top === y;
        })
      )
      .toBe(true);
  });

  const events = (page: Page) => page.evaluate(() => globalThis.__fmFretboardEvents);

  test('clicking all 138 cell centers reports every (string, fret) in order', async ({ page }) => {
    const expected: { string: number; fret: number }[] = [];
    for (let string = 1; string <= 6; string++) {
      for (let fret = 0; fret <= 22; fret++) {
        const cell = page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);
        await cell.scrollIntoViewIfNeeded();
        const box = await boxOf(cell);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        expected.push({ string, fret });
      }
    }
    expect(await events(page)).toEqual(expected);
  });

  test('a point left of the open column reports fret 0', async ({ page }) => {
    const cell = page.locator('.cell[data-string="3"][data-fret="0"]');
    const box = await boxOf(cell);
    await page.mouse.click(box.x - 10, box.y + box.height / 2);
    expect(await events(page)).toEqual([{ string: 3, fret: 0 }]);
  });

  test('the midpoint between two cells reports the lower fret', async ({ page }) => {
    const a = await boxOf(page.locator('.cell[data-string="2"][data-fret="3"]'));
    const b = await boxOf(page.locator('.cell[data-string="2"][data-fret="4"]'));
    const mid = (a.x + a.width / 2 + b.x + b.width / 2) / 2;
    await page.mouse.click(mid, a.y + a.height / 2);
    expect(await events(page)).toEqual([{ string: 2, fret: 3 }]);
  });

  test('dragging 12 px scrolls without activating', async ({ page }) => {
    const scroller = page.locator('.fretboard .scroller');
    const scrolls = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth);
    test.skip(!scrolls, 'board fits viewport');
    const box = await boxOf(page.locator('.cell[data-string="3"][data-fret="3"]'));
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 12, y, { steps: 4 });
    await page.mouse.up();
    expect(await events(page)).toEqual([]);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });

  test('mouse hover shows a hint with the note name and clears on leave', async ({ page }) => {
    const box = await boxOf(page.locator('.cell[data-string="2"][data-fret="1"]'));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const hint = page.locator('.hover-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('C');
    await page.mouse.move(5, 5);
    await expect(hint).toHaveCount(0);
  });
});

test.describe('US4: scrolling and fill-container', () => {
  const scrollerOf = (page: Page) => page.locator('.fretboard .scroller');
  const maxScroll = (page: Page) =>
    scrollerOf(page).evaluate((el) => el.scrollWidth - el.clientWidth);

  test('highlight-far auto-scrolls once to the minimal position', async ({ page }) => {
    // The board only overflows in a narrow viewport (zoomed-in desktop).
    await page.setViewportSize({ width: 640, height: 400 });
    await page.addInitScript(() => {
      globalThis.__fmFretboardFixture = 'highlight-far';
    });
    await page.goto('/notes');
    await expandDetails(page);
    const scroller = scrollerOf(page);
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    // Settle, then check the highlighted span is fully inside the viewport.
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      const q = (sel: string) => {
        const e = document.querySelector(sel);
        if (!e) throw new Error(sel);
        return e;
      };
      const s = q('.fretboard .scroller').getBoundingClientRect();
      const cells = [15, 16, 17].map((f) =>
        q(`.cell[data-string="6"][data-fret="${f}"]`).getBoundingClientRect()
      );
      return {
        left: Math.min(...cells.map((c) => c.left)) - s.left,
        right: s.right - Math.max(...cells.map((c) => c.right))
      };
    });
    expect(result.left).toBeGreaterThanOrEqual(-1);
    expect(result.right).toBeGreaterThanOrEqual(-1);
    // Minimal scroll: the last highlighted column ends at the viewport edge (within a pixel).
    expect(Math.min(result.left, result.right)).toBeLessThan(2);
  });

  test('highlight-split aligns the lowest highlighted fret to the start', async ({ page }) => {
    // The board only overflows in a narrow viewport (zoomed-in desktop).
    await page.setViewportSize({ width: 640, height: 400 });
    await page.addInitScript(() => {
      globalThis.__fmFretboardFixture = 'highlight-split';
    });
    await page.goto('/notes');
    await expandDetails(page);
    const scroller = scrollerOf(page);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const q = (sel: string) => {
            const e = document.querySelector(sel);
            if (!e) throw new Error(sel);
            return e;
          };
          const s = q('.fretboard .scroller').getBoundingClientRect();
          const c = q('.cell[data-string="6"][data-fret="2"]').getBoundingClientRect();
          return Math.abs(c.left - s.left);
        })
      )
      .toBeLessThan(2);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });

  test('reduced motion reaches the target in the first frame', async ({ page }) => {
    // The board only overflows in a narrow viewport (zoomed-in desktop).
    await page.setViewportSize({ width: 640, height: 400 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      globalThis.__fmFretboardFixture = 'highlight-far';
    });
    await page.goto('/notes');
    await expandDetails(page);
    const scroller = scrollerOf(page);
    // Expected target = last highlighted column end − viewport width, clamped.
    const settled = await page.evaluate(
      () =>
        new Promise<{ first: number; later: number }>((resolve) => {
          const el = document.querySelector('.fretboard .scroller') as HTMLElement;
          requestAnimationFrame(() => {
            const first = el.scrollLeft;
            setTimeout(() => resolve({ first, later: el.scrollLeft }), 400);
          });
        })
    );
    expect(settled.first).toBeGreaterThan(0);
    expect(settled.first).toBe(settled.later);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(settled.later);
  });

  test('at 2560 px the board fills zone C and does not scroll (US4-5)', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 900 });
    await page.goto('/notes');
    await expandDetails(page);
    const scroller = scrollerOf(page);
    await expect(scroller).toBeVisible();
    const dims = await scroller.evaluate((el) => {
      const svg = el.querySelector('svg');
      if (!svg) throw new Error('no svg');
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        svgWidth: svg.getBoundingClientRect().width
      };
    });
    expect(dims.scrollWidth).toBe(dims.clientWidth);
    expect(Math.abs(dims.svgWidth - dims.clientWidth)).toBeLessThanOrEqual(1);
    expect(await maxScroll(page)).toBe(0);
  });
});

const cellAt = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);
const focusedPos = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return `${a?.getAttribute('data-string')}:${a?.getAttribute('data-fret')}`;
  });

test.describe('keyboard operation (US5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmFretboardEvents = [];
    });
    await page.goto('/notes');
    await expandDetails(page);
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  test('Tab from the h1 lands on string 1 open', async ({ page }) => {
    await page.locator('h1').evaluate((el) => {
      el.setAttribute('tabindex', '-1');
      (el as HTMLElement).focus();
    });
    // Tab until the board; the roving stop is the only cell in the tab order.
    for (let i = 0; i < 30 && (await focusedPos(page)) !== '1:0'; i++)
      await page.keyboard.press('Tab');
    expect(await focusedPos(page)).toBe('1:0');
  });

  test('arrows move focus, edges stay put, no events from arrows', async ({ page }) => {
    await cellAt(page, 3, 5).focus();
    for (const [key, expected] of [
      ['ArrowRight', '3:6'],
      ['ArrowLeft', '3:5'],
      ['ArrowUp', '2:5'],
      ['ArrowDown', '3:5']
    ] as const) {
      await page.keyboard.press(key);
      expect(await focusedPos(page)).toBe(expected);
    }
    await cellAt(page, 1, 0).focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    expect(await focusedPos(page)).toBe('1:0');
    await cellAt(page, 6, 22).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    expect(await focusedPos(page)).toBe('6:22');
    expect(await page.evaluate(() => globalThis.__fmFretboardEvents)).toEqual([]);
  });

  test('Enter and Space emit events', async ({ page }) => {
    await cellAt(page, 2, 3).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(await page.evaluate(() => globalThis.__fmFretboardEvents)).toEqual([
      { string: 2, fret: 3 },
      { string: 2, fret: 3 }
    ]);
  });

  test('focus ring is visible on an unmarked cell, within 100 ms (SC-007)', async ({ page }) => {
    await cellAt(page, 4, 2).focus();
    const ring = page.locator('.focus-ring-outer');
    await expect(ring).toBeVisible();
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const w = window as unknown as { __t0?: number; __ms?: number };
        w.__ms = undefined;
        document.addEventListener(
          'keydown',
          () => {
            w.__t0 = performance.now();
            const before = document.querySelector('.focus-ring')?.getAttribute('x');
            const tick = () => {
              const now = document.querySelector('.focus-ring')?.getAttribute('x');
              if (now !== before) w.__ms = performance.now() - (w.__t0 ?? 0);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          },
          { capture: true, once: true }
        );
      });
      await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
      await page.waitForFunction(() => (window as unknown as { __ms?: number }).__ms !== undefined);
      times.push(await page.evaluate(() => (window as unknown as { __ms: number }).__ms));
    }
    times.sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(100);
  });

  test('keyboard focus on an off-screen cell scrolls it into view', async ({ page }) => {
    // The board only overflows in a narrow viewport (zoomed-in desktop).
    await page.setViewportSize({ width: 640, height: 400 });
    await cellAt(page, 1, 0).focus();
    for (let i = 0; i < 22; i++) await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => {
        const c = await cellAt(page, 1, 22).boundingBox();
        const s = await page.locator('.fretboard .scroller').boundingBox();
        return !!c && !!s && c.x >= s.x - 1 && c.x + c.width <= s.x + s.width + 1;
      })
      .toBe(true);
  });

  test('toggle shows the description text', async ({ page }) => {
    await withFixture(page, 'empty'); // blank board: the empty description
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    const toggle = page.getByRole('button', { name: 'Describe this view' });
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Describe this view' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    const description = page.locator('p.description');
    await expect(description).toBeVisible();
    await expect(description).toHaveText('Nothing is displayed.');
  });
});

test.describe('accessibility and responsive (US5)', () => {
  for (const path of ['/notes', '/triads', '/']) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`axe clean on ${path} in ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        if (path !== '/') {
          await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
          await page.getByRole('button', { name: 'Describe this view' }).click();
        }
        await runAxe(page);
      });
    }
  }

  test('width sweep 320–2560 and 200% zoom: only .scroller scrolls', async ({ page }) => {
    for (const width of [320, 360, 768, 1280, 2560]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/notes');
      await expandDetails(page);
      await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
      await expectNoHorizontalScroll(page);
    }
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/notes');
    await expandDetails(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'; // CSSOM: allowed under the style-src CSP
      window.dispatchEvent(new Event('resize'));
    });
    await expectNoHorizontalScroll(page);
  });
});

// US5 / Q18: seven strings × 24 frets stay legible and reachable.
test.describe('seven-string fretboard (US5, Q18)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('__seeded7') === null) {
        localStorage.setItem(
          'fretboard-master:prefs',
          JSON.stringify({ version: 1, tuning: 'AF-21', strings: 7, frets: 24 })
        );
        localStorage.setItem('__seeded7', '1');
      }
    });
    await page.goto('/notes');
    await expandDetails(page);
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  test('ArrowDown from string 6 reaches string 7 and it is announced', async ({ page }) => {
    const grid = page.getByRole('grid', { name: 'Fretboard' });
    await expect(grid.getByRole('row')).toHaveCount(7);
    await grid.locator('.cell[data-string="6"][data-fret="0"]').focus();
    await page.keyboard.press('ArrowDown');
    const focused = page.locator('.cell:focus');
    await expect(focused).toHaveAttribute('data-string', '7');
    await expect(focused).toHaveAccessibleName(/^B, string 7, open/);
    await expect(grid.locator('.string-label').last()).toHaveText('7 B');
  });

  test('string 7 is the thickest line, drawn from the token', async ({ page }) => {
    const width = (n: number) =>
      page
        .locator(`.string-${n}`)
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth));
    expect(await width(7)).toBeGreaterThan(await width(6));
    expect(await width(7)).toBeCloseTo(6, 0); // 0.375rem at 16px
  });

  test('cells keep 44×44 px targets at 1280 and at 320 px with 24 frets', async ({ page }) => {
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/notes');
      await expandDetails(page);
      await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
      const box = await page.locator('.cell[data-string="7"][data-fret="1"]').boundingBox();
      if (!box) throw new Error('missing box');
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.height).toBeGreaterThanOrEqual(43.5);
      await expectNoHorizontalScroll(page);
    }
  });

  test('root markers on neighbouring strings at the same fret do not intersect', async ({
    page
  }) => {
    await page
      .getByRole('radiogroup', { name: 'Show' })
      .getByRole('radio', { name: 'All notes' })
      .click();
    const grid = page.getByRole('grid', { name: 'Fretboard' });
    const box = async (key: string) => {
      const b = await grid.locator(`.marker[data-key="${key}"]`).boundingBox();
      if (!b) throw new Error(`missing marker ${key}`);
      return b;
    };
    for (const fret of [0, 1, 5, 12, 24]) {
      const a = await box(`6:${fret}`);
      const b = await box(`7:${fret}`);
      const overlap =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, `fret ${fret}`).toBe(false);
    }
  });

  test('axe clean with the seven-string board', async ({ page }) => {
    await runAxe(page);
  });
});
