import { expect, test, type Page } from '@playwright/test';

import { expandDetails, expectNoHorizontalScroll, runAxe } from './support/helpers';

const sizes = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'desktop', width: 1280, height: 800 }
];

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const compareToggle = (page: Page) => page.getByRole('button', { name: 'Compare', exact: true });
const compareList = (page: Page) => page.getByRole('radiogroup', { name: 'Compare with' });
const comparisonMarkers = (page: Page) => board(page).locator('.marker.comparison');
const arrows = (page: Page) => board(page).locator('g.arrows .arrow');

async function openTriads(page: Page) {
  await page.goto('/triads');
  await expandDetails(page);
  await expect(board(page).locator('.marker')).toHaveCount(3);
}

async function compareWith(page: Page, quality: string) {
  if ((await compareToggle(page).getAttribute('aria-pressed')) !== 'true') {
    await compareToggle(page).click();
  }
  await compareList(page).getByRole('radio', { name: quality }).click();
}

const arrowLine = (page: Page) => arrows(page).first().locator('line');
const lineDx = async (page: Page) => {
  const line = arrowLine(page);
  return Number(await line.getAttribute('x2')) - Number(await line.getAttribute('x1'));
};

for (const size of sizes) {
  test.describe(`triads Compare (US1) @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US1-1: C major vs minor on 3-2-1: third at two frets, dashed, 1-fret arrow toward the nut', async ({
      page
    }) => {
      await openTriads(page);
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'false');
      await compareToggle(page).click();
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(compareList(page).getByRole('radio', { name: 'minor' })).toBeChecked();
      // Root and fifth appear once; the third appears at fret 5 and fret 4.
      await expect(board(page).locator('.marker')).toHaveCount(4);
      await expect(comparisonMarkers(page)).toHaveCount(1);
      await expect(board(page).locator('.marker[data-key="2:5"]')).toHaveCount(1);
      await expect(board(page).locator('.marker.comparison[data-key="2:4"]')).toHaveCount(1);
      await expect(arrows(page)).toHaveCount(1);
      await expect(arrows(page).first()).toContainText('1 fret');
      expect(await lineDx(page)).toBeLessThan(0); // toward the nut
      // The comparison outline is dashed.
      const dash = await comparisonMarkers(page)
        .locator('.glyph')
        .evaluate((el) => getComputedStyle(el).strokeDasharray);
      expect(dash).not.toBe('none');
    });

    test('US1-2: minor vs diminished moves only the fifth by one fret', async ({ page }) => {
      await openTriads(page);
      await page
        .getByRole('radiogroup', { name: 'Quality' })
        .getByRole('radio', { name: 'minor' })
        .click();
      await compareToggle(page).click();
      await compareWith(page, 'diminished');
      await expect(comparisonMarkers(page)).toHaveCount(1);
      await expect(comparisonMarkers(page).first()).toHaveClass(/fifth/);
      await expect(arrows(page)).toHaveCount(1);
      await expect(arrows(page).first()).toContainText('1 fret');
      expect(await lineDx(page)).toBeLessThan(0);
    });

    test('US1-3: major vs augmented moves only the fifth up one fret', async ({ page }) => {
      await openTriads(page);
      await compareToggle(page).click();
      await compareWith(page, 'augmented');
      await expect(comparisonMarkers(page)).toHaveCount(1);
      await expect(comparisonMarkers(page).first()).toHaveClass(/fifth/);
      await expect(arrows(page).first()).toContainText('1 fret');
      expect(await lineDx(page)).toBeGreaterThan(0); // toward the body
    });

    test('US1-4: the list excludes the current quality', async ({ page }) => {
      await openTriads(page);
      await compareToggle(page).click();
      await expect(compareList(page).getByRole('radio')).toHaveText([
        'minor',
        'diminished',
        'augmented'
      ]);
      await page
        .getByRole('radiogroup', { name: 'Quality' })
        .getByRole('radio', { name: 'minor' })
        .click();
      await expect(compareList(page).getByRole('radio')).toHaveText([
        'major',
        'diminished',
        'augmented'
      ]);
    });

    test('US1-5: Compare off restores the single triad', async ({ page }) => {
      await openTriads(page);
      await compareToggle(page).click();
      await expect(comparisonMarkers(page)).toHaveCount(1);
      await compareToggle(page).click();
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'false');
      await expect(board(page).locator('.marker')).toHaveCount(3);
      await expect(comparisonMarkers(page)).toHaveCount(0);
      await expect(arrows(page)).toHaveCount(0);
      await expect(compareList(page)).toHaveCount(0);
    });

    test('US1-7: the panel shows two columns with the changed note emphasised', async ({
      page
    }) => {
      await openTriads(page);
      await compareToggle(page).click();
      const panel = page.getByRole('region', { name: 'Composition' });
      const first = panel.getByRole('group', { name: 'C major — Root position' });
      const second = panel.getByRole('group', { name: 'C minor — Root position' });
      await expect(first).toBeVisible();
      await expect(second).toBeVisible();
      await expect(first.locator('strong').first()).toBeVisible();
      await expect(second.locator('.changed-tag').first()).toHaveText('changed');
      const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
      if (!a || !b) throw new Error('columns not laid out');
      if (size.width >= 1000) expect(b.x).toBeGreaterThan(a.x + a.width / 2);
      await expectNoHorizontalScroll(page);
    });

    test('axe: zero violations with Compare on', async ({ page }) => {
      await openTriads(page);
      await compareToggle(page).click();
      await expect(arrows(page)).toHaveCount(1);
      await runAxe(page);
    });
  });
}

test.describe('triads Compare is not by colour alone (US1-6)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('grayscale: dashed outline and arrow identify the comparison note', async ({ page }) => {
    await openTriads(page);
    await compareToggle(page).click();
    await expect(comparisonMarkers(page)).toHaveCount(1);
    await expect(arrows(page)).toHaveCount(1);
    // CSP is style-src 'self': CSSOM writes are not blocked.
    await page.evaluate(() => {
      document.documentElement.style.filter = 'grayscale(1)';
    });
    await expect(page.getByRole('grid', { name: 'Fretboard' })).toHaveScreenshot(
      'compare-c-major-minor-grayscale.png',
      { animations: 'disabled' }
    );
  });
});

const tags = (page: Page) => page.getByRole('group', { name: 'Shapes' }).getByRole('button');

/** A major, strings 3-2-1, Full neck (six shapes). */
async function openFullNeck(page: Page) {
  await page.goto('/triads');
  await expandDetails(page);
  await page
    .getByRole('group', { name: 'Root' })
    .getByRole('button', { name: 'A', exact: true })
    .click();
  await page.getByRole('radio', { name: 'Full neck' }).click();
  await expect(tags(page)).toHaveCount(6);
}

for (const size of sizes) {
  test.describe(`triads Compare in Full neck (US2) @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US2-1: A major vs minor: every shape shows one note at two positions with a 1-fret arrow', async ({
      page
    }) => {
      await openFullNeck(page);
      const before = await tags(page).allTextContents();
      await compareToggle(page).click();
      await expect(compareList(page).getByRole('radio', { name: 'minor' })).toBeChecked();
      await expect(comparisonMarkers(page)).toHaveCount(6);
      await expect(arrows(page)).toHaveCount(6);
      for (const text of await arrows(page).allTextContents()) {
        expect(text).toContain('1 fret');
      }
      // Tags (and so the chain) are unchanged by Compare.
      await expect(tags(page)).toHaveCount(6);
      expect(await tags(page).allTextContents()).toEqual(before);
    });

    test('US2-2: Compare survives Isolated → Full neck, hides in All notes, restores on return', async ({
      page
    }) => {
      await openTriads(page);
      await compareWith(page, 'diminished');
      await page.getByRole('radio', { name: 'Full neck' }).click();
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(compareList(page).getByRole('radio', { name: 'diminished' })).toBeChecked();
      await expect(comparisonMarkers(page).first()).toBeVisible();
      await page.getByRole('radio', { name: 'All notes' }).click();
      await expect(compareToggle(page)).toHaveCount(0);
      await expect(comparisonMarkers(page)).toHaveCount(0);
      await expect(arrows(page)).toHaveCount(0);
      await page.getByRole('radio', { name: 'Full neck' }).click();
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(compareList(page).getByRole('radio', { name: 'diminished' })).toBeChecked();
      await expect(comparisonMarkers(page).first()).toBeVisible();
    });

    test('US2: no axe violations in Full neck with Compare on', async ({ page }) => {
      await openFullNeck(page);
      await compareToggle(page).click();
      await expect(comparisonMarkers(page)).toHaveCount(6);
      await runAxe(page);
    });
  });
}

