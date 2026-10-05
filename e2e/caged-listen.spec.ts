import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, readAudioLog, runAxe } from './support/helpers';

/** Feature 019 US1: Listen plays the widest layer on, with pulses (also muted). */

const PREFS_KEY = 'fretboard-master:prefs';
const layers = (page: Page) => page.getByRole('group', { name: 'Layers' });
const layerSwitch = (page: Page, name: string) =>
  layers(page).getByRole('switch', { name, exact: true });
const shape = (page: Page, name: string) =>
  page.getByRole('radiogroup', { name: 'Shape' }).getByRole('radio', { name, exact: true });
const listen = (page: Page) => page.getByRole('button', { name: 'Listen', exact: true });
const status = (page: Page) => page.locator('[data-listen-status]');

async function steps(page: Page) {
  const log = await readAudioLog(page);
  return log.flatMap((e) => (e.type === 'step' ? [e] : []));
}

/** Gaps in ms between consecutive scheduled steps. */
async function deltas(page: Page): Promise<number[]> {
  const s = await steps(page);
  return s.slice(1).map((e, i) => Math.round((e.when - s[i].when) * 1000));
}

async function setLayers(page: Page, on: readonly string[]) {
  for (const name of ['Chord', 'Triad', 'Arpeggio', 'Scale', 'Pentatonic']) {
    const sw = layerSwitch(page, name);
    if ((await sw.count()) === 0) continue;
    const checked = (await sw.getAttribute('aria-checked')) === 'true';
    const want = on.includes(name);
    if (!checked && want) await sw.click();
  }
  for (const name of ['Chord', 'Triad', 'Arpeggio', 'Scale', 'Pentatonic']) {
    const sw = layerSwitch(page, name);
    if ((await sw.count()) === 0) continue;
    const checked = (await sw.getAttribute('aria-checked')) === 'true';
    if (checked && !on.includes(name)) await sw.click();
  }
}

test.describe('caged listen US1: hear the focused shape', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  test('Chord only is a timeline: 250 ms strum, 500 ms to the block with every pitch', async ({
    page
  }) => {
    await shape(page, 'E').click();
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(2);
    const s = await steps(page);
    expect(s.every((e) => e.kind === 'timeline')).toBe(true);
    const gaps = await deltas(page);
    expect(gaps.slice(0, -1).every((g) => g === 250)).toBe(true);
    expect(gaps.at(-1)).toBe(500);
    const strummed = s.slice(0, -1).flatMap((e) => e.pitches);
    expect([...(s.at(-1)?.pitches ?? [])].sort((a, b) => a - b)).toEqual(
      [...strummed].sort((a, b) => a - b)
    );
    await expect(status(page)).toHaveText('Playing: Chord, E shape');
  });

  test('Triad is a sequence of 4 steps at 500 ms, the last with 3 pitches', async ({ page }) => {
    await shape(page, 'E').click();
    await layerSwitch(page, 'Triad').click();
    await setLayers(page, ['Triad']);
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBe(4);
    const s = await steps(page);
    expect(s.every((e) => e.kind === 'sequence')).toBe(true);
    expect(await deltas(page)).toEqual([500, 500, 500]);
    expect(s.map((e) => e.pitches.length)).toEqual([1, 1, 1, 3]);
  });

  test('Arpeggio goes up and back with the top note once', async ({ page }) => {
    await shape(page, 'E').click();
    await setLayers(page, ['Arpeggio']);
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(3);
    const p = (await steps(page)).map((e) => e.pitches[0]);
    const top = Math.max(...p);
    expect(p.filter((x) => x === top)).toHaveLength(1);
    expect(p.indexOf(top)).toBeGreaterThan(0);
    expect(p[0]).toBe(p.at(-1));
    expect((await deltas(page)).every((g) => g === 500)).toBe(true);
  });

  test('Scale starts and ends on the region lowest root', async ({ page }) => {
    await shape(page, 'E').click();
    await setLayers(page, ['Scale']);
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(6);
    const p = (await steps(page)).map((e) => e.pitches[0]);
    expect(p[0] % 12).toBe(0);
    expect(p.at(-1)).toBe(p[0]);
  });

  test('Pentatonic + Scale plays the scale', async ({ page }) => {
    await shape(page, 'E').click();
    await setLayers(page, ['Scale']);
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(6);
    const scaleCount = (await steps(page)).length;

    await page.reload();
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await shape(page, 'E').click();
    await setLayers(page, ['Scale', 'Pentatonic']);
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBe(scaleCount);
  });

  test('No focus plays every occurrence nut to body with a 1500 ms shape gap', async ({ page }) => {
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(10);
    const s = await steps(page);
    expect(s.every((e) => e.kind === 'timeline')).toBe(true);
    expect(await deltas(page)).toContain(1500);
    await expect(status(page)).toHaveText('Playing every shape');
    const lows = s.filter((e) => e.pitches.length === 1).map((e) => e.pitches[0]);
    expect(lows[0]).toBeLessThanOrEqual(lows[lows.length - 1]);
  });

  test('every note pulses, also when muted', async ({ page }) => {
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await shape(page, 'E').click();
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(0);
    await expect(page.locator('.marker.pulse').first()).toBeAttached();
    await page.clock.runFor(300);
    await expect(page.locator('.marker.pulse').first()).toBeAttached();
  });
});

