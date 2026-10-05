import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe } from './support/helpers';

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const layers = (page: Page) => page.getByRole('group', { name: 'Layers' });
const layerSwitch = (page: Page, name: string) =>
  layers(page).getByRole('switch', { name, exact: true });
const shape = (page: Page, name: string) =>
  page.getByRole('radiogroup', { name: 'Shape' }).getByRole('radio', { name, exact: true });
const live = (page: Page) => board(page).locator('[aria-live="polite"]');

test.describe('caged layers US2: layer switches double as the legend', () => {
  test('US2-1: four rows, Chord on and disabled, the rest off and enabled', async ({ page }) => {
    await page.goto('/caged');
    await expect(layers(page).getByRole('switch')).toHaveText([
      /Chord\s*On/,
      /Arpeggio\s*Off/,
      /Pentatonic\s*Off/,
      /Scale\s*Off/
    ]);
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'true');
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-disabled', 'true');
    await expect(layerSwitch(page, 'Chord')).toHaveAccessibleDescription(
      'At least one layer stays on.'
    );
    for (const name of ['Arpeggio', 'Pentatonic', 'Scale'])
      await expect(layerSwitch(page, name)).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('US2-2: toggling follows the base-layer rule', async ({ page }) => {
    await page.goto('/caged');
    await layerSwitch(page, 'Arpeggio').click();
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-checked', 'true');
    await expect(layerSwitch(page, 'Chord')).not.toHaveAttribute('aria-disabled', 'true');
    await layerSwitch(page, 'Chord').click();
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'false');
    // Arpeggio is now the only layer: it stays on.
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-disabled', 'true');
    await layerSwitch(page, 'Arpeggio').click({ force: true });
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-checked', 'true');
  });

  test('US2-3: every row carries an aria-hidden 44x44 sample marker', async ({ page }) => {
    await page.goto('/caged');
    const rows = layers(page).getByRole('switch');
    await expect(rows).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const sample = rows.nth(i).locator('svg.marker-sample');
      await expect(sample).toHaveAttribute('aria-hidden', 'true');
      const box = await sample.boundingBox();
      expect(box?.width).toBeCloseTo(44, 0);
      expect(box?.height).toBeCloseTo(44, 0);
    }
    await expect(layerSwitch(page, 'Chord').locator('svg.marker-sample rect.glyph')).toHaveCount(1);
    await expect(layerSwitch(page, 'Arpeggio').locator('svg.layer-arpeggio')).toHaveCount(1);
    await expect(layerSwitch(page, 'Scale').locator('svg.marker-sample')).toHaveCount(1);
    await layerSwitch(page, 'Pentatonic').click();
    await layerSwitch(page, 'Scale').click();
    await expect(layerSwitch(page, 'Scale').locator('svg.marker-sample')).toHaveCount(2);
    await expect(layerSwitch(page, 'Scale').locator('circle.extra-dot')).toHaveCount(1);
  });

  test('US2-4: navigating away and back keeps the layers', async ({ page }) => {
    await page.goto('/caged');
    await layerSwitch(page, 'Arpeggio').click();
    const nav = page.getByRole('navigation', { name: 'Tools' });
    await nav.getByRole('link', { name: 'Triads' }).click();
    await expect(page).toHaveURL(/\/triads$/);
    await nav.getByRole('link', { name: 'CAGED' }).click();
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-checked', 'true');
  });

  test('US2-5: reload resets to Chord only and stores no layer data', async ({ page }) => {
    await page.goto('/caged');
    await layerSwitch(page, 'Arpeggio').click();
    await layerSwitch(page, 'Scale').click();
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored.toLowerCase()).not.toMatch(/arpeggio|pentatonic|scale|layers/);
    await page.reload();
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'true');
    for (const name of ['Arpeggio', 'Pentatonic', 'Scale'])
      await expect(layerSwitch(page, name)).toHaveAttribute('aria-checked', 'false');
  });

  test('US2-6: Reset tool returns the layers to Chord only', async ({ page }) => {
    await page.goto('/caged');
    await layerSwitch(page, 'Arpeggio').click();
    await layerSwitch(page, 'Pentatonic').click();
    await page.getByRole('button', { name: 'Reset tool' }).click();
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'true');
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-checked', 'false');
    await expect(layerSwitch(page, 'Pentatonic')).toHaveAttribute('aria-checked', 'false');
  });

  test('US2-7: See all restores Chord when nothing else is drawable, with an announcement', async ({
    page
  }) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    await layerSwitch(page, 'Scale').click();
    await layerSwitch(page, 'Chord').click();
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'false');
    await shape(page, 'See all').click();
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'true');
    await expect(layerSwitch(page, 'Scale')).toHaveAttribute('aria-checked', 'true');
    await expect(live(page)).toContainText('Chord layer on.');
  });

  test('switches announce their change politely', async ({ page }) => {
    await page.goto('/caged');
    await layerSwitch(page, 'Arpeggio').click();
    await expect(live(page)).toContainText('Arpeggio layer on.');
  });

  test('has no axe violations', async ({ page }) => {
    await page.goto('/caged');
    await runAxe(page);
  });
});

