import { expect, test, type Page } from '@playwright/test';

import { runAxe } from './support/helpers';

const selector = (page: Page) => page.getByRole('group', { name: 'Choose notes' });
const note = (page: Page, name: string) =>
  selector(page).getByRole('button', { name, exact: true });
const detected = (page: Page) => page.locator('#notes-detected-triad');
const viewAsTriadButton = (page: Page) =>
  page.getByRole('button', { name: 'View as triad', exact: true });

async function pick(page: Page, ...names: string[]) {
  for (const n of names) await note(page, n).click();
}

test.describe('linked tools: find a triad from selected notes (US1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
  });

  test('C–E–G names C major and View as triad opens Triads on C major', async ({ page }) => {
    await pick(page, 'C', 'E', 'G');
    await expect(detected(page)).toContainText('C major');
    await viewAsTriadButton(page).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
  });

  test('G♯, C, E is G♯ augmented, shown with B♯ and D𝄪', async ({ page }) => {
    await pick(page, 'G sharp or A flat', 'C', 'E');
    await expect(detected(page)).toContainText('G♯ augmented');
    await viewAsTriadButton(page).click();
    await expect(page.getByText('G♯ augmented — Root position', { exact: true })).toBeVisible();
    await expect(page.getByText(/B♯/).first()).toBeVisible();
    await expect(page.getByText(/D𝄪/).first()).toBeVisible();
  });

  test('C–D–E shows no name, no button and no message', async ({ page }) => {
    await pick(page, 'C', 'D', 'E');
    await expect(detected(page)).toHaveCount(0);
    await expect(viewAsTriadButton(page)).toHaveCount(0);
  });

  test('removing a note makes the name disappear', async ({ page }) => {
    await pick(page, 'C', 'E', 'G');
    await expect(detected(page)).toBeVisible();
    await note(page, 'G').click();
    await expect(detected(page)).toHaveCount(0);
  });

  test('E, G♯, C names E augmented (root is the first-selected note)', async ({ page }) => {
    await pick(page, 'E', 'G sharp or A flat', 'C');
    await expect(detected(page)).toContainText('E augmented');
  });

  test('C♯, F, G♯ is C♯ major and Triads spells C♯–E♯–G♯', async ({ page }) => {
    await pick(page, 'C sharp or D flat', 'F', 'G sharp or A flat');
    await expect(detected(page)).toContainText('C♯ major');
    await viewAsTriadButton(page).click();
    await expect(page.getByText('C♯ major — Root position', { exact: true })).toBeVisible();
    await expect(page.getByText(/E♯/).first()).toBeVisible();
  });

  test('Notes page has zero axe violations with the button visible', async ({ page }) => {
    await pick(page, 'C', 'E', 'G');
    await expect(viewAsTriadButton(page)).toBeVisible();
    await runAxe(page);
  });
});

const nav = (page: Page) => page.getByRole('navigation', { name: 'Tools' });
const rootButton = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Root' }).getByRole('button', { name, exact: true });
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });

test.describe('linked tools: nav carries notes and triads (US2)', () => {
  test('A + 1st inversion + 4-3-2 → Notes A → Triads keeps all but the root', async ({ page }) => {
    await page.goto('/triads');
    await radio(page, '1st inversion').click();
    await radio(page, '4-3-2').click();
    await nav(page).getByRole('link', { name: 'Fretboard Notes' }).click();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    // Arriving from Triads carries C–E–G; clear it so only A is selected.
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await note(page, 'A').click();
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(page.getByText('A major — 1st inversion', { exact: true })).toBeVisible();
    await expect(radio(page, '4-3-2')).toBeChecked();
  });

  test('Triads C major → Notes shows C, E, G and "C major"', async ({ page }) => {
    await page.goto('/triads');
    await nav(page).getByRole('link', { name: 'Fretboard Notes' }).click();
    await expect(note(page, 'C')).toHaveAttribute('aria-pressed', 'true');
    await expect(note(page, 'E')).toHaveAttribute('aria-pressed', 'true');
    await expect(note(page, 'G')).toHaveAttribute('aria-pressed', 'true');
    await expect(detected(page)).toContainText('C major');
  });

  test('nothing selected → Triads opens in its last state', async ({ page }) => {
    await page.goto('/triads');
    await rootButton(page, 'D').click();
    await nav(page).getByRole('link', { name: 'Fretboard Notes' }).click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(page.getByText('D major — Root position', { exact: true })).toBeVisible();
  });

  test('home card opens the tool without a carry', async ({ page }) => {
    await page.goto('/notes');
    await note(page, 'A').click();
    await nav(page).getByRole('link', { name: 'Home' }).click();
    await page.getByRole('link', { name: /^Triads/ }).click();
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
  });

  test('Back and Forward do not re-apply a carry; reload gives the initial state', async ({
    page
  }) => {
    await page.goto('/notes');
    await note(page, 'A').click();
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(page.getByText('A major — Root position', { exact: true })).toBeVisible();
    await rootButton(page, 'D').click();
    await page.goBack();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    await page.goForward();
    await expect(page.getByText('D major — Root position', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
  });

  test('G♯ only with augmented → A♭ augmented', async ({ page }) => {
    await page.goto('/triads');
    await radio(page, 'augmented').click();
    await nav(page).getByRole('link', { name: 'Fretboard Notes' }).click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await note(page, 'G sharp or A flat').click();
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(page.getByText('A♭ augmented — Root position', { exact: true })).toBeVisible();
  });

  test('a user-switched D♭ is kept when C♯/D♭ is carried', async ({ page }) => {
    await page.goto('/triads');
    await rootButton(page, 'C sharp or D flat').click();
    await page.getByRole('button', { name: /switch to/i }).click();
    const heading = page.getByText(/(C♯|D♭) major — Root position/);
    const before = await heading.textContent();
    await nav(page).getByRole('link', { name: 'Fretboard Notes' }).click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await note(page, 'C sharp or D flat').click();
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(heading).toHaveText(before ?? '');
  });

  test('carried notes outside the filters show the empty-region guidance (EC-4.4)', async ({
    page
  }) => {
    await page.goto('/triads');
    await rootButton(page, 'F').click();
    // Carry F–A–C to Notes, then keep only the low E string on frets 0–4: A and C are not there.
    await nav(page).getByRole('link', { name: 'Fretboard Notes' }).click();
    await page.getByRole('button', { name: '0–4', exact: true }).click();
    for (const n of [1, 2, 3, 4, 5]) {
      await page
        .getByRole('group', { name: 'Strings' })
        .getByRole('button')
        .nth(n - 1)
        .click();
    }
    await expect(page.getByText(/not in this region|There is no/).first()).toBeVisible();
  });
});

const cell = (page: Page, string: number, fret: number) =>
  page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);
const card = (page: Page) => page.locator('section[aria-labelledby="notes-card-title"]');
const triadsFromNote = (page: Page) =>
  card(page).getByRole('button', { name: 'Triads from this note', exact: true });

test.describe('linked tools: Triads from this note (US3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  });

  test('tap an F♯ position → card → Triads from this note → Triads root F♯', async ({ page }) => {
    await cell(page, 1, 2).click();
    await expect(card(page)).toBeVisible();
    await triadsFromNote(page).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(page.getByText('F♯ major — Root position', { exact: true })).toBeVisible();
  });

  test('with a multi-note selection the focused note is still the root', async ({ page }) => {
    await pick(page, 'C', 'E', 'G');
    await cell(page, 1, 2).click();
    await triadsFromNote(page).click();
    await expect(page.getByText('F♯ major — Root position', { exact: true })).toBeVisible();
  });

  test('keyboard-only Enter works', async ({ page }) => {
    await cell(page, 1, 2).focus();
    await page.keyboard.press('Enter');
    await expect(card(page)).toBeVisible();
    await triadsFromNote(page).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(page.getByText('F♯ major — Root position', { exact: true })).toBeVisible();
  });

  test('open card has zero axe violations', async ({ page }) => {
    await cell(page, 1, 2).click();
    await expect(triadsFromNote(page)).toBeVisible();
    await runAxe(page);
  });
});