const rootButton = (page: Page, name: string | RegExp) =>
  page
    .getByRole('group', { name: 'Root' })
    .getByRole('button', { name, exact: typeof name === 'string' });

async function openFixture(page: Page, fixture?: 'SHORT-7' | 'AF-1-12' | 'NC-UNISON') {
  if (fixture) {
    await page.addInitScript((i) => {
      globalThis.__fmInstrument = i;
    }, fixture);
  }
  await page.goto('/triads');
  await expandDetails(page);
  await board(page).waitFor();
}

async function pickG2nd432(page: Page) {
  await rootButton(page, 'G').click();
  await page.getByRole('radio', { name: '2nd inversion' }).click();
  await page.getByRole('radio', { name: '4-3-2' }).click();
}

const markerKeys = (page: Page) =>
  board(page)
    .locator('.marker')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-key')));

for (const size of sizes) {
  test.describe(`triads Compare octave and fretboard limits (US3) @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US3-1: G major vs minor, 2nd inv., 4-3-2 shows 12-12-12 and 12-12-11 with a 1-fret arrow on string 2', async ({
      page
    }) => {
      await openFixture(page);
      await pickG2nd432(page);
      await compareToggle(page).click();
      await expect(compareList(page).getByRole('radio', { name: 'minor' })).toBeChecked();
      // The previous shape cross-fades out over `--duration-short` (026), so wait for it to go.
      await expect
        .poll(async () => (await markerKeys(page)).sort())
        .toEqual(['2:11', '2:12', '3:12', '4:12']);
      await expect(board(page).locator('.marker.comparison[data-key="2:11"]')).toHaveCount(1);
      await expect(arrows(page)).toHaveCount(1);
      await expect(arrows(page).first()).toContainText('1 fret');
      expect(await lineDx(page)).toBeLessThan(0);
    });

    test('US3-2: SHORT-7 shows an off-nut B♭ arrow and keeps the complete first triad', async ({
      page
    }) => {
      await openFixture(page, 'SHORT-7');
      await pickG2nd432(page);
      await compareToggle(page).click();
      await expect(comparisonMarkers(page)).toHaveCount(0);
      await expect(board(page).locator('.marker')).toHaveCount(3);
      await expect(arrows(page)).toHaveCount(1);
      await expect(arrows(page).first()).toContainText('B♭');
    });

    test('US3-2: AF-1-12 shows an off-end E♯ arrow', async ({ page }) => {
      await openFixture(page, 'AF-1-12');
      await rootButton(page, /C sharp/).click();
      await page.getByRole('radio', { name: 'minor' }).first().click();
      await page.getByRole('radio', { name: '1st inversion' }).click();
      await page.getByRole('radio', { name: '6-5-4' }).click();
      await compareToggle(page).click();
      await expect(comparisonMarkers(page)).toHaveCount(0);
      await expect(board(page).locator('.marker')).toHaveCount(3);
      await expect(arrows(page)).toHaveCount(1);
      await expect(arrows(page).first()).toContainText('E♯');
    });

    test('US3-3: Full neck G 4-3-2 shows the off-nut B♭ arrow and the 1-fret arrow', async ({
      page
    }) => {
      await openFixture(page);
      await pickG2nd432(page);
      await compareToggle(page).click();
      await page.getByRole('radio', { name: 'Full neck' }).click();
      // One arrow per chain shape (3 inversions × 2 octaves).
      await expect(arrows(page)).toHaveCount(6);
      const texts = await arrows(page).allTextContents();
      expect(texts.filter((x) => x.includes('B♭'))).toHaveLength(1);
      expect(texts.filter((x) => x.includes('1 fret')).length).toBeGreaterThanOrEqual(1);
      await expect(board(page).locator('.marker.comparison[data-key="2:11"]')).toHaveCount(1);
    });

    test('US3: NC-UNISON shows guidance, no comparison, Compare still on', async ({ page }) => {
      await openFixture(page, 'NC-UNISON');
      await compareToggle(page).click();
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(comparisonMarkers(page)).toHaveCount(0);
      await expect(arrows(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'See all notes' })).toBeVisible();
    });
  });
}

const qualityRadio = (page: Page, name: string) =>
  page.getByRole('radiogroup', { name: 'Quality' }).getByRole('radio', { name });

for (const size of sizes) {
  test.describe(`triads Compare survives changes (US4) @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US4-1: G major vs minor, 2nd inv., 4-3-2; root A keeps Compare and recalculates', async ({
      page
    }) => {
      await openFixture(page);
      await pickG2nd432(page);
      await compareToggle(page).click();
      const g = await markerKeys(page);
      await expect(comparisonMarkers(page)).toHaveCount(1);
      await rootButton(page, 'A').click();
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(compareList(page).getByRole('radio', { name: 'minor' })).toBeChecked();
      await expect(comparisonMarkers(page)).toHaveCount(1);
      await expect(arrows(page)).toHaveCount(1);
      await expect(arrows(page).first()).toContainText('1 fret');
      expect(await markerKeys(page)).not.toEqual(g);
      const panel = page.getByRole('region', { name: 'Composition' });
      await expect(panel.getByRole('group', { name: 'A major — 2nd inversion' })).toBeVisible();
      await expect(panel.getByRole('group', { name: 'A minor — 2nd inversion' })).toBeVisible();
    });

    test('US4-2: choosing the comparison quality as the current one swaps and shows a notice', async ({
      page
    }) => {
      await openTriads(page);
      await compareToggle(page).click();
      await qualityRadio(page, 'minor').click();
      await expect(qualityRadio(page, 'minor')).toBeChecked();
      await expect(compareList(page).getByRole('radio', { name: 'major' })).toBeChecked();
      await expect(compareList(page).getByRole('radio')).toHaveText([
        'major',
        'diminished',
        'augmented'
      ]);
      const notice = page.getByRole('status').filter({ hasText: 'Now comparing with major' });
      await expect(notice).toBeVisible();
      await expect(comparisonMarkers(page)).toHaveCount(1);
      await expectNoHorizontalScroll(page);
      // Not blocking: the board stays usable, and Dismiss removes it.
      await notice.getByRole('button', { name: 'Dismiss' }).click();
      await expect(notice).toHaveCount(0);
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
    });

    test('US4: a non-swap quality change shows no notice; the next change clears it', async ({
      page
    }) => {
      await openTriads(page);
      await compareToggle(page).click();
      await qualityRadio(page, 'diminished').click();
      await expect(page.getByText(/Now comparing with/)).toHaveCount(0);
      await qualityRadio(page, 'minor').click(); // compare is minor, so this swaps: now comparing with diminished
      await expect(page.getByText('Now comparing with diminished')).toBeVisible();
      await page.getByRole('radio', { name: '1st inversion' }).click();
      await expect(page.getByText(/Now comparing with/)).toHaveCount(0);
    });

    test('US4-3: inversion and string-set changes recalculate the comparison', async ({ page }) => {
      await openTriads(page);
      await compareToggle(page).click();
      const before = await markerKeys(page);
      await page.getByRole('radio', { name: '1st inversion' }).click();
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(comparisonMarkers(page)).toHaveCount(1);
      const afterInversion = await markerKeys(page);
      expect(afterInversion).not.toEqual(before);
      await page.getByRole('radio', { name: '4-3-2' }).click();
      await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(comparisonMarkers(page)).toHaveCount(1);
      expect(await markerKeys(page)).not.toEqual(afterInversion);
    });
  });
}

