import { expect, test, type Page } from '@playwright/test';

import { expandDetails, expectNoHorizontalScroll, runAxe } from './support/helpers';

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const layers = (page: Page) => page.getByRole('group', { name: 'Layers' });
const layerSwitch = (page: Page, name: string) =>
  layers(page).getByRole('switch', { name, exact: true });
const shape = (page: Page, name: string) =>
  page.getByRole('radiogroup', { name: 'Shape' }).getByRole('radio', { name, exact: true });
const labelRadio = (page: Page, name: string) =>
  page.getByRole('radiogroup', { name: 'Labels' }).getByRole('radio', { name, exact: true });
const sets = (page: Page) => page.getByRole('radiogroup', { name: 'Triad strings' });
const setOption = (page: Page, name: string) =>
  sets(page).getByRole('radio', { name, exact: true });
const live = (page: Page) => board(page).locator('[aria-live="polite"]');
const triadMarkers = (page: Page) => board(page).locator('g.marker.layer-triad');

/** `data-key` of every triad marker, sorted. */
const triadKeys = async (page: Page): Promise<string[]> =>
  (
    await triadMarkers(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-key') ?? ''))
  ).sort();

/** C major, standard tuning, A shape in focus, Triad on (default set 3-2-1). */
async function aShapeTriad(page: Page): Promise<void> {
  await page.goto('/caged');
  await expandDetails(page);
  await shape(page, 'A').click();
  await layerSwitch(page, 'Triad').click();
}

test.describe('caged triad US1: find the triad inside the shape I am holding', () => {
  test('US1-1: A shape + Triad + 3-2-1 highlights exactly three markers at frets 5-5-3', async ({
    page
  }) => {
    await aShapeTriad(page);
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await expect(setOption(page, '3-2-1')).toBeChecked();
    await expect(triadMarkers(page)).toHaveCount(3);
    expect(await triadKeys(page)).toEqual(['1:3', '2:5', '3:5']);
    await expect(
      page.getByText('C major, root position, strings 3-2-1, frets 5-5-3')
    ).toBeVisible();
  });

  test('US1-2: Name labels show C, E, G', async ({ page }) => {
    await aShapeTriad(page);
    await labelRadio(page, 'Note names').click();
    await expect(board(page).locator('g.marker[data-key="3:5"] .marker-label')).toHaveText('C');
    await expect(board(page).locator('g.marker[data-key="2:5"] .marker-label')).toHaveText('E');
    await expect(board(page).locator('g.marker[data-key="1:3"] .marker-label')).toHaveText('G');
  });

  test('US1-3: another set moves the highlight and is announced', async ({ page }) => {
    await aShapeTriad(page);
    await setOption(page, '4-3-2').click();
    await expect(setOption(page, '4-3-2')).toBeChecked();
    await expect(triadMarkers(page)).toHaveCount(3);
    expect(await triadKeys(page)).toEqual(['2:5', '3:5', '4:5']);
    await expect(live(page)).toContainText(
      'Strings 4-3-2: C major triad, 2nd inversion, frets 5-5-5'
    );
    await expect(live(page)).toContainText(
      'Triad: G, C, E — 2nd inversion, strings 4-3-2, frets 5-5-5.'
    );
  });

  test('US1-4: turning Arpeggio off keeps the triad', async ({ page }) => {
    await aShapeTriad(page);
    await layerSwitch(page, 'Arpeggio').click();
    expect(await triadKeys(page)).toEqual(['1:3', '2:5', '3:5']);
    await layerSwitch(page, 'Arpeggio').click();
    await expect(layerSwitch(page, 'Arpeggio')).toHaveAttribute('aria-checked', 'false');
    expect(await triadKeys(page)).toEqual(['1:3', '2:5', '3:5']);
  });

  test('US1-5: one marker per position', async ({ page }) => {
    await aShapeTriad(page);
    await layerSwitch(page, 'Arpeggio').click();
    await layerSwitch(page, 'Scale').click();
    const keys = await board(page)
      .locator('g.marker')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-key') ?? ''));
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of ['3:5', '2:5', '1:3'])
      await expect(board(page).locator(`g.marker[data-key="${k}"]`)).toHaveCount(1);
  });

  test('US1-6: the reveal runs low to high and is instant under reduced motion', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await aShapeTriad(page);
    // No waiting: the three triad markers are fully visible in the first frame.
    await expect(triadMarkers(page)).toHaveCount(3);
    const opacities = await triadMarkers(page).evaluateAll((els) =>
      els.map((e) => getComputedStyle(e).opacity)
    );
    for (const o of opacities) expect(Number(o)).toBe(1);
  });

  test('US1-6b: with motion, the reveal starts at the lowest note and ends at the highest', async ({
    page
  }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'A').click();
    // Read the intro delays in the same task as the click, before the window ends.
    const delays = await page.evaluate(async () => {
      const sw = [...document.querySelectorAll('[role="switch"]')].find((e) =>
        /^Triad/.test(e.textContent?.trim() ?? '')
      ) as HTMLElement;
      sw.click();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const out: Record<string, number> = {};
      for (const el of document.querySelectorAll('g.marker.layer-triad')) {
        const key = el.getAttribute('data-key') ?? '';
        const anim = el.getAnimations();
        out[key] = anim.length
          ? Math.max(...anim.map((a) => Number(a.effect?.getTiming().delay ?? 0)))
          : 0;
      }
      return out;
    });
    // Pitch order: 3:5 (C) → 2:5 (E) → 1:3 (G).
    expect(delays['3:5']).toBeLessThanOrEqual(delays['2:5']);
    expect(delays['2:5']).toBeLessThanOrEqual(delays['1:3']);
  });

  test('US1-7: the Triad row is last and the selector appears only with Triad on', async ({
    page
  }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await expect(layers(page).getByRole('switch').last()).toHaveText(/Triad\s*Off/);
    await expect(sets(page)).toHaveCount(0);
    await shape(page, 'A').click();
    await expect(sets(page)).toHaveCount(0);
    await layerSwitch(page, 'Triad').click();
    await expect(sets(page)).toBeVisible();
    await layerSwitch(page, 'Triad').click();
    await expect(sets(page)).toHaveCount(0);
    await expect(triadMarkers(page)).toHaveCount(0);
  });
});