// US1: the scale inside the shape ---------------------------------------------------------------

/** Open pitch classes, string 1 → 6, standard tuning. */
const OPEN_PC = [4, 11, 7, 2, 9, 4];
const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const labelRadio = (page: Page, name: 'Intervals' | 'Note names') =>
  page.getByRole('radiogroup', { name: 'Labels' }).getByRole('radio', { name, exact: true });
const keyButton = (page: Page, pc: number) =>
  page.getByRole('group', { name: 'Key' }).getByRole('button').nth(pc);

interface Mark {
  key: string;
  classes: string;
  label: string;
  string: number;
  fret: number;
}
/** Every drawn marker with its classes and visible label. */
const marks = (page: Page): Promise<Mark[]> =>
  board(page)
    .locator('.marker')
    .evaluateAll((els) =>
      els.map((e) => {
        const key = e.getAttribute('data-key') ?? '';
        const [string, fret] = key.split(':').map(Number);
        return {
          key,
          classes: e.getAttribute('class') ?? '',
          label: e.querySelector('.marker-label')?.textContent ?? '',
          string,
          fret
        };
      })
    );
const live_ = (m: Mark[]) => m.filter((x) => !/\bdimmed\b/.test(x.classes));

/** TM-6.4: C major scale notes in frets 7–10 (the E shape's region), as `s:f`. */
const tm64 = (): string[] => {
  const out: string[] = [];
  OPEN_PC.forEach((open, i) => {
    for (let fret = 7; fret <= 10; fret++)
      if (C_MAJOR.has((open + fret) % 12)) out.push(`${i + 1}:${fret}`);
  });
  return out.sort();
};