test.describe('caged listen US1: tunings', () => {
  test('a non-compatible tuning disables Listen with a visible reason; the standard view plays', async ({
    page
  }) => {
    await page.addInitScript(([k, r]) => localStorage.setItem(k as string, JSON.stringify(r)), [
      PREFS_KEY,
      { version: 1, tuning: 'AF-8' }
    ] as const);
    await page.clock.install();
    await page.goto('/caged');
    const b = listen(page);
    await expect(b).toHaveAttribute('aria-disabled', 'true');
    const reason = await b.getAttribute('aria-describedby');
    await expect(page.locator(`#${reason}`)).toBeVisible();
    await expect(page.locator(`#${reason}`)).not.toBeEmpty();

    await page.getByRole('button', { name: 'View in standard tuning' }).click();
    await expect(b).not.toHaveAttribute('aria-disabled', 'true');
    await b.click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(0);
    const first = (await steps(page))[0];
    // Standard tuning: the lowest chord tone of the C shape is C3 (48) or above E2 (40).
    expect(first.pitches[0]).toBeGreaterThanOrEqual(40);
    expect(first.pitches[0] % 12).toBe(0);
  });
});

/** Feature 019 US2: Stop, the stop matrix, tempo. */
const stopButton = (page: Page) => page.getByRole('button', { name: 'Stop', exact: true });
const tempoRadio = (page: Page, name: 'Slow' | 'Medium' | 'Fast') =>
  page.getByRole('radiogroup', { name: 'Tempo' }).getByRole('radio', { name, exact: true });
const keyButton = (page: Page, pc: number) =>
  page.getByRole('group', { name: 'Key' }).getByRole('button').nth(pc);

async function stopEntries(page: Page) {
  const log = await readAudioLog(page);
  return log.flatMap((e) => (e.type === 'stop' ? [e] : []));
}

/** Start a Scale sequence on the E shape and wait until it is playing. */
async function startScale(page: Page) {
  await shape(page, 'E').click();
  await layerSwitch(page, 'Scale').click();
  await listen(page).click();
  await expect(stopButton(page)).toBeVisible();
  await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(0);
}

test.describe('caged listen US2: Stop', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  test('Stop ends sound and pulses, logs stop, and moves focus to the mute control', async ({
    page
  }) => {
    await startScale(page);
    await expect(page.locator('.marker.pulse').first()).toBeAttached();
    await stopButton(page).focus();
    await stopButton(page).press('Enter');
    await expect(stopButton(page)).toHaveCount(0);
    await expect(page.locator('.marker.pulse')).toHaveCount(0);
    const stops = await stopEntries(page);
    expect(stops.map((e) => e.reason)).toEqual(['stop']);
    await expect(page.getByRole('button', { name: /^(Mute|Unmute) sound$/ })).toBeFocused();
  });

  test('Listen twice restarts', async ({ page }) => {
    await startScale(page);
    const before = (await steps(page)).length;
    await listen(page).click();
    expect((await stopEntries(page)).map((e) => e.reason)).toContain('interrupt');
    await expect(stopButton(page)).toBeVisible();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(before);
  });

  test('hiding the page stops playback with reason hidden and does not resume', async ({
    page
  }) => {
    await startScale(page);
    const hide = (state: 'hidden' | 'visible') =>
      page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await hide('hidden');
    const stops = await stopEntries(page);
    expect(stops.map((e) => e.reason)).toEqual(['hidden']);
    const count = (await steps(page)).length;
    await hide('visible');
    await page.clock.runFor(5000);
    expect((await steps(page)).length).toBe(count);
    await expect(stopButton(page)).toHaveCount(0);
  });

  test('a single tapped note survives focus and layer changes', async ({ page }) => {
    await shape(page, 'E').click();
    await page.locator('.cell[data-string="6"][data-fret="0"]').click();
    await expect.poll(async () => (await steps(page)).length).toBe(1);
    await shape(page, 'A').click();
    await layerSwitch(page, 'Arpeggio').click();
    expect(await stopEntries(page)).toHaveLength(0);
  });
});

