import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, readAudioLog, runAxe } from './support/helpers';

const selector = (page: Page) => page.getByRole('group', { name: 'Choose notes' });
const note = (page: Page, name: string) =>
  selector(page).getByRole('button', { name, exact: true });
const board = (page: Page) => page.getByRole('grid', { name: 'Fretboard' });
const markers = (page: Page, emphasis: string) => board(page).locator(`.marker.${emphasis}`);
const description = (page: Page) => page.locator('.description');

async function expectInitialView(page: Page) {
  await expect(selector(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(markers(page, 'highlighted')).toHaveCount(0);
  await expect(markers(page, 'normal').first()).toBeVisible();
  await expect(board(page).locator('.marker.normal text.marker-label').first()).toBeVisible();
  await expect(board(page).locator('.region-band')).toHaveCount(0);
  await expect(description(page)).toHaveText(
    'Showing natural notes, strings 1 to 6, frets 0 to 22.'
  );
}

test.describe('notes tool: find every occurrence (US1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
  });

  test('US1-1: initial view shows labeled naturals and nothing selected', async ({ page }) => {
    await expectInitialView(page);
    await expect(selector(page).getByRole('button')).toHaveCount(12);
    // no altered marker is drawn: 7 natural pitch classes only
    const labels = await board(page).locator('.marker text.marker-label').allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => /^[A-G]$/.test(l))).toBe(true);
  });

  test('US1-2: G highlights 12 positions in four tones with octave badges 2–5', async ({
    page
  }) => {
    await note(page, 'G').click();
    await expect(note(page, 'G')).toHaveAttribute('aria-pressed', 'true');
    const highlighted = markers(page, 'highlighted');
    await expect(highlighted).toHaveCount(12);
    for (const n of [2, 3, 4, 5]) {
      await expect(board(page).locator(`.marker.highlighted.tone-${n}`).first()).toBeVisible();
    }
    for (const n of [1, 6, 7]) {
      await expect(board(page).locator(`.marker.highlighted.tone-${n}`)).toHaveCount(0);
    }
    const badges = await board(page)
      .locator('.marker.highlighted text.octave-badge')
      .allTextContents();
    expect(badges.sort()).toEqual(['2', '3', '3', '3', '3', '4', '4', '4', '4', '4', '5', '5']);
    await expect(markers(page, 'dimmed').first()).toBeVisible();
    await expect(description(page)).toContainText('G selected: 12 positions highlighted');
    await expect(description(page)).toHaveText(
      /^G selected: 12 positions highlighted, strings 1 to 6, frets 0 to 22\./
    );
  });

  test('US1-3: selecting G again returns to the initial view', async ({ page }) => {
    await note(page, 'G').click();
    await note(page, 'G').click();
    await expect(note(page, 'G')).toHaveAttribute('aria-pressed', 'false');
    await expectInitialView(page);
  });

  test('US1-4: two notes highlight without tones or badges', async ({ page }) => {
    await note(page, 'C').click();
    await note(page, 'E').click();
    const highlighted = markers(page, 'highlighted');
    expect(await highlighted.count()).toBeGreaterThan(0);
    await expect(board(page).locator('.marker[class*="tone-"]')).toHaveCount(0);
    await expect(board(page).locator('text.octave-badge')).toHaveCount(0);
    await expect(description(page)).toContainText('C and E selected');
  });

  test('US1-5: at 320 px the selector is 2 rows × 6 and the page does not scroll sideways', async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/notes');
    const tops = await selector(page)
      .getByRole('button')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(2);
    expect(tops.filter((t) => t === tops[0])).toHaveLength(6);
    const sizes = await selector(page)
      .getByRole('button')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return Math.min(r.width, r.height);
        })
      );
    for (const s of sizes) expect(s).toBeGreaterThanOrEqual(43.5);
    await expectNoHorizontalScroll(page);
  });

  test('US1-5b: at 1280 px the selector is one row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/notes');
    const tops = await selector(page)
      .getByRole('button')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });

  test('US1-6: all 12 notes selected highlight every position', async ({ page }) => {
    const names = [
      'C',
      'C sharp or D flat',
      'D',
      'D sharp or E flat',
      'E',
      'F',
      'F sharp or G flat',
      'G',
      'G sharp or A flat',
      'A',
      'A sharp or B flat',
      'B'
    ];
    for (const name of names) await note(page, name).click();
    await expect(markers(page, 'highlighted')).toHaveCount(138);
    await expect(markers(page, 'dimmed')).toHaveCount(0);
  });

  for (const width of [320, 1280]) {
    test(`axe: no violations at ${width} px (initial and G selected)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/notes');
      await runAxe(page);
      await note(page, 'G').click();
      await expect(markers(page, 'highlighted')).toHaveCount(12);
      await runAxe(page);
      await note(page, 'C').click();
      await runAxe(page);
    });
  }
});

const cell = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);
const card = (page: Page) => page.locator('section[aria-labelledby="notes-card-title"]');
const cardTitle = (page: Page) => page.locator('#notes-card-title');

async function steps(page: Page) {
  return (await readAudioLog(page)).filter((e) => e.type === 'step');
}

test.describe('notes tool: tap a position (US2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
    await board(page).waitFor();
  });

  test('US2-1: activating s3f2 plays A3 and opens the card with 4 highlighted markers', async ({
    page
  }) => {
    await cell(page, 3, 2).click();
    await expect.poll(async () => (await steps(page)).length).toBe(1);
    const step = (await steps(page))[0];
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.kind).toBe('note');
    expect(step.pitches).toEqual([57]);

    await expect(card(page)).toBeVisible();
    await expect(cardTitle(page)).toHaveText('A');
    await expect(card(page).locator('dl')).toContainText('Octave');
    await expect(card(page).locator('dl')).toContainText('3');
    const entries = await card(page).getByRole('listitem').allTextContents();
    expect(entries.map((t) => t.trim())).toEqual([
      'String 4, fret 7',
      'String 5, fret 12',
      'String 6, fret 17'
    ]);
    await expect(markers(page, 'highlighted')).toHaveCount(4);
    for (const [str, fret] of [
      [3, 2],
      [4, 7],
      [5, 12],
      [6, 17]
    ]) {
      await expect(
        board(page).locator(`.cell[data-string="${str}"][data-fret="${fret}"]`)
      ).toBeVisible();
    }
    await expect(description(page)).toContainText('Position card: A3, string 3, fret 2');
  });

  test('US2-2: Escape and Close return focus to cell s3f2', async ({ page }) => {
    await cell(page, 3, 2).focus();
    await page.keyboard.press('Enter');
    await expect(card(page)).toBeVisible();
    await expect(cell(page, 3, 2)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveCount(0);
    await expect(markers(page, 'highlighted')).toHaveCount(0);
    await expect(cell(page, 3, 2)).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(card(page)).toBeVisible();
    await card(page).getByRole('button', { name: 'Close position card' }).click();
    await expect(card(page)).toHaveCount(0);
    await expect(cell(page, 3, 2)).toBeFocused();
  });

  test('US2-3: an altered position shows both spellings', async ({ page }) => {
    await cell(page, 5, 4).click();
    await expect(cardTitle(page)).toHaveText('C♯ / D♭');
    await expect(cardTitle(page)).toHaveAttribute('aria-label', 'C sharp or D flat');
  });

  test('US2-4: a pitch with no unison says so', async ({ page }) => {
    await cell(page, 6, 0).click();
    await expect(card(page)).toContainText('Open');
    await expect(card(page)).toContainText('This pitch exists only at this position');
    await expect(card(page).getByRole('listitem')).toHaveCount(0);
  });

  test('US2-5: See every occurrence adds the note once and keeps the card open', async ({
    page
  }) => {
    await cell(page, 3, 2).click();
    const see = card(page).getByRole('button', { name: 'See every occurrence' });
    await see.click();
    await expect(note(page, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page)).toBeVisible();
    const before = await description(page).textContent();
    await see.click();
    await expect(note(page, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(selector(page).locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(card(page)).toBeVisible();
    await expect(description(page)).toHaveText(before ?? '');
  });

  test('US2-6: arrow keys to s3f2 then Enter behave like a tap', async ({ page }) => {
    await cell(page, 1, 0).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(cell(page, 3, 2)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await steps(page)).length).toBe(1);
    const step = (await steps(page))[0];
    if (step?.type !== 'step') throw new Error('no step entry');
    expect(step.pitches).toEqual([57]);
    await expect(cardTitle(page)).toHaveText('A');
    await expect(markers(page, 'highlighted')).toHaveCount(4);
  });

  for (const width of [320, 1280]) {
    test(`axe: no violations at ${width} px with the card open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/notes');
      await cell(page, 3, 2).click();
      await expect(card(page)).toBeVisible();
      await runAxe(page);
      await expectNoHorizontalScroll(page);
    });
  }
});