test.describe('caged layers US1: see the scale inside the shape', () => {
  test('US1-1: C major, E in focus, Scale on, Interval labels match TM-6.4', async ({ page }) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    await layerSwitch(page, 'Scale').click();
    const shown = live_(await marks(page));
    expect(shown.map((x) => x.key).sort()).toEqual(tm64());
    const byKey = new Map(shown.map((x) => [x.key, x]));
    // Degrees: B s6 f7 = 7, C s6 f8 = R (chord root), F s5 f8 = 4, D s6 f10 = 2.
    expect(byKey.get('6:7')?.label).toBe('7');
    expect(byKey.get('6:7')?.classes).toMatch(/\bdegree\b/);
    expect(byKey.get('6:8')?.label).toBe('R');
    expect(byKey.get('6:8')?.classes).toMatch(/\broot\b/);
    expect(byKey.get('5:8')?.label).toBe('4');
    expect(byKey.get('6:10')?.label).toBe('2');
    // At most one marker per position.
    const keys = (await marks(page)).map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('US1-2: Name labels show the note names and persist across reload', async ({ page }) => {
    await page.goto('/caged');
    await expect(labelRadio(page, 'Intervals')).toBeChecked();
    await shape(page, 'E').click();
    await layerSwitch(page, 'Scale').click();
    await labelRadio(page, 'Note names').click();
    const byKey = new Map(live_(await marks(page)).map((x) => [x.key, x]));
    expect(byKey.get('6:7')?.label).toBe('B');
    expect(byKey.get('5:8')?.label).toBe('F');
    expect(byKey.get('6:8')?.label).toBe('C');
    const storedLabels = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('fretboard-master:prefs');
        return raw === null ? null : JSON.parse(raw).labels;
      });
    expect((await storedLabels())?.caged).toBe('name');
    await page.reload();
    await expect(labelRadio(page, 'Note names')).toBeChecked();
    await page.getByRole('button', { name: 'Reset tool' }).click();
    await expect(labelRadio(page, 'Note names')).toBeChecked();
    await labelRadio(page, 'Intervals').click();
    await expect.poll(async () => (await storedLabels())?.caged).toBeUndefined();
  });

  test('US1-3: 7 strings, string 7 repeats string 2 and has no chord marker', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-21';
    });
    await page.goto('/caged');
    await keyButton(page, 2).click();
    await shape(page, 'C').click();
    await layerSwitch(page, 'Scale').click();
    const all = live_(await marks(page));
    const s7 = all.filter((x) => x.string === 7);
    const s2 = all.filter((x) => x.string === 2);
    expect(s7.length).toBeGreaterThan(0);
    expect(s7.map((x) => x.fret).sort((a, b) => a - b)).toEqual(
      s2.map((x) => x.fret).sort((a, b) => a - b)
    );
    for (const x of s7) expect(x.classes).toMatch(/\bdegree\b/);
  });

  test('US1-4: 12 frets omit notes past the last fret with no notice', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-1-12';
    });
    await page.goto('/caged');
    const notices = page.locator('.notice');
    const before = await notices.count();
    await shape(page, 'G').click();
    await layerSwitch(page, 'Scale').click();
    for (const x of await marks(page)) expect(x.fret).toBeLessThanOrEqual(12);
    expect(await notices.count()).toBe(before);
  });

  test('US1-5: the open-position C shape draws nothing below the nut', async ({ page }) => {
    await page.goto('/caged');
    await shape(page, 'C').click();
    await layerSwitch(page, 'Scale').click();
    const all = await marks(page);
    expect(all.length).toBeGreaterThan(0);
    for (const x of all) expect(x.fret).toBeGreaterThanOrEqual(0);
    await expect(board(page).locator('.marker[data-key$=":0"]').first()).toBeAttached();
  });

  test('US1-6: under reduced motion every note is present in the first frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/caged');
    await shape(page, 'E').click();
    const before = live_(await marks(page)).length;
    await layerSwitch(page, 'Scale').click();
    // No waiting: the very next read already sees the full set.
    const after = live_(await marks(page));
    expect(after.length).toBeGreaterThan(before);
    expect(after.map((x) => x.key).sort()).toEqual(tm64());
    const opacities = await board(page)
      .locator('.marker:not(.dimmed)')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
    for (const o of opacities) expect(Number(o)).toBe(1);
  });

  test('the Labels group sits before Previous and Next shape', async ({ page }) => {
    await page.goto('/caged');
    const labels = page.getByRole('radiogroup', { name: 'Labels' });
    const prev = page.getByRole('button', { name: 'Previous shape' });
    const a = await labels.boundingBox();
    const b = await prev.boundingBox();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const [la, lb] = [a as { x: number; y: number }, b as { x: number; y: number }];
    expect(la.y < lb.y || (la.y === lb.y && la.x < lb.x)).toBe(true);
  });
});

// US3: arpeggio around the chord ----------------------------------------------------------------