/** Stamp every current marker node so later assertions can tell kept nodes from re-created ones. */
const stampMarkers = (page: Page) =>
  board(page)
    .locator('.marker')
    .evaluateAll((els) => els.forEach((e, i) => e.setAttribute('data-stamp', `n${i}`)));

const stampedState = (page: Page) =>
  board(page)
    .locator('.marker[data-stamp]')
    .evaluateAll((els) =>
      els.map((e) => ({
        stamp: e.getAttribute('data-stamp'),
        fn: [...e.classList].find((c) => ['root', 'third', 'fifth'].includes(c)),
        key: e.getAttribute('data-key'),
        transform: (e as SVGElement).style.transform
      }))
    );

for (const size of sizes) {
  test.describe(`triads marker motion (US5) @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US5-1: major → minor keeps all nodes; only the third changes position', async ({
      page
    }) => {
      await openTriads(page);
      await stampMarkers(page);
      const before = await stampedState(page);
      await qualityRadio(page, 'minor').click();
      await expect(board(page).locator('.marker[data-key="2:4"]')).toHaveCount(1);
      const after = await stampedState(page);
      expect(after).toHaveLength(3);
      for (const b of before) {
        const a = after.find((x) => x.stamp === b.stamp);
        if (!a) throw new Error(`node ${b.fn} was re-created`);
        if (b.fn === 'third') expect(a.transform).not.toBe(b.transform);
        else expect(a.transform).toBe(b.transform);
      }
    });

    test('US5-2: changing the comparison quality moves only the changed comparison note', async ({
      page
    }) => {
      await openTriads(page);
      await compareToggle(page).click();
      await expect(comparisonMarkers(page)).toHaveCount(1);
      await stampMarkers(page);
      const before = await stampedState(page);
      await compareWith(page, 'augmented');
      await expect(comparisonMarkers(page).first()).toHaveClass(/fifth/);
      const after = await stampedState(page);
      // The unchanged first triad keeps nodes and positions.
      const firstStamps = before.filter((b) => !b.key?.endsWith(':4')).map((b) => b.stamp);
      for (const s of firstStamps) {
        const b = before.find((x) => x.stamp === s);
        const a = after.find((x) => x.stamp === s);
        if (a && b && a.key === b.key) expect(a.transform).toBe(b.transform);
      }
      expect(after.filter((a) => before.some((b) => b.stamp === a.stamp)).length).toBeGreaterThan(
        2
      );
    });

    test('US5-3: reduced motion makes the change instant', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openTriads(page);
      const duration = await board(page)
        .locator('.marker')
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration);
      // The marker now transitions several properties (transform, opacity): every one must be 0s.
      expect(duration.split(',').map((d) => d.trim())).toEqual(duration.split(',').map(() => '0s'));
      await compareToggle(page).click();
      await expect(comparisonMarkers(page)).toHaveCount(1);
    });

    test('US5-4: a root change slides: each marker keeps its node (026 FR-017)', async ({
      page
    }) => {
      await openTriads(page);
      await stampMarkers(page);
      await rootButton(page, 'D').click();
      await expect(board(page).locator('.marker')).toHaveCount(3);
      await expect(board(page).locator('.marker[data-stamp]')).toHaveCount(3);
    });

    test('US5-4: a string-set change re-creates every marker node', async ({ page }) => {
      await openTriads(page);
      await stampMarkers(page);
      await page.getByRole('radio', { name: '4-3-2' }).click();
      await expect(board(page).locator('.marker')).toHaveCount(3);
      await expect(board(page).locator('.marker[data-stamp]')).toHaveCount(0);
    });
  });
}

test.describe('triads Compare responsive and accessibility (Polish)', () => {
  test('320 px width at 200 % text zoom: columns stack, nothing truncated, only the fretboard scrolls', async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await openTriads(page);
    await page.evaluate(() =>
      document.documentElement.style.setProperty('font-size', '200%', 'important')
    );
    await compareToggle(page).click();
    await expect(comparisonMarkers(page)).toHaveCount(1);

    const panel = page.getByRole('region', { name: 'Composition' });
    const first = await panel.getByRole('group', { name: 'C major — Root position' }).boundingBox();
    const second = await panel
      .getByRole('group', { name: 'C minor — Root position' })
      .boundingBox();
    if (!first || !second) throw new Error('columns not laid out');
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1); // stacked, not side by side

    // No truncation: no text-overflow clipping inside the panel or the compare controls.
    const clipped = await page.evaluate(
      () =>
        [...document.querySelectorAll('.compare *, [aria-label="Composition"] *')].filter((el) => {
          const s = getComputedStyle(el);
          return (
            (s.textOverflow === 'ellipsis' || s.overflow === 'hidden') &&
            el.scrollWidth > el.clientWidth + 1
          );
        }).length
    );
    expect(clipped).toBe(0);
    await expectNoHorizontalScroll(page);
  });

  test('keyboard-only: Space toggles, arrows move in the list, focus is visible, targets ≥ 44×44', async ({
    page
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openTriads(page);
    await compareToggle(page).focus();
    await expect(compareToggle(page)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(comparisonMarkers(page)).toHaveCount(1);

    const outline = await compareToggle(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThan(0);

    const toggleBox = await compareToggle(page).boundingBox();
    expect(toggleBox?.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox?.height).toBeGreaterThanOrEqual(44);

    // Move into the list, then arrow through it.
    await compareList(page).getByRole('radio', { name: 'minor' }).focus();
    await page.keyboard.press('ArrowDown');
    const checked = compareList(page).getByRole('radio', { checked: true });
    await expect(checked).toBeFocused();
    await expect(checked).not.toHaveAccessibleName('minor');
    const radios = await compareList(page).getByRole('radio').all();
    for (const radio of radios) {
      const box = await radio.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const listOutline = await checked.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(listOutline).not.toBe('none');

    await page.keyboard.press('Space');
    await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(compareToggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(compareToggle(page)).toBeFocused();
  });

  // Left-handed mirroring of the arrows (FR-2.6): the app has no handedness control yet
  // (`screenOrder` is identity), so it is covered by the renderer unit test in
  // tests/unit/fretboard/fretboard.test.ts ("reversed" layout flips the arrow direction).

  test('axe: zero violations in every comparison state', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    // Isolated, Compare on.
    await openTriads(page);
    await compareToggle(page).click();
    await expect(arrows(page)).toHaveCount(1);
    await runAxe(page);

    // Swap notice (comparison quality = current quality).
    await openTriads(page);
    await compareToggle(page).click();
    await compareWith(page, 'minor');
    await page
      .getByRole('radiogroup', { name: 'Quality' })
      .getByRole('radio', { name: 'minor' })
      .click();
    await runAxe(page);

    // Off-board arrow (G 2nd inversion 4-3-2, third drops below the nut).
    await openTriads(page);
    await pickG2nd432(page);
    await compareToggle(page).click();
    await expect(arrows(page).first()).toBeVisible();
    await runAxe(page);

    // Full neck.
    await openFullNeck(page);
    await compareToggle(page).click();
    await expect(comparisonMarkers(page).first()).toBeVisible();
    await runAxe(page);

    // All notes (Compare hidden).
    await page.getByRole('radio', { name: 'All notes' }).click();
    await runAxe(page);
  });

  test('axe: zero violations for NC-UNISON guidance', async ({ page }) => {
    await openFixture(page, 'NC-UNISON');
    await compareToggle(page).click();
    await runAxe(page);
  });
});