test.describe('caged listen US2: stop matrix (R-09)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  const stops: readonly (readonly [string, (page: Page) => Promise<void>])[] = [
    ['key', (p) => keyButton(p, 7).click()],
    ['quality', (p) => p.getByRole('radio', { name: 'Minor', exact: true }).click()],
    [
      'tag',
      (p) =>
        p
          .getByRole('button', { name: /^A shape/ })
          .first()
          .click()
    ],
    ['shape selector', (p) => shape(p, 'A').click()],
    ['Next', (p) => p.getByRole('button', { name: 'Next shape' }).click()],
    ['layer', (p) => layerSwitch(p, 'Arpeggio').click()],
    ['tempo', (p) => tempoRadio(p, 'Fast').click()],
    [
      'tuning',
      async (p) => {
        await p
          .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
          .first()
          .click();
        const dialog = p.getByRole('dialog', { name: 'Instrument' });
        await dialog.getByRole('radio', { name: /^Drop D:/ }).check();
        await dialog.getByRole('button', { name: 'Confirm' }).click();
      }
    ],
    [
      'tool',
      (p) =>
        p
          .getByRole('navigation', { name: 'Tools' })
          .getByRole('link', { name: /triads/i })
          .click()
    ]
  ];

  for (const [name, act] of stops) {
    test(`${name} stops playback`, async ({ page }) => {
      await startScale(page);
      await act(page);
      await expect(stopButton(page)).toHaveCount(0);
      await expect(page.locator('.marker.pulse')).toHaveCount(0);
      expect((await stopEntries(page)).length).toBeGreaterThan(0);
    });
  }

  test('spelling stops playback', async ({ page }) => {
    await keyButton(page, 1).click();
    await startScale(page);
    await page.getByRole('button', { name: /^Switch to/ }).click();
    await expect(stopButton(page)).toHaveCount(0);
    expect((await stopEntries(page)).length).toBeGreaterThan(0);
  });

  test('Triad string set stops playback', async ({ page }) => {
    await shape(page, 'A').click();
    await layerSwitch(page, 'Triad').click();
    await layerSwitch(page, 'Scale').click();
    await listen(page).click();
    await expect(stopButton(page)).toBeVisible();
    await page
      .getByRole('radiogroup', { name: 'Triad strings' })
      .locator('[role="radio"][aria-checked="false"]:not([aria-disabled="true"])')
      .first()
      .click();
    await expect(stopButton(page)).toHaveCount(0);
  });

  test('Labels and Show connections do not stop playback', async ({ page }) => {
    await startScale(page);
    await page
      .getByRole('radiogroup', { name: 'Labels' })
      .getByRole('radio', { name: 'Note names', exact: true })
      .click();
    await page.getByRole('switch', { name: 'Show connections' }).click();
    await expect(stopButton(page)).toBeVisible();
    expect(await stopEntries(page)).toHaveLength(0);
  });

  test('tempo changed mid-sequence stops playback', async ({ page }) => {
    await startScale(page);
    await tempoRadio(page, 'Slow').click();
    await expect(stopButton(page)).toHaveCount(0);
    expect((await stopEntries(page)).map((e) => e.reason)).toContain('view');
  });
});

test.describe('caged listen US2: tempo', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await shape(page, 'E').click();
  });

  const expected = { Slow: 750, Medium: 500, Fast: 333 } as const;

  for (const layer of ['Arpeggio', 'Scale'] as const) {
    for (const t of ['Slow', 'Medium', 'Fast'] as const) {
      test(`${layer} at ${t} steps every ${expected[t]} ms`, async ({ page }) => {
        await setLayers(page, [layer]);
        await tempoRadio(page, t).click();
        await listen(page).click();
        await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(3);
        const gaps = await deltas(page);
        for (const g of gaps) expect(Math.abs(g - expected[t])).toBeLessThanOrEqual(1);
      });
    }
  }

  test('Chord and Triad timing ignore the tempo', async ({ page }) => {
    await tempoRadio(page, 'Fast').click();
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(2);
    const chord = await deltas(page);
    expect(chord.slice(0, -1).every((g) => g === 250)).toBe(true);
    expect(chord.at(-1)).toBe(500);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await setLayers(page, ['Triad']);
    await listen(page).click();
    await expect.poll(async () => (await steps(page)).length).toBeGreaterThan(chord.length + 3);
    const all = await deltas(page);
    expect(all.slice(chord.length + 1).every((g) => g === 500)).toBe(true);
  });
});