test.describe('caged layers US3: arpeggio around the chord', () => {
  const triadMarks = (page: Page) =>
    board(page).locator('.marker.layer-arpeggio:is(.root, .third, .fifth)');

  test('US3-1 and quickstart 2: Arpeggio adds triad notes outside the chord, one marker per key', async ({
    page
  }) => {
    await page.goto('/caged');
    const before = await marks(page);
    await layerSwitch(page, 'Arpeggio').click();
    const after = await marks(page);
    expect(after.length).toBeGreaterThan(before.length);
    await expect(triadMarks(page).first()).toBeVisible();
    const keys = after.map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
    // Chord markers are not arpeggio-styled; added markers are.
    const beforeKeys = new Set(before.map((x) => x.key));
    for (const m of after) {
      const isArp = /\blayer-arpeggio\b/.test(m.classes);
      expect(isArp).toBe(!beforeKeys.has(m.key));
      expect(m.classes).toMatch(/\b(root|third|fifth)\b/);
    }
    await expect(layerSwitch(page, 'Chord')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('US3-1: arpeggio markers are smaller and lighter than chord markers', async ({ page }) => {
    await page.goto('/caged');
    await layerSwitch(page, 'Arpeggio').click();
    const arp = board(page).locator('.marker.layer-arpeggio .shape').first();
    const chord = board(page).locator('.marker:not(.layer-arpeggio) .shape').first();
    const opacity = (l: typeof arp) => l.evaluate((e) => Number(getComputedStyle(e).opacity));
    expect(await opacity(arp)).toBeLessThan(await opacity(chord));
    const scale = (l: typeof arp) =>
      l.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
    expect(await scale(arp)).toBeLessThan(await scale(chord));
  });

  test('US3-2: A minor arpeggio shows R, b3 and 5 only', async ({ page }) => {
    await page.goto('/caged');
    await keyButton(page, 9).click();
    await page
      .getByRole('radiogroup', { name: 'Quality' })
      .getByRole('radio', { name: /minor/i })
      .click();
    await layerSwitch(page, 'Arpeggio').click();
    const labelsShown = new Set((await marks(page)).map((x) => x.label));
    expect([...labelsShown].sort()).toEqual(['R', '5', '♭3'].sort());
  });

  test('US3-3: with a shape in focus arpeggio notes stay in its region', async ({ page }) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    await layerSwitch(page, 'Arpeggio').click();
    const frets = (await marks(page))
      .filter((x) => /\blayer-arpeggio\b/.test(x.classes))
      .map((x) => x.fret);
    expect(frets.length).toBeGreaterThan(0);
    for (const f of frets) {
      expect(f).toBeGreaterThanOrEqual(7);
      expect(f).toBeLessThanOrEqual(10);
    }
  });

  test('US3-4 and quickstart 3: Chord off draws chord positions as arpeggio', async ({ page }) => {
    await page.goto('/caged');
    const chordKeys = (await marks(page)).map((x) => x.key);
    await layerSwitch(page, 'Arpeggio').click();
    await layerSwitch(page, 'Chord').click();
    const after = await marks(page);
    expect(after.every((x) => /\blayer-arpeggio\b/.test(x.classes))).toBe(true);
    expect(after.some((x) => /\bdimmed\b/.test(x.classes))).toBe(false);
    const keys = after.map((x) => x.key);
    for (const k of chordKeys) expect(keys).toContain(k);
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-disabled', 'true');
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAccessibleDescription(
      'At least one layer stays on.'
    );
  });
});

// US4: the pentatonic box around the chord ------------------------------------------------------

test.describe('caged layers US4: pentatonic box around the chord', () => {
  const minorA = async (page: Page) => {
    await page.goto('/caged');
    await keyButton(page, 9).click();
    await page
      .getByRole('radiogroup', { name: 'Quality' })
      .getByRole('radio', { name: /minor/i })
      .click();
  };
  /** Fret span per string (6 → 1) of the markers that are not dimmed. */
  const spans = (m: Mark[]) =>
    [6, 5, 4, 3, 2, 1].map((s) => {
      const frets = live_(m)
        .filter((x) => x.string === s)
        .map((x) => x.fret);
      return `${Math.min(...frets)}-${Math.max(...frets)}`;
    });

  test('US4-1 and quickstart 10: A minor, Em shape, Pentatonic draws the box at frets 5 to 8', async ({
    page
  }) => {
    await minorA(page);
    await shape(page, 'E').click();
    await layerSwitch(page, 'Pentatonic').click();
    await expect(live(page)).toContainText('Pentatonic layer on.');
    expect(spans(await marks(page))).toEqual(['5-8', '5-7', '5-7', '5-7', '5-8', '5-8']);
  });

  test('US4-2 and quickstart 9: with no focus, Pentatonic focuses the first drawn shape', async ({
    page
  }) => {
    await minorA(page);
    await expect(page.getByRole('radio', { name: 'See all' })).toBeChecked();
    const before = (await marks(page)).length;
    await layerSwitch(page, 'Pentatonic').click();
    await expect(page.getByRole('radio', { name: 'See all' })).not.toBeChecked();
    await expect(layerSwitch(page, 'Pentatonic')).toHaveAttribute('aria-checked', 'true');
    await expect(live(page)).toContainText('shape in focus');
    const after = await marks(page);
    expect(after.length).toBeGreaterThan(0);
    expect(live_(after).length).toBeLessThanOrEqual(before + 8);
    // Nearest the nut: no other occurrence starts lower than the focused region.
    const frets = live_(after).map((x) => x.fret);
    const lo = Math.min(...frets);
    const tags = await board(page).locator('.tag:visible').count();
    expect(tags).toBeGreaterThan(0);
    expect(lo).toBeLessThanOrEqual(5);
  });

  test('US4-2: keyboard focus stays on the switch when auto-focus happens', async ({ page }) => {
    await minorA(page);
    await layerSwitch(page, 'Scale').focus();
    await page.keyboard.press('Space');
    await expect(layerSwitch(page, 'Scale')).toHaveAttribute('aria-checked', 'true');
    await expect(layerSwitch(page, 'Scale')).toBeFocused();
  });

  test('US4-3 and quickstart 7: See all draws nothing for Pentatonic; the switch stays on', async ({
    page
  }) => {
    await minorA(page);
    await shape(page, 'E').click();
    await layerSwitch(page, 'Pentatonic').click();
    await shape(page, 'See all').click();
    await expect(layerSwitch(page, 'Pentatonic')).toHaveAttribute('aria-checked', 'true');
    // The "shows when a shape is in focus" sentence is the layers description (US6, T046).
    // A minor: the 4 (D) is a pentatonic-only note; chord markers are R, b3 and 5.
    const labels = async () => (await marks(page)).map((x) => x.label);
    await expect.poll(async () => (await labels()).includes('4')).toBe(false);
    await shape(page, 'E').click();
    await expect.poll(async () => (await labels()).includes('4')).toBe(true);
  });

  test('US4-4: major shape shows R 2 3 5 6; minor shape R b3 4 5 b7', async ({ page }) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    await layerSwitch(page, 'Pentatonic').click();
    await layerSwitch(page, 'Chord').click();
    const labelSet = async () => [...new Set(live_(await marks(page)).map((x) => x.label))].sort();
    await expect.poll(labelSet).toEqual(['2', '3', '5', '6', 'R']);
    await page
      .getByRole('radiogroup', { name: 'Quality' })
      .getByRole('radio', { name: /minor/i })
      .click();
    await expect.poll(labelSet).toEqual(['4', '5', 'R', '♭3', '♭7']);
  });
});

test.describe('caged layers US5: the notes that are only scale', () => {
  const bothOn = async (page: Page) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    await layerSwitch(page, 'Pentatonic').click();
    await layerSwitch(page, 'Scale').click();
  };
  const extras = async (page: Page) =>
    (
      await board(page)
        .locator('.marker:has(circle.extra-dot)')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-key') ?? ''))
    ).sort();

  test('US5-1 and quickstart 6: C major, E focus: only F and B carry the extra dot', async ({
    page
  }) => {
    await bothOn(page);
    await expect.poll(() => extras(page)).toEqual(['1:7', '3:10', '4:9', '5:8', '6:7'].sort());
    await expect(board(page).locator('.marker.degree circle.extra-dot')).toHaveCount(5);
    await expect(live(page)).toContainText('Extra mark: F, B.');
    await expect(layerSwitch(page, 'Scale').locator('circle.extra-dot')).toHaveCount(1);
  });

  test('US5-2: minor marks the 2nd and flat 6th', async ({ page }) => {
    await page.goto('/caged');
    await keyButton(page, 9).click();
    await page
      .getByRole('radiogroup', { name: 'Quality' })
      .getByRole('radio', { name: /minor/i })
      .click();
    await shape(page, 'E').click();
    await layerSwitch(page, 'Pentatonic').click();
    await layerSwitch(page, 'Scale').click();
    await expect.poll(() => extras(page)).not.toEqual([]);
    await expect(live(page)).toContainText('Extra mark: B, F.');
    const labels = await board(page)
      .locator('.marker:has(circle.extra-dot) .marker-label')
      .allTextContents();
    expect(new Set(labels)).toEqual(new Set(['2', '♭6']));
  });

  test('US5-3: only Scale on shows no extra mark and no extra sample', async ({ page }) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    await layerSwitch(page, 'Scale').click();
    await expect(board(page).locator('.marker.degree').first()).toBeVisible();
    await expect(board(page).locator('circle.extra-dot')).toHaveCount(0);
    await expect(layerSwitch(page, 'Scale').locator('circle.extra-dot')).toHaveCount(0);
    await layerSwitch(page, 'Pentatonic').click();
    await expect(layerSwitch(page, 'Scale').locator('circle.extra-dot')).toHaveCount(1);
    await layerSwitch(page, 'Pentatonic').click();
    await expect(board(page).locator('circle.extra-dot')).toHaveCount(0);
    await expect(layerSwitch(page, 'Scale').locator('circle.extra-dot')).toHaveCount(0);
  });

  test('US5-4: chord and arpeggio markers never carry the extra dot', async ({ page }) => {
    await bothOn(page);
    await layerSwitch(page, 'Arpeggio').click();
    await expect.poll(() => extras(page)).not.toEqual([]);
    await expect(
      board(page).locator(
        '.marker.root circle.extra-dot, .marker.third circle.extra-dot, .marker.fifth circle.extra-dot'
      )
    ).toHaveCount(0);
  });
});