test.describe('linked tools: session memory and Reset tool (US4)', () => {
  test('a changed Triads tool is as left after visiting Notes', async ({ page }) => {
    await page.goto('/triads');
    await rootButton(page, 'A').click();
    await radio(page, 'minor').click();
    await radio(page, '1st inversion').click();
    await nav(page).getByRole('link', { name: 'Notes' }).click();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(radio(page, 'minor')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, '1st inversion')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('A minor — 1st inversion', { exact: true })).toBeVisible();
  });

  test('Reset tool keeps instrument, language and notation and leaves the other tool alone', async ({
    page
  }) => {
    await page.goto('/notes');
    await pick(page, 'C', 'D');
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await radio(page, 'minor').click();
    await page.getByRole('button', { name: 'Reset tool', exact: true }).click();
    await expect(radio(page, 'major')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('region', { name: 'Fretboard' }).getByRole('gridcell')).toHaveCount(
      138
    );
    await nav(page).getByRole('link', { name: 'Home' }).click();
    await page.getByRole('link', { name: /^Fretboard Notes/ }).click();
    await expect(note(page, 'C')).toHaveAttribute('aria-pressed', 'true');
    await expect(note(page, 'D')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Q9: Reset tool in Triads, via Home and back → initial Triads, Notes unchanged', async ({
    page
  }) => {
    await page.goto('/notes');
    await pick(page, 'E');
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await radio(page, 'minor').click();
    await page.getByRole('button', { name: 'Reset tool', exact: true }).click();
    await nav(page).getByRole('link', { name: 'Home' }).click();
    // Triads is the last tool, so its card reads "Continue: Triads…" (010 US1-2).
    await page.getByRole('link', { name: /^(Continue: )?Triads/ }).click();
    await expect(radio(page, 'major')).toHaveAttribute('aria-checked', 'true');
    await nav(page).getByRole('link', { name: 'Home' }).click();
    await page.getByRole('link', { name: /^Fretboard Notes/ }).click();
    await expect(note(page, 'E')).toHaveAttribute('aria-pressed', 'true');
  });
});

const historyLength = (page: Page) => page.evaluate(() => window.history.length);