/** Feature 019 Polish: keyboard reach, axe, 44 px targets, narrow widths. */
const tempoGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Tempo' });

/** Press Tab until `target` has focus (bounded), so reach does not depend on DOM order. */
async function tabTo(page: Page, target: ReturnType<Page['locator']>, max = 80) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('Tab never reached the target');
}

test.describe('caged listen polish: keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  test('Tab reaches Listen and Tempo; Enter and Space start; Stop by keyboard', async ({
    page
  }) => {
    await tabTo(page, listen(page));
    await page.keyboard.press('Enter');
    await expect(stopButton(page)).toBeVisible();
    await expect(status(page)).toContainText('Playing');
    await tabTo(page, stopButton(page));
    await page.keyboard.press('Space');
    await expect(listen(page)).toBeVisible();
    await listen(page).focus();
    await page.keyboard.press('Space');
    await expect(stopButton(page)).toBeVisible();
    await stopButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(listen(page)).toBeVisible();
    await tabTo(page, tempoGroup(page).locator('[role="radio"][tabindex="0"]'));
    await page.keyboard.press('ArrowRight');
    await expect(tempoGroup(page).locator('[role="radio"][aria-checked="true"]')).toBeFocused();
  });

  test('a disabled Listen is still in the tab order and does not start on Enter', async ({
    page
  }) => {
    await page.addInitScript(([k, r]) => localStorage.setItem(k as string, JSON.stringify(r)), [
      PREFS_KEY,
      { version: 1, tuning: 'AF-8' }
    ] as const);
    await page.goto('/caged');
    await expect(listen(page)).toHaveAttribute('aria-disabled', 'true');
    await tabTo(page, listen(page));
    await page.keyboard.press('Enter');
    await expect(listen(page)).toBeVisible();
    expect((await steps(page)).length).toBe(0);
  });
});

test.describe('caged listen polish: link buttons by keyboard', () => {
  test('Notes: CAGED in this key activates with Enter and Space', async ({ page }) => {
    for (const key of ['Enter', 'Space']) {
      await page.goto('/notes');
      const grid = page.getByRole('grid', { name: 'Fretboard' });
      await grid.waitFor();
      await page.locator('.cell[data-string="1"][data-fret="3"]').click();
      const link = page.getByRole('button', { name: 'CAGED in this key', exact: true });
      await tabTo(page, link, 150);
      await page.keyboard.press(key);
      await expect(page).toHaveURL(/\/caged$/);
    }
  });

  test('Triads: View in CAGED activates with Enter and Space', async ({ page }) => {
    for (const key of ['Enter', 'Space']) {
      await page.goto('/triads');
      const link = page.getByRole('button', { name: 'View in CAGED', exact: true });
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press(key);
      await expect(page).toHaveURL(/\/caged$/);
    }
  });
});

test.describe('caged listen polish: axe, targets and narrow widths', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const [name, size] of [
      ['phone', { width: 360, height: 740 }],
      ['desktop', { width: 1280, height: 800 }]
    ] as const) {
      test(`axe clean: Listen idle, playing, disabled (${name}, ${colorScheme})`, async ({
        page
      }) => {
        await page.setViewportSize(size);
        await page.emulateMedia({ colorScheme });
        await page.clock.install();
        await page.goto('/caged');
        await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
        await runAxe(page);
        await listen(page).click();
        await expect(stopButton(page)).toBeVisible();
        await runAxe(page);
        await stopButton(page).click();
        await page.addInitScript(([k, r]) => localStorage.setItem(k as string, JSON.stringify(r)), [
          PREFS_KEY,
          { version: 1, tuning: 'AF-8' }
        ] as const);
        await page.goto('/caged');
        await expect(listen(page)).toHaveAttribute('aria-disabled', 'true');
        await runAxe(page);
      });
    }
  }

  for (const width of [320, 360]) {
    test(`Listen controls are at least 44x44 and wrap without scroll at ${width} px`, async ({
      page
    }) => {
      await page.setViewportSize({ width, height: 640 });
      await page.clock.install();
      await page.goto('/caged');
      await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
      const targets = [listen(page), ...(await tempoGroup(page).getByRole('radio').all())];
      await listen(page).click();
      targets.push(stopButton(page));
      for (const t of targets) {
        const box = await t.boundingBox();
        if (!box) continue;
        expect(box.width).toBeGreaterThanOrEqual(43.5);
        expect(box.height).toBeGreaterThanOrEqual(43.5);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      }
      await expectNoHorizontalScroll(page);
    });
  }
});