test.describe('caged layers US6: readable with everything on', () => {
  const allOn = async (page: Page) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    for (const name of ['Arpeggio', 'Pentatonic', 'Scale']) await layerSwitch(page, name).click();
    await expect(layerSwitch(page, 'Scale')).toHaveAttribute('aria-checked', 'true');
    await expect(board(page).locator('.marker.degree').first()).toBeVisible();
  };

  test('US6-1: chord strongest, arpeggio medium, degree markers outlined without color', async ({
    page
  }) => {
    await allOn(page);
    const chord = board(page)
      .locator('.marker.highlighted.root:not(.layer-arpeggio) .shape')
      .first();
    const arp = board(page).locator('.marker.layer-arpeggio .shape').first();
    const degree = board(page).locator('.marker.degree').first();
    await expect(arp).toBeVisible();
    const style = (l: typeof chord) =>
      l.evaluate((e) => ({
        opacity: Number(getComputedStyle(e).opacity),
        scale: new DOMMatrix(getComputedStyle(e).transform).a
      }));
    const c = await style(chord);
    const a = await style(arp);
    expect(a.opacity).toBeLessThan(c.opacity);
    expect(a.scale).toBeLessThan(c.scale);
    // Outlined, not filled: shape alone tells it apart from the filled chord glyphs.
    const glyph = degree.locator('circle.glyph.outline');
    await expect(glyph).toHaveCount(1);
    expect(await glyph.evaluate((e) => getComputedStyle(e).fill)).toBe('none');
    expect(
      await glyph.evaluate((e) => Number.parseFloat(getComputedStyle(e).strokeWidth))
    ).toBeGreaterThan(0);
    const filled = board(page).locator('.marker.third:not(.layer-arpeggio) circle.glyph').first();
    const radius = (l: typeof glyph) => l.evaluate((e) => Number(e.getAttribute('r')));
    expect(await radius(glyph)).toBeLessThan(await radius(filled));
    // Chord root is a square, arpeggio fifths are diamonds: shapes differ per role.
    await expect(board(page).locator('.marker.root rect.glyph').first()).toBeVisible();
  });

  test('US6-2: one marker per position, highest priority wins', async ({ page }) => {
    await allOn(page);
    const all = await marks(page);
    expect(new Set(all.map((x) => x.key)).size).toBe(all.length);
    const byKey = new Map(all.map((x) => [x.key, x]));
    // C root (s6 f8) is in every layer: drawn once, as the chord root.
    expect(byKey.get('6:8')?.classes).toMatch(/\broot\b/);
    expect(byKey.get('6:8')?.classes).not.toMatch(/layer-arpeggio|degree/);
    // G (s5 f7) is arpeggio and scale: arpeggio wins; F (s5 f8) is pentatonic/scale only.
    expect(byKey.get('5:7')?.classes).toMatch(/layer-arpeggio/);
    expect(byKey.get('5:8')?.classes).toMatch(/\bdegree\b/);
  });

  test('US6-3: the description lists the layers and the region counts', async ({ page }) => {
    await allOn(page);
    const text = (await live(page).textContent()) ?? '';
    expect(text).toContain('Layers on: Chord, Arpeggio, Pentatonic, and Scale.');
    const m = text.match(
      /In this region: (\d+) chord notes, (\d+) arpeggio notes, (\d+) pentatonic notes, (\d+) scale notes\./
    );
    expect(m).not.toBeNull();
    const total = (m ?? []).slice(1).reduce((n, v) => n + Number(v), 0);
    expect(total).toBe((await marks(page)).length);
  });
});