test.describe('linked tools: history only follows screens (US5)', () => {
  test('20 mixed in-tool changes, carries and resets add no history entry (SC-003)', async ({
    page
  }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /^Notes|^Fretboard Notes/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    await pick(page, 'A');
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    const before = await historyLength(page);

    const changes: Array<() => Promise<unknown>> = [
      () => rootButton(page, 'D').click(),
      () => radio(page, 'minor').click(),
      () => radio(page, '1st inversion').click(),
      () => radio(page, '4-3-2').click(),
      () => radio(page, 'augmented').click(),
      () => rootButton(page, 'G').click(),
      () => radio(page, '2nd inversion').click(),
      () => radio(page, '3-2-1').click(),
      () => radio(page, 'diminished').click(),
      () => rootButton(page, 'E').click(),
      () => page.getByRole('button', { name: 'Reset tool', exact: true }).click(),
      () => radio(page, 'minor').click(),
      () => radio(page, 'Full neck').click(),
      () => radio(page, 'major').click(),
      () => radio(page, 'Root position').click(),
      () => rootButton(page, 'F').click(),
      // current-tool nav link replaces state instead of pushing
      () => nav(page).getByRole('link', { name: 'Triads' }).click(),
      () => radio(page, 'minor').click(),
      () => page.getByRole('button', { name: 'Reset tool', exact: true }).click(),
      () => rootButton(page, 'B').click()
    ];
    expect(changes).toHaveLength(20);
    for (const change of changes) await change();

    expect(await historyLength(page)).toBe(before);
    await page.goBack();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Home → Notes → (nav carry) Triads → Back → Notes → Back → Home (Q10)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Notes/ }).first().click();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    await pick(page, 'A');
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(page.getByText('A major — Root position', { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('View as triad adds exactly one history entry; the carry adds none (FR-015)', async ({
    page
  }) => {
    await page.goto('/notes');
    await pick(page, 'C', 'E', 'G');
    const before = await historyLength(page);
    await viewAsTriadButton(page).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    expect(await historyLength(page)).toBe(before + 1);
    await page.goBack();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
  });

  test('Triads from this note adds exactly one history entry; the carry adds none (FR-015)', async ({
    page
  }) => {
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await cell(page, 1, 2).click();
    await expect(card(page)).toBeVisible();
    const before = await historyLength(page);
    await triadsFromNote(page).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await expect(page.getByText('F♯ major — Root position', { exact: true })).toBeVisible();
    expect(await historyLength(page)).toBe(before + 1);
    await page.goBack();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
  });
});

test.describe('linked tools: CAGED triad round trip (018 US3)', () => {
  test('Open in Triads then Back returns to CAGED with Triad on, same set and focus', async ({
    page
  }) => {
    await page.goto('/caged');
    await page
      .getByRole('radiogroup', { name: 'Shape' })
      .getByRole('radio', { name: 'A', exact: true })
      .click();
    await page
      .getByRole('group', { name: 'Layers' })
      .getByRole('switch', { name: 'Triad', exact: true })
      .click();
    await page
      .getByRole('radiogroup', { name: 'Triad strings' })
      .getByRole('radio', { name: '4-3-2', exact: true })
      .click();
    await page.getByRole('button', { name: 'Open in Triads', exact: true }).click();
    await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/caged(\?v=1&.*)?$/);
    await expect(
      page
        .getByRole('group', { name: 'Layers' })
        .getByRole('switch', { name: 'Triad', exact: true })
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      page
        .getByRole('radiogroup', { name: 'Triad strings' })
        .getByRole('radio', { name: '4-3-2', exact: true })
    ).toBeChecked();
    await expect(
      page.getByRole('radiogroup', { name: 'Shape' }).getByRole('radio', { name: 'A', exact: true })
    ).toBeChecked();
  });
});

const cagedKey = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Key' }).getByRole('button', { name, exact: true });
const cagedQuality = (page: Page, name: 'Major' | 'Minor') =>
  page.getByRole('radiogroup', { name: 'Quality' }).getByRole('radio', { name, exact: true });
const tool = (page: Page, name: string) => nav(page).getByRole('link', { name, exact: true });

test.describe('linked tools: CAGED carry (019 US3)', () => {
  test('Notes (B♭ only) → CAGED B♭ with the previous quality', async ({ page }) => {
    await page.goto('/caged');
    await cagedQuality(page, 'Minor').click();
    await tool(page, 'Fretboard Notes').click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await note(page, 'A sharp or B flat').click();
    await tool(page, 'CAGED').click();
    await expect(cagedKey(page, 'A sharp or B flat')).toHaveAttribute('aria-pressed', 'true');
    await expect(cagedQuality(page, 'Minor')).toBeChecked();
  });

  test('CAGED A minor → Notes with A, C and E selected', async ({ page }) => {
    await page.goto('/caged');
    await cagedKey(page, 'A').click();
    await cagedQuality(page, 'Minor').click();
    await tool(page, 'Fretboard Notes').click();
    for (const n of ['A', 'C', 'E']) {
      await expect(note(page, n)).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(detected(page)).toContainText('A minor');
  });

  test('Triads B diminished → CAGED B major', async ({ page }) => {
    await page.goto('/triads');
    await rootButton(page, 'B').click();
    await radio(page, 'diminished').click();
    await tool(page, 'CAGED').click();
    await expect(cagedKey(page, 'B')).toHaveAttribute('aria-pressed', 'true');
    await expect(cagedQuality(page, 'Major')).toBeChecked();
  });

  test('CAGED D major → Triads D major with inversion and set unchanged', async ({ page }) => {
    await page.goto('/triads');
    await radio(page, '1st inversion').click();
    await tool(page, 'CAGED').click();
    await cagedKey(page, 'D').click();
    await tool(page, 'Triads').click();
    await expect(page.getByText('D major — 1st inversion', { exact: true })).toBeVisible();
  });

  test('Notes with two notes → CAGED as left', async ({ page }) => {
    await page.goto('/caged');
    await cagedKey(page, 'G').click();
    await tool(page, 'Fretboard Notes').click();
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await pick(page, 'A', 'D');
    await tool(page, 'CAGED').click();
    await expect(cagedKey(page, 'G')).toHaveAttribute('aria-pressed', 'true');
  });

  test('reload, Back/Forward and deep links never carry', async ({ page }) => {
    await page.goto('/notes');
    await note(page, 'F').click();
    await tool(page, 'CAGED').click();
    await expect(cagedKey(page, 'F')).toHaveAttribute('aria-pressed', 'true');
    await cagedKey(page, 'E').click();
    await page.goBack();
    await page.goForward();
    await expect(cagedKey(page, 'E')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(cagedKey(page, 'C')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/notes');
    await expect(note(page, 'F')).toHaveAttribute('aria-pressed', 'false');
  });

  test('A♯ major shows the Switch to B♭ guidance and 𝄪 where needed', async ({ page }) => {
    await page.goto('/triads');
    await rootButton(page, 'A sharp or B flat').click();
    const sw = page.getByRole('button', { name: /switch to/i });
    if (!/B♭/.test((await sw.textContent()) ?? '')) await sw.click();
    await tool(page, 'CAGED').click();
    await expect(cagedKey(page, 'A sharp or B flat')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Switch to B♭', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'Note names', exact: true }).click();
    await expect(page.getByText(/C𝄪/).first()).toBeVisible();
  });
});

const cagedLayerSwitch = (page: Page, name: string) =>
  page.getByRole('switch', { name, exact: true });
const viewInCaged = (page: Page) =>
  page.getByRole('button', { name: 'View in CAGED', exact: true });
const cagedInThisKey = (page: Page) =>
  card(page).getByRole('button', { name: 'CAGED in this key', exact: true });
const unavailableNote = (page: Page) =>
  page.getByText('CAGED covers major and minor chords', { exact: true });

test.describe('linked tools: CAGED shortcuts (019 US4)', () => {
  test('Notes position card on a G → CAGED in this key → CAGED in G; Back returns in one step', async ({
    page
  }) => {
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await cell(page, 1, 3).click(); // string 1, fret 3 = G
    await expect(card(page)).toBeVisible();
    await cagedInThisKey(page).click();
    await expect(page).toHaveURL(/\/caged(\?v=1&.*)?$/);
    await expect(cagedKey(page, 'G')).toHaveAttribute('aria-pressed', 'true');
    await page.goBack();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
  });

  test('Triads B♭ minor → View in CAGED → CAGED B♭ minor, Triad on, a shape focused', async ({
    page
  }) => {
    await page.goto('/triads');
    await rootButton(page, 'A sharp or B flat').click();
    await radio(page, 'minor').click();
    await viewInCaged(page).click();
    await expect(page).toHaveURL(/\/caged(\?v=1&.*)?$/);
    await expect(cagedKey(page, 'A sharp or B flat')).toHaveAttribute('aria-pressed', 'true');
    await expect(cagedQuality(page, 'Minor')).toBeChecked();
    await expect(cagedLayerSwitch(page, 'Triad')).toHaveAttribute('aria-checked', 'true');
    await expect(
      page
        .getByRole('radiogroup', { name: 'Shape' })
        .getByRole('radio', { name: 'See all', exact: true })
    ).not.toBeChecked();
  });

  for (const [quality, root] of [
    ['augmented', 'C'],
    ['diminished', 'B']
  ] as const) {
    test(`Triads ${root} ${quality}: View in CAGED is focusable, does nothing, note visible`, async ({
      page
    }) => {
      await page.goto('/triads');
      await rootButton(page, root).click();
      await radio(page, quality).click();
      const btn = viewInCaged(page);
      await expect(btn).toHaveAttribute('aria-disabled', 'true');
      await expect(unavailableNote(page)).toBeVisible();
      await btn.focus();
      await expect(btn).toBeFocused();
      await btn.click({ force: true }); // aria-disabled: Playwright treats as not enabled
      await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe clean: Notes card and Triads View in CAGED enabled and disabled (${colorScheme})`, async ({
      page
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/notes');
      await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
      await cell(page, 1, 3).click();
      await expect(cagedInThisKey(page)).toBeVisible();
      await runAxe(page);
      await page.goto('/triads');
      await expect(viewInCaged(page)).toHaveAttribute('aria-disabled', 'false');
      await runAxe(page);
      await radio(page, 'augmented').click();
      await expect(unavailableNote(page)).toBeVisible();
      await runAxe(page);
    });
  }
});
