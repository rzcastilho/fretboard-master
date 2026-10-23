import { expect, test, type Locator, type Page } from '@playwright/test';

import { expandDetails, expectNoHorizontalScroll, readAudioLog, runAxe } from './support/helpers';

const ADJUSTED = 'We adjusted the view to the new instrument';

const openPanel = async (page: Page) => {
  await page
    .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Instrument' });
  await expect(dialog).toBeVisible();
  return dialog;
};

const confirm = async (page: Page) => {
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('dialog', { name: 'Instrument' })).toBeHidden();
};

/** Home → panel → Left-handed → Confirm. State is in memory: navigate by links, not reloads. */
const goLeftHanded = async (page: Page) => {
  await page.goto('/');
  const dialog = await openPanel(page);
  await dialog.getByRole('radio', { name: 'Left-handed' }).check();
  await confirm(page);
};

const openNotes = async (page: Page) => {
  await page
    .getByRole('list')
    .getByRole('link', { name: /^(Continue: )?Fretboard Notes/ })
    .click();
  await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  // The narrow arrangement folds the context panel (region presets) behind "Show details".
  await expandDetails(page);
};

const openTriads = async (page: Page) => {
  await page
    .getByRole('list')
    .getByRole('link', { name: /^(Continue: )?Triads/ })
    .click();
  await expect(page.getByRole('region', { name: 'Fretboard' })).toBeVisible();
};

const x = async (loc: Locator) => {
  const box = await loc.boundingBox();
  if (!box) throw new Error('no bounding box');
  return box.x + box.width / 2;
};

const cell = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);