// Polish: accessibility, keyboard, targets and reflow (SC-006) ----------------------------------

test.describe('caged layers polish: accessibility and reflow', () => {
  const allSwitches = ['Chord', 'Arpeggio', 'Pentatonic', 'Scale'];

  test('axe: zero violations with every layer on and Name labels', async ({ page }) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    for (const name of ['Arpeggio', 'Pentatonic', 'Scale']) await layerSwitch(page, name).click();
    await labelRadio(page, 'Note names').click();
    await expect(board(page).locator('.marker.degree').first()).toBeVisible();
    await runAxe(page);
  });

  test('keyboard only: Tab reaches all four switches; Space and Enter toggle them', async ({
    page
  }) => {
    await page.goto('/caged');
    await shape(page, 'E').click();
    for (const name of allSwitches) {
      await layerSwitch(page, name).focus();
      await expect(layerSwitch(page, name)).toBeFocused();
    }
    await layerSwitch(page, 'Arpeggio').focus();
    await page.keyboard.press('Space');
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-checked', 'true');
    await layerSwitch(page, 'Pentatonic').focus();
    await page.keyboard.press('Enter');
    await expect(layerSwitch(page, 'Pentatonic')).toHaveAttribute('aria-checked', 'true');
    await layerSwitch(page, 'Scale').focus();
    await page.keyboard.press('Space');
    await expect(layerSwitch(page, 'Scale')).toHaveAttribute('aria-checked', 'true');
    await layerSwitch(page, 'Arpeggio').focus();
    await page.keyboard.press('Space');
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-checked', 'false');
    // Focus never leaves the switch that was operated.
    await expect(layerSwitch(page, 'Arpeggio')).toBeFocused();
  });

  test('all four switches are at least 44×44 px', async ({ page }) => {
    await page.goto('/caged');
    for (const name of allSwitches) {
      const box = await layerSwitch(page, name).boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('layer switches wrap without horizontal scroll at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/caged');
    await layerSwitch(page, 'Scale').scrollIntoViewIfNeeded();
    await expectNoHorizontalScroll(page);
    for (const name of allSwitches) {
      const box = await layerSwitch(page, name).boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? -1) >= 0).toBe(true);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
    }
  });

  test('200% zoom (CSS width 640 → 320 effective) keeps the switches reachable', async ({
    page
  }) => {
    // 200% zoom on a 640 px window is a 320 CSS px viewport; the page must still reflow.
    await page.setViewportSize({ width: 320, height: 320 });
    await page.goto('/caged');
    await expectNoHorizontalScroll(page);
    for (const name of allSwitches) {
      await layerSwitch(page, name).scrollIntoViewIfNeeded();
      await expect(layerSwitch(page, name)).toBeVisible();
    }
  });
});