test.describe('caged triad US2: know which string sets have no triad', () => {
  const unavailable = (page: Page, set: string) =>
    sets(page).getByRole('radio', { name: `Strings ${set}, unavailable`, exact: true });

  async function gShapeTriad(page: Page): Promise<void> {
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'G').click();
    await layerSwitch(page, 'Triad').click();
  }

  test('US2-1: a disabled set is aria-disabled and described by the visible note', async ({
    page
  }) => {
    await gShapeTriad(page);
    const option = unavailable(page, '3-2-1');
    await expect(option).toHaveAttribute('aria-disabled', 'true');
    const describedby = await option.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    const note = page.locator(`#${describedby}`);
    await expect(note).toBeVisible();
    await expect(note).toHaveText(
      'In this shape there is no close-position triad on these strings'
    );
  });

  test('US2-2: arrows reach a disabled set, Space and Enter do not select it', async ({ page }) => {
    await gShapeTriad(page);
    await expect(setOption(page, '6-5-4')).toBeChecked();
    await setOption(page, '6-5-4').focus();
    const option = unavailable(page, '3-2-1');
    await page.keyboard.press('End');
    await expect(option).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await expect(option).not.toBeChecked();
    await expect(setOption(page, '6-5-4')).toBeChecked();
    await expect(triadMarkers(page)).toHaveCount(3);
  });

  test('US2-3: focusing the G shape moves 3-2-1 to 6-5-4 with an announcement', async ({
    page
  }) => {
    await aShapeTriad(page);
    await expect(setOption(page, '3-2-1')).toBeChecked();
    await shape(page, 'G').click();
    await expect(setOption(page, '6-5-4')).toBeChecked();
    await expect(triadMarkers(page)).toHaveCount(3);
    await expect(live(page)).toContainText(
      'Strings 3-2-1 unavailable in this shape; showing strings 6-5-4'
    );
  });
});