const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.getAttribute('data-string')}:${el.getAttribute('data-fret')}` : null;
  });

test.describe('left-handed: mirrored fretboard (US1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmFretboardEvents = [];
    });
  });

  test('Q1/US1-1: labels rightmost, nut right of fret 1, numbers increase leftward, summary', async ({
    page
  }) => {
    await goLeftHanded(page);
    await expect(
      page.getByRole('button', { name: '6 strings · standard tuning · left-handed' })
    ).toBeVisible();
    await openNotes(page);
    const label = await x(page.locator('.string-label').first());
    const nut = await x(page.locator('.nut'));
    expect(label).toBeGreaterThan(nut);
    expect(nut).toBeGreaterThan(await x(cell(page, 1, 1)));
    expect(await x(cell(page, 1, 0))).toBeGreaterThan(nut);
    const nums = page.locator('.fret-number');
    expect(await x(nums.nth(0))).toBeGreaterThan(await x(nums.nth(1)));
    expect(await x(nums.nth(1))).toBeGreaterThan(await x(nums.nth(2)));
  });

  test('Q2/US1-2 + Q6/US1-6: Triads Full neck tags run right → left, tags above or below as before', async ({
    page
  }) => {
    await goLeftHanded(page);
    await openTriads(page);
    await page
      .getByRole('group', { name: 'Root' })
      .getByRole('button', { name: 'A', exact: true })
      .click();
    await page.getByRole('radio', { name: 'Full neck' }).click();
    const tags = page.getByRole('group', { name: 'Shapes' }).getByRole('button');
    await expect(tags).toHaveCount(6);
    // Root → 1st → 2nd of the first chain are consecutive tags.
    const xs = [await x(tags.nth(0)), await x(tags.nth(1)), await x(tags.nth(2))];
    expect(xs[0]).toBeGreaterThan(xs[1]);
    expect(xs[1]).toBeGreaterThan(xs[2]);
    // highest on top: fret numbers below the board, tags above it.
    const board = page.locator('.fretboard svg[role="grid"]');
    const boardBox = await board.boundingBox();
    const tagBox = await tags.first().boundingBox();
    const numBox = await page.locator('.fret-number').first().boundingBox();
    if (!boardBox || !tagBox || !numBox) throw new Error('no boxes');
    expect(tagBox.y + tagBox.height).toBeLessThanOrEqual(boardBox.y + 1);
    expect(numBox.y).toBeGreaterThan(boardBox.y + boardBox.height / 2);
  });

  test('Q3/US1-3: comparison arrows point the mirrored way', async ({ page }) => {
    await goLeftHanded(page);
    await openTriads(page);
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    const arrow = page.locator('g.arrows .arrow').first();
    await expect(arrow).toBeVisible();
    const line = arrow.locator('line');
    const dx = Number(await line.getAttribute('x2')) - Number(await line.getAttribute('x1'));
    // major → minor lowers the third by one fret: toward the nut, i.e. rightward when mirrored.
    expect(dx).toBeGreaterThan(0);
    await expect(arrow.locator('text')).toContainText(/fret/i);
  });

  test('Q4/US1-4: a region band covers the mirrored frets', async ({ page }) => {
    await goLeftHanded(page);
    await openNotes(page);
    await page.getByRole('button', { name: '5–9' }).first().click();
    await expect(page.locator('rect.region-band')).toHaveCount(1);
    // The band click may auto-scroll the board: read every box in one frame.
    const { b, c5, c9 } = await page.evaluate(() => {
      const box = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`missing ${sel}`);
        return el.getBoundingClientRect();
      };
      const mid = (sel: string) => {
        const r = box(sel);
        return r.left + r.width / 2;
      };
      const r = box('rect.region-band');
      return {
        b: { x: r.left, width: r.width },
        c5: mid('.cell[data-string="1"][data-fret="5"]'),
        c9: mid('.cell[data-string="1"][data-fret="9"]')
      };
    });
    expect(c9).toBeLessThan(c5);
    expect(b.x).toBeLessThanOrEqual(c9);
    expect(b.x + b.width).toBeGreaterThanOrEqual(c5);
  });

  test('Q5/US1-5: ArrowLeft moves to the next fret, ArrowRight to the previous', async ({
    page
  }) => {
    await goLeftHanded(page);
    await openNotes(page);
    await cell(page, 3, 5).focus();
    await page.keyboard.press('ArrowLeft');
    expect(await focused(page)).toBe('3:6');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await focused(page)).toBe('3:4');
  });

  test('Q7/US1-7: tapping string 3 fret 5 reports 3:5 and plays the same pitch in both hands', async ({
    page
  }) => {
    await page.goto('/');
    await openNotes(page);
    await cell(page, 3, 5).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBe(1);
    const pitchOf = async () => {
      const step = (await readAudioLog(page)).filter((e) => e.type === 'step').at(-1);
      if (step?.type !== 'step') throw new Error('no step');
      return step.pitches;
    };
    const rightPitch = await pitchOf();
    const events = () => page.evaluate(() => globalThis.__fmFretboardEvents);
    expect(await events()).toContainEqual({ string: 3, fret: 5 });

    await openPanel(page);
    await page.getByRole('radio', { name: 'Left-handed' }).check();
    await confirm(page);
    await page.evaluate(() => {
      globalThis.__fmFretboardEvents = [];
    });
    await cell(page, 3, 5).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBe(2);
    expect(await pitchOf()).toEqual(rightPitch);
    expect(await events()).toEqual([{ string: 3, fret: 5 }]);
  });

  test('Q8/US1-8: preview mirrors while open; board stays right-handed after Close', async ({
    page
  }) => {
    await page.goto('/');
    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: 'Left-handed' }).check();
    const preview = dialog.locator('svg.fretboard-preview');
    const label = await x(preview.locator('.string-label').first());
    const nut = await x(preview.locator('.nut'));
    expect(label).toBeGreaterThan(nut);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog', { name: 'Instrument' })).toBeHidden();
    await expect(
      page.getByRole('button', { name: '6 strings · standard tuning · right-handed' })
    ).toBeVisible();
    await openNotes(page);
    expect(await x(page.locator('.string-label').first())).toBeLessThan(
      await x(page.locator('.nut'))
    );
  });

  test('Q22: switching handedness mid-neck keeps the same frets in view, without animation', async ({
    page
  }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await page.goto('/');
    await openNotes(page);
    const scroller = page.locator('.fretboard .scroller');
    await scroller.evaluate((el) => el.scrollTo({ left: 300, behavior: 'instant' }));
    const visibleFret = async () =>
      page.evaluate(() => {
        const s = document.querySelector('.fretboard .scroller') as HTMLElement;
        const r = s.getBoundingClientRect();
        const mid = r.left + r.width / 2;
        let best = -1;
        let dist = Infinity;
        for (const c of document.querySelectorAll('.cell[data-string="1"]')) {
          const b = c.getBoundingClientRect();
          const d = Math.abs(b.left + b.width / 2 - mid);
          if (d < dist) {
            dist = d;
            best = Number(c.getAttribute('data-fret'));
          }
        }
        return best;
      });
    const before = await visibleFret();
    // Switch in place from the tool's Instrument button: the board stays mounted.
    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: 'Left-handed' }).check();
    await confirm(page);
    const after = await visibleFret();
    expect(Math.abs(after - before)).toBeLessThanOrEqual(3);
  });

  test('Q23/FR-017: a presentation-only change raises no notice and does not stop sound', async ({
    page
  }) => {
    await page.goto('/');
    await openTriads(page);
    const before = await page.locator('.fretboard .marker').count();
    await openPanel(page);
    await page.getByRole('radio', { name: 'Left-handed' }).check();
    await confirm(page);
    await expect(page.getByText(ADJUSTED)).toHaveCount(0);
    await expect(page.locator('.fretboard .marker')).toHaveCount(before);
    const log = await readAudioLog(page);
    expect(log.some((e) => e.type === 'stop')).toBe(false);
  });

  test('Q25/FR-015: every home tool-card thumbnail has its nut on the right', async ({ page }) => {
    await goLeftHanded(page);
    const thumbs = page.locator('svg.fretboard-thumbnail');
    const count = await thumbs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const t = thumbs.nth(i);
      // Label column outermost on the right: the nut sits to its left, fret 1 further left.
      expect(await x(t.locator('.string-label').first())).toBeGreaterThan(
        await x(t.locator('.nut'))
      );
    }
  });
});

const y = async (loc: Locator) => {
  const box = await loc.boundingBox();
  if (!box) throw new Error('no bounding box');
  return box.y + box.height / 2;
};

/** Open the panel, choose "Lowest string on top" (optionally a string count) and confirm. */
const goLowestTop = async (page: Page, strings?: 6 | 7) => {
  const dialog = await openPanel(page);
  if (strings) await dialog.getByRole('radio', { name: `${strings} strings` }).check();
  await dialog.getByRole('radio', { name: 'Lowest string on top' }).check();
  await confirm(page);
};

test.describe('lowest string on top (US2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmFretboardEvents = [];
    });
  });

  test('Q9/US2-1/2: string 6 on top; tapping it at fret 0 plays the low E and reports 6:0', async ({
    page
  }) => {
    await page.goto('/');
    await openNotes(page);
    await cell(page, 6, 0).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBe(1);
    const pitchOf = async () => {
      const step = (await readAudioLog(page)).filter((e) => e.type === 'step').at(-1);
      if (step?.type !== 'step') throw new Error('no step');
      return step.pitches;
    };
    const lowE = await pitchOf();

    await openPanel(page);
    await page.getByRole('radio', { name: 'Lowest string on top' }).check();
    await confirm(page);
    await page.evaluate(() => {
      globalThis.__fmFretboardEvents = [];
    });

    expect(await y(cell(page, 6, 0))).toBeLessThan(await y(cell(page, 1, 0)));
    const labels = page.locator('.string-label');
    await expect(labels.first()).toContainText(/^6 /);
    await expect(labels.last()).toContainText(/^1 /);

    // Top row of the board is string 6.
    const top = await y(cell(page, 6, 0));
    for (let s = 1; s <= 5; s++) expect(await y(cell(page, s, 0))).toBeGreaterThan(top);
    await cell(page, 6, 0).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBe(2);
    expect(await pitchOf()).toEqual(lowE);
    expect(await page.evaluate(() => globalThis.__fmFretboardEvents)).toEqual([
      { string: 6, fret: 0 }
    ]);
  });

  test('Q10/US2-3: seven strings with lowest on top draw string 7 first', async ({ page }) => {
    await page.goto('/');
    await goLowestTop(page, 7);
    await openNotes(page);
    await expect(page.locator('.string-label').first()).toContainText(/^7 /);
    expect(await y(cell(page, 7, 0))).toBeLessThan(await y(cell(page, 6, 0)));
    expect(await y(cell(page, 2, 0))).toBeLessThan(await y(cell(page, 1, 0)));
  });

  test('Q11/US2-5: Triads Full neck puts fret numbers above the board and tags below', async ({
    page
  }) => {
    await page.goto('/');
    await goLowestTop(page);
    await openTriads(page);
    await page
      .getByRole('group', { name: 'Root' })
      .getByRole('button', { name: 'A', exact: true })
      .click();
    await page.getByRole('radio', { name: 'Full neck' }).click();
    const tags = page.getByRole('group', { name: 'Shapes' }).getByRole('button');
    await expect(tags).toHaveCount(6);
    const board = await page.locator('.fretboard svg[role="grid"]').boundingBox();
    const tagBox = await tags.first().boundingBox();
    const numBox = await page.locator('.fret-number').first().boundingBox();
    if (!board || !tagBox || !numBox) throw new Error('no boxes');
    expect(numBox.y).toBeLessThan(board.y + board.height / 2);
    expect(tagBox.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
  });

  test('Q12/US2-6: with lowest on top, ArrowUp from string 5 focuses string 6', async ({
    page
  }) => {
    await page.goto('/');
    await goLowestTop(page);
    await openNotes(page);
    await cell(page, 5, 0).focus();
    expect(await focused(page)).toBe('5:0');
    await page.keyboard.press('ArrowUp');
    expect(await focused(page)).toBe('6:0');
  });
});

test.describe('screen reader parity (US3)', () => {
  const COMBOS = [
    { hand: 'Right-handed', top: 'Highest string on top' },
    { hand: 'Left-handed', top: 'Highest string on top' },
    { hand: 'Right-handed', top: 'Lowest string on top' },
    { hand: 'Left-handed', top: 'Lowest string on top' }
  ];
  const gridNames = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('[role="gridcell"]')]
        .map(
          (el) =>
            `${el.getAttribute('data-string')}:${el.getAttribute('data-fret')}=${el.getAttribute('aria-label')}`
        )
        .sort()
    );

  test('Q13/US3-1: same names, nut-first focus order, no left/right wording, axe clean in all four combinations', async ({
    page
  }) => {
    let expected: string[] | null = null;
    for (const { hand, top } of COMBOS) {
      await page.goto('/');
      const dialog = await openPanel(page);
      await dialog.getByRole('radio', { name: hand }).check();
      await dialog.getByRole('radio', { name: top }).check();
      await confirm(page);
      await openNotes(page);

      const names = await gridNames(page);
      expected ??= names;
      expect(names, `${hand} / ${top}`).toEqual(expected);
      for (const n of names) expect(n).not.toMatch(/\b(left|right)\b/i);

      // DOM order within a row is fret 0 → N whatever the drawing direction.
      const frets = await page.evaluate(() =>
        [...document.querySelectorAll('[role="row"]')[0].querySelectorAll('[role="gridcell"]')].map(
          (c) => Number(c.getAttribute('data-fret'))
        )
      );
      expect(frets).toEqual([...frets].sort((a, b) => a - b));

      // Arrow navigation announces the next fret's name, and focus is visible.
      await cell(page, 1, 0).focus();
      await page.keyboard.press(hand === 'Left-handed' ? 'ArrowLeft' : 'ArrowRight');
      expect(await focused(page)).toBe('1:1');
      await expect(page.locator('.focus-ring-outer')).toBeVisible();
      const label = await cell(page, 1, 1).getAttribute('aria-label');
      expect(label).toMatch(/^F, string 1, fret 1\b/);

      await runAxe(page);
    }
  });
});

const COMBOS_US5 = [
  { hand: 'Right-handed', top: 'Highest string on top' },
  { hand: 'Left-handed', top: 'Highest string on top' },
  { hand: 'Right-handed', top: 'Lowest string on top' },
  { hand: 'Left-handed', top: 'Lowest string on top' }
];

const setCombo = async (page: Page, hand: string, top: string) => {
  const dialog = await openPanel(page);
  await dialog.getByRole('radio', { name: hand }).check();
  await dialog.getByRole('radio', { name: top }).check();
  await confirm(page);
};

test.describe('every screen and instrument (US5)', () => {
  const WIDTHS = [320, 360, 768, 2560];

  for (const width of WIDTHS) {
    test(`Q20/Q24 @ ${width}px: only the board scrolls, targets ≥ 44 px, axe clean, nut in view`, async ({
      page
    }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const { hand, top } of COMBOS_US5) {
        await page.goto('/');
        const dialog = await openPanel(page);
        await dialog.getByRole('radio', { name: hand }).check();
        await dialog.getByRole('radio', { name: top }).check();
        await dialog.getByRole('radio', { name: '7 strings' }).check();
        await confirm(page);
        await openNotes(page);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow, `${hand} / ${top} @ ${width}`).toBeLessThanOrEqual(0);

        // Unscrolled: the nut side is in view, so open column and fret 1 are inside the scroller.
        const inView = await page.evaluate(() => {
          const s = document.querySelector('.fretboard .scroller') as HTMLElement;
          const r = s.getBoundingClientRect();
          return [0, 1].map((f) => {
            const el = document.querySelector(`.cell[data-string="1"][data-fret="${f}"]`);
            if (!el) return false;
            const b = el.getBoundingClientRect();
            return b.left >= r.left - 1 && b.right <= r.right + 1;
          });
        });
        expect(inView, `${hand} / ${top} @ ${width}`).toEqual([true, true]);

        const small = await page.evaluate(
          () =>
            [...document.querySelectorAll<HTMLElement>('.cell')]
              .slice(0, 30)
              .map((el) => el.getBoundingClientRect())
              .filter((b) => b.width < 43.5 || b.height < 43.5).length
        );
        expect(small).toBe(0);

        await runAxe(page);
      }
    });
  }

  test('Q21: changing frets 22 ↔ 24 left-handed keeps the nut side in view', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/');
    await setCombo(page, 'Left-handed', 'Highest string on top');
    await openNotes(page);
    const edge = () =>
      page.evaluate(() => {
        const s = document.querySelector('.fretboard .scroller') as HTMLElement;
        return Math.round(s.scrollWidth - s.clientWidth - s.scrollLeft);
      });
    expect(await edge()).toBeLessThanOrEqual(1);
    await page.goBack();
    const dialog = await openPanel(page);
    const more = dialog.getByRole('button', { name: 'More frets' });
    await more.click();
    await more.click();
    await confirm(page);
    await openNotes(page);
    expect(await edge()).toBeLessThanOrEqual(1);
  });

  test('Q24: 200 % text zoom at 320 px wraps the new radio groups without clipping', async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    const dialog = await openPanel(page);
    for (const group of ['Handedness', 'Strings on top']) {
      const fieldset = dialog
        .getByRole('radiogroup', { name: group })
        .or(dialog.getByRole('group', { name: group }));
      await expect(fieldset.first()).toBeVisible();
    }
    const problems = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('dialog label, dialog legend')) {
        const b = el.getBoundingClientRect();
        if (el.scrollWidth > el.clientWidth + 1) bad.push(`clipped: ${el.textContent?.trim()}`);
        if (b.right > window.innerWidth + 1) bad.push(`overflow: ${el.textContent?.trim()}`);
      }
      return bad;
    });
    expect(problems).toEqual([]);
    for (const name of [
      'Right-handed',
      'Left-handed',
      'Highest string on top',
      'Lowest string on top'
    ]) {
      const box = await dialog
        .getByRole('radio', { name })
        .locator('xpath=ancestor::label[1]')
        .boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    await expectNoHorizontalScroll(page);
  });

  test('Q26/US5-4: major → minor moves only the third in all four combinations', async ({
    page
  }) => {
    for (const { hand, top } of COMBOS_US5) {
      await page.goto('/');
      await setCombo(page, hand, top);
      await openTriads(page);
      const markers = page.locator('.fretboard .marker:not(.comparison)');
      await expect(markers).toHaveCount(3);
      // Tag each DOM node and record its transform.
      const snapshot = () =>
        page.evaluate(() =>
          Object.fromEntries(
            [...document.querySelectorAll<HTMLElement>('.fretboard .marker')].map((el) => [
              el.getAttribute('data-key'),
              el.style.transform || el.getAttribute('transform')
            ])
          )
        );
      await page.evaluate(() => {
        document.querySelectorAll('.fretboard .marker').forEach((el, i) => {
          (el as unknown as { __n: number }).__n = i;
        });
      });
      const before = await snapshot();
      const t0 = Date.now();
      await page
        .getByRole('radiogroup', { name: 'Quality' })
        .getByRole('radio', { name: 'minor' })
        .check();
      await expect(page.locator('.fretboard .marker[data-key="2:4"]')).toHaveCount(1);
      expect(Date.now() - t0).toBeLessThan(2000);
      const after = await snapshot();
      const tagged = await page.evaluate(() =>
        Object.fromEntries(
          [...document.querySelectorAll('.fretboard .marker')].map((el) => [
            el.getAttribute('data-key'),
            (el as unknown as { __n?: number }).__n ?? null
          ])
        )
      );
      const keys = Object.keys(after);
      const unchanged = keys.filter((k) => k in before && before[k] === after[k]);
      const moved = keys.filter((k) => !(k in before));
      expect(moved, `${hand} / ${top}`).toEqual(['2:4']);
      expect(unchanged).toHaveLength(2);
      // Root and fifth keep their DOM node; the third's node is reused (tagged), not recreated.
      for (const k of keys) expect(tagged[k], `${k} reused`).not.toBeNull();
    }
  });
});