const strings = (page: Page) => page.getByRole('group', { name: 'Strings' });
const stringBtn = (page: Page, name: string) =>
  strings(page).getByRole('button', { name, exact: true });
const frets = (page: Page) => page.getByRole('group', { name: 'Frets' });
const startFret = (page: Page) => frets(page).getByRole('spinbutton', { name: 'Start fret' });
const endFret = (page: Page) => frets(page).getByRole('spinbutton', { name: 'End fret' });
const notice = (page: Page) => page.getByRole('status');

test.describe('notes tool: string and region filters (US3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
  });

  test('US3-1: strings 1–5 off dims and unlabels them; string 6 stays on and is aria-disabled', async ({
    page
  }) => {
    for (let n = 1; n <= 5; n++) {
      await stringBtn(
        page,
        `String ${n}, ${n === 1 ? 'E' : ['', '', 'B', 'G', 'D', 'A'][n]}`
      ).click();
    }
    const last = stringBtn(page, 'String 6, E');
    await expect(last).toHaveAttribute('aria-pressed', 'true');
    await expect(last).toHaveAttribute('aria-disabled', 'true');
    await last.click({ force: true });
    await expect(last).toHaveAttribute('aria-pressed', 'true');
    await expect(board(page).locator('.marker.dimmed')).not.toHaveCount(0);
    await expect(board(page).locator('.marker.dimmed text.marker-label')).toHaveCount(0);
    await expect(board(page).locator('.marker.normal').first()).toBeVisible();
    await expect(description(page)).toContainText('string 6');
  });

  test('US3-2: Start 12 pushes End to 12', async ({ page }) => {
    await frets(page).getByRole('button', { name: '5–9' }).click();
    await expect(startFret(page)).toHaveAttribute('aria-valuenow', '5');
    await expect(endFret(page)).toHaveAttribute('aria-valuenow', '9');
    await startFret(page).focus();
    await page.keyboard.press('PageUp');
    await page.keyboard.press('PageUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(startFret(page)).toHaveAttribute('aria-valuenow', '17');
    await frets(page).getByRole('button', { name: '5–9' }).click();
    for (let i = 0; i < 7; i++) {
      await frets(page).getByRole('button', { name: 'Raise start fret' }).click();
    }
    await expect(startFret(page)).toHaveAttribute('aria-valuenow', '12');
    await expect(endFret(page)).toHaveAttribute('aria-valuenow', '12');
  });

  test('US3-3: each shortcut sets the steppers', async ({ page }) => {
    for (const [name, start, end] of [
      ['0–4', '0', '4'],
      ['5–9', '5', '9'],
      ['10–14', '10', '14'],
      ['Whole neck', '0', '22']
    ]) {
      const button = frets(page).getByRole('button', { name });
      await button.click();
      await expect(startFret(page)).toHaveAttribute('aria-valuenow', start);
      await expect(endFret(page)).toHaveAttribute('aria-valuenow', end);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('US3-4: C♯ on string 1 in 0–4 shows a notice; Widen region goes to 0–9', async ({
    page
  }) => {
    await note(page, 'C sharp or D flat').click();
    for (const name of [
      'String 2, B',
      'String 3, G',
      'String 4, D',
      'String 5, A',
      'String 6, E'
    ]) {
      await stringBtn(page, name).click();
    }
    await frets(page).getByRole('button', { name: '0–4' }).click();
    await expect(notice(page)).toContainText('There is no C♯ in this region');
    await notice(page).getByRole('button', { name: 'Widen region' }).click();
    await expect(startFret(page)).toHaveAttribute('aria-valuenow', '0');
    await expect(endFret(page)).toHaveAttribute('aria-valuenow', '9');
    await expect(notice(page)).toHaveCount(0);
    await expect(board(page).locator('.marker.highlighted[data-key="1:9"]')).toHaveCount(1);
    await expect(markers(page, 'highlighted')).toHaveCount(1);
  });

  test('US3-4: notice names up to three notes, else a count, in at most 2 lines', async ({
    page
  }) => {
    for (const w of [320, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/notes');
      for (const name of [
        'String 2, B',
        'String 3, G',
        'String 4, D',
        'String 5, A',
        'String 6, E'
      ]) {
        await stringBtn(page, name).click();
      }
      await frets(page).getByRole('button', { name: '0–4' }).click();
      // string 1 frets 0–4 hold E F F♯ G G♯ → C♯, D, D♯ are missing
      for (const n of ['C sharp or D flat', 'D', 'D sharp or E flat']) await note(page, n).click();
      await expect(notice(page)).toContainText('There is no C♯, D, or D♯ in this region');
      await expectNoticeAtMostTwoLines(page);
      await runAxe(page);
      for (const n of [
        'C',
        'E',
        'F',
        'F sharp or G flat',
        'G',
        'G sharp or A flat',
        'A',
        'A sharp or B flat',
        'B'
      ]) {
        await note(page, n).click();
      }
      await frets(page).getByRole('button', { name: '5–9' }).click();
      await frets(page).getByRole('button', { name: 'Lower start fret' }).click();
      await endFret(page).focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await expect(notice(page)).toContainText('selected notes are not in this region');
      await expectNoticeAtMostTwoLines(page);
      await runAxe(page);
    }
  });

  test('US3-5: region 5–9 dims outside markers, shows the band, and scrolls it into view', async ({
    page
  }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto('/notes');
    await frets(page).getByRole('button', { name: '10–14' }).click();
    await expect(board(page).locator('.region-band')).toHaveCount(1);
    await expect(board(page).locator('.region-band')).toHaveAttribute('aria-hidden', 'true');
    await expect(board(page).locator('.marker.dimmed text.marker-label')).toHaveCount(0);
    await expect(board(page).locator('.marker.normal text.marker-label').first()).toBeVisible();
    await expect(description(page)).toContainText('frets 10 to 14');
    await expect
      .poll(() => page.locator('.scroller').evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await frets(page).getByRole('button', { name: 'Whole neck' }).click();
    await expect(board(page).locator('.region-band')).toHaveCount(0);
  });

  test('axe passes at 320 and 1280 px with the notice visible', async ({ page }) => {
    await note(page, 'C sharp or D flat').click();
    for (const name of [
      'String 2, B',
      'String 3, G',
      'String 4, D',
      'String 5, A',
      'String 6, E'
    ]) {
      await stringBtn(page, name).click();
    }
    await frets(page).getByRole('button', { name: '0–4' }).click();
    await expect(notice(page)).toBeVisible();
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await runAxe(page);
      await expectNoHorizontalScroll(page);
    }
  });
});

async function expectNoticeAtMostTwoLines(page: Page) {
  const lines = await notice(page).evaluate((el) => {
    const p = el.querySelector('p') ?? el;
    const lh = parseFloat(getComputedStyle(p).lineHeight) || 20;
    return Math.round(p.getBoundingClientRect().height / lh);
  });
  // the message text itself wraps to at most two lines; actions may sit on their own row
  expect(lines).toBeLessThanOrEqual(2);
}

test.describe('notes tool: labels and background (US4)', () => {
  const radio = (page: Page, group: string, name: string) =>
    page.getByRole('radiogroup', { name: group }).getByRole('radio', { name, exact: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
  });

  test('scenario 18: a selected altered note shows while other altered notes stay hidden', async ({
    page
  }) => {
    await expect(radio(page, 'Show', 'Natural notes')).toHaveAttribute('aria-checked', 'true');
    await note(page, 'C sharp or D flat').click();
    await expect(markers(page, 'highlighted').first()).toBeVisible();
    const labels = await board(page).locator('.marker.dimmed text.marker-label').allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => /^[A-G]$/.test(l))).toBe(true);
  });

  test('scenario 19: Show all reveals altered notes; Show none hides unselected ones', async ({
    page
  }) => {
    await radio(page, 'Show', 'All notes').click();
    await expect(radio(page, 'Show', 'All notes')).toHaveAttribute('aria-checked', 'true');
    await expect(markers(page, 'hidden')).toHaveCount(0);
    await note(page, 'G').click();
    await radio(page, 'Show', 'None').click();
    await expect(markers(page, 'highlighted')).toHaveCount(12);
    await expect(markers(page, 'normal')).toHaveCount(0);
    await expect(markers(page, 'dimmed')).toHaveCount(0);
  });

  test('scenario 20: Show none with no selection → empty board and guidance', async ({ page }) => {
    await radio(page, 'Show', 'None').click();
    await expect(page.getByText('Pick a note or tap a fret')).toBeVisible();
    await expect(markers(page, 'normal')).toHaveCount(0);
    await expect(markers(page, 'highlighted')).toHaveCount(0);
    await expect(board(page).locator('.marker-label')).toHaveCount(0);
    await note(page, 'C').click();
    await expect(page.getByText('Pick a note or tap a fret')).toHaveCount(0);
  });

  test('scenario 21: No label removes every label', async ({ page }) => {
    await radio(page, 'Label', 'No label').click();
    await expect(radio(page, 'Label', 'No label')).toHaveAttribute('aria-checked', 'true');
    await expect(board(page).locator('.marker-label')).toHaveCount(0);
    await note(page, 'C').click();
    await expect(board(page).locator('.marker-label')).toHaveCount(0);
    await expect(markers(page, 'highlighted').first()).toBeVisible();
  });

  test('scenario 4 (Octave half): C + E then Label Octave → octave labels and tones', async ({
    page
  }) => {
    await note(page, 'C').click();
    await note(page, 'E').click();
    await expect(board(page).locator('.marker.highlighted[class*="tone-"]')).toHaveCount(0);
    await radio(page, 'Label', 'Octave').click();
    await expect(board(page).locator('.marker.highlighted[class*="tone-"]').first()).toBeVisible();
    const labels = await board(page)
      .locator('.marker.highlighted text.marker-label')
      .allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((l) => /^[CE]\d$/.test(l))).toBe(true);
    expect(labels).toContain('C3');
  });

  test('radio groups use roving tabindex and arrow selection; axe at 320 and 1280', async ({
    page
  }) => {
    await radio(page, 'Label', 'Name').focus();
    await page.keyboard.press('ArrowRight');
    await expect(radio(page, 'Label', 'Octave')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, 'Label', 'Octave')).toBeFocused();
    await expect(radio(page, 'Label', 'Name')).toHaveAttribute('tabindex', '-1');
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await runAxe(page);
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe('notes tool: listen, hide names, clear, reset (US5)', () => {
  const radio = (page: Page, group: string, name: string) =>
    page.getByRole('radiogroup', { name: group }).getByRole('radio', { name, exact: true });
  const listen = (page: Page) => page.getByRole('button', { name: 'Listen', exact: true });
  const hideNames = (page: Page) => page.getByRole('button', { name: 'Hide names', exact: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
    await board(page).waitFor();
  });

  test('scenario 22: A + Listen sounds ascending steps, unisons as chords, 0.5 s apart', async ({
    page
  }) => {
    await note(page, 'A').click();
    await listen(page).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBeGreaterThan(3);
    const log = (await readAudioLog(page)).filter((e) => e.type === 'step');
    const steps = log.flatMap((e) => (e.type === 'step' ? [e] : []));
    expect(steps.every((e) => e.kind === 'sequence')).toBe(true);
    const lows = steps.map((e) => Math.min(...e.pitches));
    expect(lows).toEqual([...lows].sort((a, b) => a - b));
    expect(steps[0].pitches).toEqual([45, 45]); // A2: s5f0 + s6f5 sound together, one voice per position
    expect(steps.some((e) => e.pitches.length > 1 || e.frequencies.length > 1)).toBe(true);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].when - steps[i - 1].when).toBeCloseTo(0.5, 2);
    }
    await expect(board(page).locator('.marker.pulse').first()).toBeVisible();
  });

  test('scenario 22 (muted): Listen still pulses', async ({ page }) => {
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await note(page, 'A').click();
    await listen(page).click();
    await expect(board(page).locator('.marker.pulse').first()).toBeVisible();
  });

  test('scenario 23 and 6: Listen is aria-disabled with the reason for 0 and 4 notes', async ({
    page
  }) => {
    await expect(listen(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(listen(page)).toHaveAccessibleDescription('Select one to three notes to listen');
    await listen(page).click({ force: true });
    expect((await readAudioLog(page)).filter((e) => e.type === 'step')).toHaveLength(0);
    for (const n of ['C', 'D', 'E', 'F']) await note(page, n).click();
    await expect(listen(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(listen(page)).toHaveAccessibleDescription('Listen plays up to three notes');
    await note(page, 'F').click();
    await expect(listen(page)).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('scenario 24: Hide names removes labels and the hover hint; the card still names', async ({
    page
  }) => {
    await note(page, 'G').click();
    await hideNames(page).click();
    await expect(hideNames(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(board(page).locator('.marker-label')).toHaveCount(0);
    await expect(board(page).locator('.octave-badge')).toHaveCount(0);
    await board(page).locator('.cell[data-string="3"][data-fret="2"]').hover();
    await expect(board(page).locator('.hover-hint')).toHaveCount(0);
    await board(page).locator('.cell[data-string="3"][data-fret="2"]').click();
    await expect(cardTitle(page)).toHaveText('A');
    await hideNames(page).click();
    await expect(board(page).locator('.marker-label').first()).toBeVisible();
  });

  test('scenario 25: Clear resets selection and filters but keeps Octave and Show all', async ({
    page
  }) => {
    await radio(page, 'Label', 'Octave').click();
    await radio(page, 'Show', 'All notes').click();
    await note(page, 'G').click();
    await page.getByRole('button', { name: 'String 2, B' }).click();
    await page.getByRole('button', { name: '5–9', exact: true }).click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(selector(page).locator('[aria-pressed="true"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'String 2, B' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByRole('spinbutton', { name: 'Start fret' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    );
    await expect(page.getByRole('spinbutton', { name: 'End fret' })).toHaveAttribute(
      'aria-valuenow',
      '22'
    );
    await expect(radio(page, 'Label', 'Octave')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, 'Show', 'All notes')).toHaveAttribute('aria-checked', 'true');
  });

  test('scenario 26: Reset tool equals the initial view', async ({ page }) => {
    await radio(page, 'Label', 'Octave').click();
    await radio(page, 'Show', 'All notes').click();
    await note(page, 'G').click();
    await hideNames(page).click();
    await page.getByRole('button', { name: '5–9', exact: true }).click();
    await board(page).locator('.cell[data-string="3"][data-fret="7"]').click();
    await page.getByRole('button', { name: 'Reset tool', exact: true }).click();
    await expectInitialView(page);
    await expect(hideNames(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(radio(page, 'Label', 'Name')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, 'Show', 'Natural notes')).toHaveAttribute('aria-checked', 'true');
    await expect(card(page)).toHaveCount(0);
  });

  test('scenario 27: changing the selection while listening stops playback (view)', async ({
    page
  }) => {
    await note(page, 'A').click();
    await listen(page).click();
    await expect(board(page).locator('.marker.pulse').first()).toBeVisible();
    await note(page, 'C').click();
    await expect
      .poll(async () =>
        (await readAudioLog(page)).some((e) => e.type === 'stop' && e.reason === 'view')
      )
      .toBe(true);
    await expect(board(page).locator('.marker.pulse')).toHaveCount(0);
  });

  test('scenario 28: selection survives /triads and back; reload resets', async ({ page }) => {
    await note(page, 'G').click();
    const nav = page.getByRole('navigation', { name: 'Tools' });
    await page.getByRole('link', { name: /^Triads/ }).click();
    await expect(page).toHaveURL(/\/triads$/);
    await nav.getByRole('link', { name: 'Fretboard Notes' }).click();
    await expect(note(page, 'G')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expectInitialView(page);
  });

  test('axe at 320 and 1280 with a selection and Listen enabled', async ({ page }) => {
    await note(page, 'A').click();
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await runAxe(page);
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe('notes tool: keyboard only (scenario 29, SC-005)', () => {
  /** Accessible-ish name of the focused element. */
  const focusedName = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return '';
      return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
    });

  test('every control is reachable and operable by keyboard alone', async ({ page }) => {
    await page.goto('/notes');
    await board(page).waitFor();

    // Tab through the whole page, recording each stop.
    const stops = new Set<string>();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      stops.add(await focusedName(page));
    }
    const has = (re: RegExp) => [...stops].some((s) => re.test(s));
    expect(has(/^G$/), 'note selector').toBe(true);
    expect(has(/^String 1/), 'string toggles').toBe(true);
    expect(has(/^0–4$/), 'region shortcuts').toBe(true);
    expect(has(/^Whole neck$/), 'whole neck').toBe(true);
    expect(has(/^Lower start fret$/), 'start stepper').toBe(true);
    expect(has(/^Raise end fret$/), 'end stepper').toBe(true);
    expect(has(/^Hide names$/), 'hide names').toBe(true);
    expect(has(/^Clear$/), 'clear').toBe(true);
    expect(has(/^Reset tool$/), 'reset').toBe(true);
    expect(has(/^Name$/) || has(/^Octave$/), 'label radiogroup').toBe(true);
    expect(has(/^(Natural notes|All notes|None)$/), 'show radiogroup').toBe(true);

    // Operate: select a note, open the card from a cell, listen, and clear.
    await note(page, 'G').focus();
    await page.keyboard.press('Enter');
    await expect(note(page, 'G')).toHaveAttribute('aria-pressed', 'true');

    const cell = page.locator('.cell[data-string="3"][data-fret="2"]');
    await board(page).locator('.cell').first().focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(cell).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Close position card' })).toBeVisible();
    await page.getByRole('button', { name: 'Close position card' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Close position card' })).toHaveCount(0);

    await stringBtn(page, 'String 2, B').focus();
    await page.keyboard.press('Space');
    await expect(stringBtn(page, 'String 2, B')).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: '5–9', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(startFret(page)).toHaveAttribute('aria-valuenow', '5');
    await page.getByRole('button', { name: 'Raise start fret' }).focus();
    await page.keyboard.press('Enter');
    await expect(startFret(page)).toHaveAttribute('aria-valuenow', '6');

    await page.getByRole('radiogroup', { name: 'Label' }).getByRole('radio').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(
      page.getByRole('radiogroup', { name: 'Label' }).getByRole('radio', { name: 'Octave' })
    ).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: 'Hide names', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(board(page).locator('.marker text.marker-label')).toHaveCount(0);

    await page.getByRole('button', { name: 'Listen', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readAudioLog(page)).length).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Clear', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(selector(page).locator('[aria-pressed="true"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset tool', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expectInitialView(page);
  });

  for (const width of [320, 1280]) {
    test(`axe and layout at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/notes');
      await note(page, 'G').focus();
      await page.keyboard.press('Enter');
      await runAxe(page);
      await expectNoHorizontalScroll(page);
    });
  }

  test('200 % zoom at 320 px: no horizontal scroll, controls remain reachable', async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/notes');
    await board(page).waitFor();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'; // CSSOM: allowed under the style-src CSP
      window.dispatchEvent(new Event('resize'));
    });
    await expectNoHorizontalScroll(page);
    await note(page, 'G').focus();
    await page.keyboard.press('Enter');
    await expect(note(page, 'G')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Reset tool', exact: true })).toBeVisible();
  });
});

const PANEL_ADJUSTED = 'We adjusted the view to the new instrument';

const openInstrumentPanel = async (page: Page) => {
  await page
    .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Instrument' });
  await expect(dialog).toBeVisible();
  return dialog;
};

const chooseStrings = async (page: Page, count: 6 | 7) => {
  const dialog = await openInstrumentPanel(page);
  await dialog.getByRole('radio', { name: `${count} strings` }).check();
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(dialog).toBeHidden();
};

test.describe('notes tool: seven strings (012 US2)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Q7: 7-string standard, all notes, frets 0–5 → string 7 shows B C C♯ D D♯ E', async ({
    page
  }) => {
    await page.goto('/notes');
    await chooseStrings(page, 7);
    await page
      .getByRole('radiogroup', { name: 'Show' })
      .getByRole('radio', { name: 'All notes' })
      .click();
    await endFret(page).focus();
    await endFret(page).press('Home');
    for (let i = 0; i < 5; i++) await endFret(page).press('ArrowUp');
    await expect(endFret(page)).toHaveAttribute('aria-valuenow', '5');
    const row7 = board(page).locator('.marker.normal[data-key^="7:"]');
    await expect(row7).toHaveCount(6);
    await expect(row7.locator('text.marker-label')).toHaveText(['B', 'C', 'C♯', 'D', 'D♯', 'E']);
    await expect(stringBtn(page, 'String 7, B')).toBeVisible();
    await runAxe(page);
  });

  test('Q8: Drop A, card on string 7 fret 12 → unisons on string 6 fret 5 and string 5 fret 0', async ({
    page
  }) => {
    await page.goto('/notes');
    const dialog = await openInstrumentPanel(page);
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    await dialog
      .locator('.preset', { has: page.getByRole('radio', { name: /^Drop A:/ }) })
      .locator('input')
      .check();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();
    await board(page).locator('.cell[data-string="7"][data-fret="12"]').click();
    for (const key of ['7:12', '6:5', '5:0']) {
      await expect(board(page).locator(`.marker.highlighted[data-key="${key}"]`)).toHaveCount(1);
    }
    await expect(markers(page, 'highlighted')).toHaveCount(3);
    await expect(description(page)).toContainText('string 7, fret 12');
    await runAxe(page);
  });

  test('Q9: strings 1–3 only → 7 strings → string 7 stays off, no notice', async ({ page }) => {
    await page.goto('/notes');
    for (const n of ['String 4, D', 'String 5, A', 'String 6, E']) {
      await stringBtn(page, n).click();
    }
    await chooseStrings(page, 7);
    for (const n of ['String 1, E', 'String 2, B', 'String 3, G']) {
      await expect(stringBtn(page, n)).toHaveAttribute('aria-pressed', 'true');
    }
    for (const n of ['String 4, D', 'String 5, A', 'String 6, E', 'String 7, B']) {
      await expect(stringBtn(page, n)).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(page.getByText(PANEL_ADJUSTED)).toHaveCount(0);
  });

  test('Q10: only string 7 on → 6 strings → all six on, with the adjusted notice', async ({
    page
  }) => {
    await page.goto('/notes');
    await chooseStrings(page, 7);
    for (const n of [
      'String 1, E',
      'String 2, B',
      'String 3, G',
      'String 4, D',
      'String 5, A',
      'String 6, E'
    ]) {
      await stringBtn(page, n).click();
    }
    await expect(stringBtn(page, 'String 7, B')).toHaveAttribute('aria-pressed', 'true');
    await chooseStrings(page, 6);
    const status = page.getByRole('status').filter({ hasText: PANEL_ADJUSTED });
    await expect(status).toBeVisible();
    await expect(strings(page).getByRole('button')).toHaveCount(6);
    for (const b of await strings(page).getByRole('button').all()) {
      await expect(b).toHaveAttribute('aria-pressed', 'true');
    }
  });
});