test.describe('caged triad US3: jump to the Triads tool', () => {
  const openButton = (page: Page) =>
    page.getByRole('button', { name: 'Open in Triads', exact: true });
  const triadsSet = (page: Page) => page.getByRole('radiogroup', { name: 'String set' });
  const quality = (page: Page, name: string) =>
    page.getByRole('radiogroup', { name: 'Quality' }).getByRole('radio', { name, exact: true });

  test('US3-1: major A shape opens Triads on C major, root position, 3-2-1', async ({ page }) => {
    await aShapeTriad(page);
    await expect(openButton(page)).toBeVisible();
    await openButton(page).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    await expect(triadsSet(page).getByRole('radio', { name: '3-2-1' })).toBeChecked();
  });

  test('US3-2: minor carries the quality', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await quality(page, 'Minor').click();
    await shape(page, 'A').click();
    await layerSwitch(page, 'Triad').click();
    await openButton(page).click();
    await expect(page.getByText('C minor — Root position', { exact: true })).toBeVisible();
  });

  test('US3-3: D shape 3-2-1 lands on the higher occurrence (12-13-12), Octave up is off', async ({
    page
  }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'D').click();
    await layerSwitch(page, 'Triad').click();
    await setOption(page, '3-2-1').click();
    await openButton(page).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(page.getByText('C major — 2nd inversion', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Octave up' })).toBeDisabled();
  });

  test('US3-4: no shortcut without a drawn triad', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'A').click();
    await expect(openButton(page)).toHaveCount(0);
  });
});

test.describe('caged triad US4: turn on Triad without a shape in focus', () => {
  const seeAll = (page: Page) => shape(page, 'See all');

  test('US4-1: turning Triad on with no focus focuses a shape and draws the default set', async ({
    page
  }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await expect(seeAll(page)).toBeChecked();
    await layerSwitch(page, 'Triad').click();
    await expect(seeAll(page)).not.toBeChecked();
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await expect(sets(page)).toBeVisible();
    await expect(triadMarkers(page)).toHaveCount(3);
    await expect(live(page)).toContainText('Triad layer on.');
  });

  test('US4-2: clearing focus keeps the switch on and hides the selector; refocus draws again', async ({
    page
  }) => {
    await aShapeTriad(page);
    await seeAll(page).click();
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await expect(triadMarkers(page)).toHaveCount(0);
    await expect(sets(page)).toHaveCount(0);
    await shape(page, 'A').click();
    await expect(triadMarkers(page)).toHaveCount(3);
    await expect(sets(page)).toBeVisible();
  });

  test('US4-3: See all with only Triad on restores Chord with an announcement; Triad stays on', async ({
    page
  }) => {
    await aShapeTriad(page);
    await layerSwitch(page, 'Chord').click();
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'false');
    await seeAll(page).click();
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'true');
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await expect(live(page)).toContainText('Chord layer on.');
    await expect(triadMarkers(page)).toHaveCount(0);
  });

  test('US4-4: the last drawable layer is aria-disabled with the described reason', async ({
    page
  }) => {
    await aShapeTriad(page);
    await layerSwitch(page, 'Chord').click();
    const sw = layerSwitch(page, 'Triad');
    await expect(sw).toHaveAttribute('aria-disabled', 'true');
    const describedby = await sw.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    await expect(page.locator(`#${describedby}`)).toHaveText('At least one layer stays on.');
    await sw.click({ force: true });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(triadMarkers(page)).toHaveCount(3);
  });
});