// Quickstart §3 rows 15 and 19: other tunings -----------------------------------------------------

test.describe('caged layers quickstart: tunings', () => {
  const seedTuning = (page: Page, tuning: string) =>
    page.addInitScript(
      ([k, v]) => localStorage.setItem(k, JSON.stringify({ version: 1, tuning: v })),
      ['fretboard-master:prefs', tuning] as const
    );

  test('row 15: Drop D, D major, E shape, Scale: string 6 shows 9, 11 and 12', async ({ page }) => {
    await seedTuning(page, 'AF-4');
    await page.goto('/caged');
    await keyButton(page, 2).click();
    await shape(page, 'E').click();
    await layerSwitch(page, 'Scale').click();
    const s6 = live_(await marks(page)).filter((x) => x.string === 6);
    expect(s6.map((x) => x.fret).sort((a, b) => a - b)).toEqual(
      expect.arrayContaining([9, 11, 12])
    );
    const twelve = s6.find((x) => x.fret === 12);
    expect(twelve?.classes).toMatch(/\broot\b/);
    expect(twelve?.classes).not.toMatch(/\bdegree\b/);
  });

  test('row 19: Open G disables all four switches with the explanation', async ({ page }) => {
    await page.goto('/caged');
    await layerSwitch(page, 'Scale').click();
    await seedTuning(page, 'AF-8');
    await page.reload();
    for (const name of ['Chord', 'Arpeggio', 'Pentatonic', 'Scale'])
      await expect(layerSwitch(page, name)).toHaveAttribute('aria-disabled', 'true');
    await expect(layerSwitch(page, 'Chord')).toHaveAccessibleDescription(
      'Layers need a CAGED shape on the fretboard.'
    );
  });
});