const PREFS_KEY = 'fretboard-master:prefs';
const seedPrefs = (page: Page, record: Record<string, unknown>) =>
  page.addInitScript(([k, r]) => localStorage.setItem(k as string, JSON.stringify(r)), [
    PREFS_KEY,
    { version: 1, ...record }
  ] as const);
const keyButton = (page: Page, pc: number) =>
  page.getByRole('group', { name: 'Key' }).getByRole('button').nth(pc);

test.describe('caged triad US5: right notes in any tuning', () => {
  test('US5-1: Half step down E major A shape names follow the real pitch', async ({ page }) => {
    await seedPrefs(page, { tuning: 'AF-2' });
    await page.goto('/caged');
    await expandDetails(page);
    await keyButton(page, 4).click();
    await shape(page, 'A').click();
    await layerSwitch(page, 'Triad').click();
    await labelRadio(page, 'Note names').click();
    await expect(triadMarkers(page)).toHaveCount(3);
    const names = await triadMarkers(page).evaluateAll((els) =>
      els
        .map((e) => ({
          key: e.getAttribute('data-key') ?? '',
          label: e.querySelector('.marker-label')?.textContent ?? ''
        }))
        .sort((a, b) => a.key.localeCompare(b.key))
    );
    expect(names.map((n) => n.label).sort()).toEqual(['B', 'E', 'G♯']);
  });

  test('US5-2: Drop D, D major E shape, set 6-5-4 is offered and consistent', async ({ page }) => {
    await seedPrefs(page, { tuning: 'AF-4' });
    await page.goto('/caged');
    await expandDetails(page);
    await keyButton(page, 2).click();
    await shape(page, 'E').click();
    await layerSwitch(page, 'Triad').click();
    const six = sets(page).getByRole('radio', { name: /^(Strings )?6-5-4/ });
    await expect(six).toBeVisible();
    const disabled = (await six.getAttribute('aria-disabled')) === 'true';
    if (!disabled) {
      await six.click();
      await expect(triadMarkers(page)).toHaveCount(3);
      const strings = await triadMarkers(page).evaluateAll((els) =>
        els.map((e) => (e.getAttribute('data-key') ?? '').split(':')[0]).sort()
      );
      expect(strings).toEqual(['4', '5', '6']);
    } else {
      await expect(
        page.getByText('In this shape there is no close-position triad on these strings')
      ).toBeVisible();
    }
  });

  test('US5-3: 7-string selector lists 7-6-5 first', async ({ page }) => {
    await seedPrefs(page, { strings: 7, tuning: 'AF-21' });
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'A').click();
    await layerSwitch(page, 'Triad').click();
    const options = await sets(page)
      .getByRole('radio')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? '')
      );
    expect(options[0]).toMatch(/^(Strings )?7-6-5/);
    expect(options).toHaveLength(5);
  });

  test('US5-4: non-compatible tuning disables the switch and keeps the state on return', async ({
    page
  }) => {
    const openPanel = async () => {
      await page
        .getByRole('button', { name: /strings · |^Tuning:|^Temporary tuning:|^Instrument/ })
        .first()
        .click();
      const dialog = page.getByRole('dialog', { name: 'Instrument' });
      await expect(dialog).toBeVisible();
      return dialog;
    };
    const confirm = async () => {
      await page.getByRole('button', { name: 'Confirm' }).click();
      await expect(page.getByRole('dialog', { name: 'Instrument' })).toBeHidden();
    };
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'A').click();
    await layerSwitch(page, 'Triad').click();
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await (await openPanel()).getByRole('radio', { name: /^Open G/ }).check();
    await confirm();
    await expect(page.getByRole('status').filter({ hasText: 'Open G' })).toBeVisible();
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-disabled', 'true');
    await expect(sets(page)).toHaveCount(0);
    await (await openPanel()).getByRole('radio', { name: /^Standard/ }).check();
    await confirm();
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('caged triad polish: accessibility and persistence', () => {
  const openButton = (page: Page) =>
    page.getByRole('button', { name: 'Open in Triads', exact: true });
  const rawPrefs = (page: Page) =>
    page.evaluate(() => localStorage.getItem('fretboard-master:prefs'));

  /** G shape: 3-2-1 is a disabled set, 6-5-4 drawn, shortcut shown. */
  async function gShapeTriad(page: Page): Promise<void> {
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'G').click();
    await layerSwitch(page, 'Triad').click();
    await expect(triadMarkers(page)).toHaveCount(3);
  }

  test('T051: axe clean with Triad on, a disabled set and Open in Triads shown', async ({
    page
  }) => {
    await gShapeTriad(page);
    await expect(
      sets(page).getByRole('radio', { name: 'Strings 3-2-1, unavailable', exact: true })
    ).toHaveAttribute('aria-disabled', 'true');
    await expect(openButton(page)).toBeVisible();
    await runAxe(page);
  });

  test('T051: keyboard-only pass over switch, set entries and shortcut', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'A').click();
    await layerSwitch(page, 'Triad').focus();
    await page.keyboard.press('Space');
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await expect(triadMarkers(page)).toHaveCount(3);
    await setOption(page, '3-2-1').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(setOption(page, '4-3-2')).toBeChecked();
    await expect(triadMarkers(page)).toHaveCount(3);
    await openButton(page).focus();
    await expect(openButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
  });

  test('T051: 200% zoom wraps without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await gShapeTriad(page);
    await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'));
    await expectNoHorizontalScroll(page);
    await expect(openButton(page)).toBeVisible();
    await openButton(page).scrollIntoViewIfNeeded();
    const box = await openButton(page).boundingBox();
    expect((box?.x ?? -1) >= 0).toBe(true);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  });

  test('T052: CAGED → Triads → CAGED keeps Triad on and the set', async ({ page }) => {
    await aShapeTriad(page);
    await setOption(page, '4-3-2').click();
    await page
      .getByRole('navigation')
      .first()
      .getByRole('link', { name: 'Triads', exact: true })
      .click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await page
      .getByRole('navigation')
      .first()
      .getByRole('link', { name: 'CAGED', exact: true })
      .click();
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await expect(setOption(page, '4-3-2')).toBeChecked();
    expect(await triadKeys(page)).toEqual(['2:5', '3:5', '4:5']);
  });

  test('T052: reload of the synced address keeps Triad on (ADR 0021)', async ({ page }) => {
    await aShapeTriad(page);
    const before = await triadKeys(page);
    // The address bar follows the view after a 150 ms debounce; reload once it carries the link.
    await expect(page).toHaveURL(/\/caged\?v=1&/);
    await page.reload();
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await expect(setOption(page, '3-2-1')).toBeChecked();
    expect(await triadKeys(page)).toEqual(before);
  });

  test('T052: opening /caged without a link turns Triad off (Chord only)', async ({ page }) => {
    await aShapeTriad(page);
    await page.goto('/caged');
    await expandDetails(page);
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'false');
    await expect(layerSwitch(page, 'Chord')).toHaveAttribute('aria-checked', 'true');
    await expect(sets(page)).toHaveCount(0);
    await expect(triadMarkers(page)).toHaveCount(0);
  });

  test('T052: Reset tool turns Triad off', async ({ page }) => {
    await aShapeTriad(page);
    await page.getByRole('button', { name: 'Reset tool' }).click();
    await expect(layerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'false');
    await expect(triadMarkers(page)).toHaveCount(0);
  });

  test('T052: prefs record in localStorage is byte-identical after Triad use', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await shape(page, 'A').click();
    const before = await rawPrefs(page);
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
    await layerSwitch(page, 'Triad').click();
    await setOption(page, '4-3-2').click();
    await shape(page, 'G').click();
    await layerSwitch(page, 'Triad').click();
    expect(await rawPrefs(page)).toBe(before);
    expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(keysBefore);
  });
});
