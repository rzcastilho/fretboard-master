import { expect, test, type Page } from '@playwright/test';

import { runAxe } from './support/helpers';

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const tags = (page: Page) => board(page).locator('.tag.static:visible');

test.describe('caged US1: five linked shapes', () => {
  test('Q1: home card and nav order', async ({ page }) => {
    await page.goto('/');
    const cards = page.getByRole('list').getByRole('link');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(2)).toHaveAccessibleName('CAGED — How does the whole neck connect?');
    await cards.nth(2).click();
    await expect(page).toHaveURL(/\/caged$/);
    const nav = page.getByRole('navigation', { name: 'Tools' });
    await expect(nav.getByRole('link')).toHaveText([
      'Home',
      'Fretboard Notes',
      'Triads',
      'CAGED',
      'About'
    ]);
    await expect(nav.locator('[aria-current="page"]')).toHaveText('CAGED');
  });

  test('Q2: opens on C major with the title and heading', async ({ page }) => {
    await page.goto('/caged');
    await expect(page).toHaveTitle('CAGED — Fretboard Master');
    await expect(page.getByText('C major', { exact: true })).toBeVisible();
  });

  test('Q3: tags in order, no overlap, start frets 0, 3, 5, 8, 10', async ({ page }) => {
    await page.goto('/caged');
    // 22 frets also fit the start of a second cycle; the first five are the first cycle.
    await expect(tags(page)).toHaveCount(9);
    const texts = await tags(page).allInnerTexts();
    expect(texts.slice(0, 5).map((t) => t.trim())).toEqual([
      'C shape · roots on strings 5, 2',
      'A shape · roots on strings 5, 3',
      'G shape · roots on strings 6, 3, 1',
      'E shape · roots on strings 6, 4, 1',
      'D shape · roots on strings 4, 2'
    ]);
    const boxes = [];
    for (let i = 0; i < 9; i++) {
      const b = await tags(page).nth(i).boundingBox();
      if (!b) throw new Error('tag has no box');
      boxes.push(b);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        expect(overlap, `tags ${i} and ${j} overlap`).toBe(false);
      }
    // Tags are text, not controls.
    await expect(
      board(page).getByRole('group', { name: 'Shapes' }).getByRole('button')
    ).toHaveCount(0);
  });

  test('Q4: root markers are squares, no layer/label controls', async ({ page }) => {
    await page.goto('/caged');
    const roots = board(page).locator('.marker.root');
    await expect(roots.first()).toBeAttached();
    expect(await roots.count()).toBeGreaterThan(0);
    await expect(roots.locator('rect.glyph')).toHaveCount(await roots.count());
    // Layer/label controls are absent; the only radios are the Quality group (US3).
    await expect(page.getByRole('radio')).toHaveCount(2);
    await expect(page.getByRole('radiogroup')).toHaveAccessibleName('Quality');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
  });

  test('Q5: 24 frets shows nine tags, frets 0 and 12 tags identical', async ({ page }) => {
    // Test-build fixture: the Instrument panel wiring arrives with US4.
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-1-24';
    });
    await page.goto('/caged');
    await expect(tags(page)).toHaveCount(9);
    const texts = (await tags(page).allInnerTexts()).map((t) => t.trim());
    expect(texts[0]).toBe(texts[5]);
  });

  test('no axe violations', async ({ page }) => {
    await page.goto('/caged');
    await expect(page.getByText('C major', { exact: true })).toBeVisible();
    await runAxe(page);
  });
});

const key = (page: Page, pc: number) =>
  page.getByRole('group', { name: 'Key' }).getByRole('button').nth(pc);
const order = async (page: Page) =>
  (await tags(page).allInnerTexts()).slice(0, 5).map((t) => t.trim()[0]);

test.describe('caged US2: choose the key', () => {
  test('Q6: G major order G E D C A, no C tag below fret 7', async ({ page }) => {
    await page.goto('/caged');
    await key(page, 7).click();
    await expect(page.getByText('G major', { exact: true })).toBeVisible();
    expect(await order(page)).toEqual(['G', 'E', 'D', 'C', 'A']);
    const texts = (await tags(page).allInnerTexts()).map((t) => t.trim());
    expect(texts[0]).toMatch(/^G shape/);
    expect(texts.findIndex((t) => t.startsWith('C shape'))).toBe(3);
  });

  test('Q7: D♭ major order C A G E D', async ({ page }) => {
    await page.goto('/caged');
    await key(page, 1).click();
    await expect(page.getByText('D♭ major', { exact: true })).toBeVisible();
    expect(await order(page)).toEqual(['C', 'A', 'G', 'E', 'D']);
  });

  test('Q8: F♯ major order E D C A G', async ({ page }) => {
    await page.goto('/caged');
    await key(page, 6).click();
    expect(await order(page)).toEqual(['E', 'D', 'C', 'A', 'G']);
  });

  test('Q9: spelling switch toggles C♯/D♭ major (minor steps arrive with US3)', async ({
    page
  }) => {
    await page.goto('/caged');
    await expect(page.getByRole('button', { name: /^Switch to/ })).toHaveCount(0);
    await key(page, 1).click();
    await expect(page.getByText('D♭ major', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to C♯' }).click();
    await expect(page.getByText('C♯ major', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to D♭' }).click();
    await expect(page.getByText('D♭ major', { exact: true })).toBeVisible();
    // Same shapes either way.
    expect(await order(page)).toEqual(['C', 'A', 'G', 'E', 'D']);
  });
});

const qualityRadio = (page: Page, name: 'Major' | 'Minor') =>
  page.getByRole('radiogroup', { name: 'Quality' }).getByRole('radio', { name });

test.describe('caged US3: major and minor', () => {
  test('Q10: G major then Minor gives Gm 0, Em 3, Dm 5, Cm 7, Am 10', async ({ page }) => {
    await page.goto('/caged');
    await key(page, 7).click();
    await qualityRadio(page, 'Minor').click();
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();
    const texts = (await tags(page).allInnerTexts()).slice(0, 5).map((t) => t.trim());
    expect(texts.map((t) => t.split(' ')[0])).toEqual(['Gm', 'Em', 'Dm', 'Cm', 'Am']);
    expect(texts[0]).toMatch(/^Gm shape · roots on strings /);
    expect(texts[4]).toBe('Am shape · roots on strings 5, 3');
  });

  test('Q11: C minor muted strings stay empty', async ({ page }) => {
    await page.goto('/caged');
    await qualityRadio(page, 'Minor').click();
    await expect(page.getByText('C minor', { exact: true })).toBeVisible();
    // Cm shape: string 6 (frets 0-3) and string 1 (frets 0-2) carry no marker.
    const markers = board(page).locator('.marker');
    expect(await markers.count()).toBeGreaterThan(0);
    const cm = board(page).getByRole('grid', { name: 'Fretboard' });
    await expect(cm.getByRole('gridcell', { name: /string 6 fret [0-3]\b/ })).toHaveCount(0);
  });

  test('Q12: minor thirds are labelled ♭3', async ({ page }) => {
    await page.goto('/caged');
    await qualityRadio(page, 'Minor').click();
    await expect(board(page).getByText('♭3').first()).toBeAttached();
    await expect(board(page).locator('.marker').getByText(/^3$/)).toHaveCount(0);
  });

  test('Q9 (full): spelling survives quality changes', async ({ page }) => {
    await page.goto('/caged');
    await key(page, 1).click();
    await qualityRadio(page, 'Minor').click();
    await expect(page.getByText('C♯ minor', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to D♭' }).click();
    await expect(page.getByText('D♭ minor', { exact: true })).toBeVisible();
    await qualityRadio(page, 'Major').click();
    await expect(page.getByText('D♭ major', { exact: true })).toBeVisible();
  });
});

const FIT = 'With 12 frets, 4 shapes fit on the fretboard';

const openPanel = async (page: Page) => {
  await page
    .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Instrument' });
  await expect(dialog).toBeVisible();
  return dialog;
};

const confirmPanel = async (page: Page) => {
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('dialog', { name: 'Instrument' })).toBeHidden();
};

const withFixture = (page: Page, id: string) =>
  page.addInitScript((v) => {
    globalThis.__fmInstrument = v;
  }, id);

test.describe('caged US4: fewer frets, fewer shapes', () => {
  test('Q13: 12 frets, C major shows four shapes, no D, and the note', async ({ page }) => {
    await withFixture(page, 'AF-1-12');
    await page.goto('/caged');
    await expect(page.getByRole('status').filter({ hasText: FIT })).toBeVisible();
    await expect(tags(page).filter({ hasText: /^D shape/ })).toHaveCount(0);
    expect((await tags(page).allInnerTexts()).map((t) => t.trim()[0]).slice(0, 4)).toEqual([
      'C',
      'A',
      'G',
      'E'
    ]);
  });

  test('Q14: G major at 12 frets shows no note', async ({ page }) => {
    await withFixture(page, 'AF-1-12');
    await page.goto('/caged');
    await key(page, 7).click();
    await expect(page.getByText('G major', { exact: true })).toBeVisible();
    await expect(page.getByText(/shapes fit on the fretboard/)).toHaveCount(0);
  });

  test('Q15: 22 and 24 frets show no note, any key', async ({ page }) => {
    await page.goto('/caged');
    await expect(page.getByText(/shapes fit on the fretboard/)).toHaveCount(0);
    await key(page, 1).click();
    await expect(page.getByText(/shapes fit on the fretboard/)).toHaveCount(0);
    await withFixture(page, 'AF-1-24');
    await page.goto('/caged');
    await expect(page.getByText(/shapes fit on the fretboard/)).toHaveCount(0);
  });

  test('Q16: 7 strings draws nothing on string 7', async ({ page }) => {
    await withFixture(page, 'AF-21');
    await page.goto('/caged');
    await expect(tags(page)).toHaveCount(9);
    await expect(board(page).locator('.cell[data-string="7"]')).not.toHaveCount(0);
    await expect(board(page).locator('.marker[data-string="7"]')).toHaveCount(0);
  });

  test('Q15: 7 strings keeps the markers of strings 6–1 identical to AF-1', async ({ page }) => {
    const keys = async () =>
      (
        await board(page)
          .locator('.marker')
          .evaluateAll((els) => els.map((e) => e.getAttribute('data-key') ?? ''))
      ).sort();
    await page.goto('/caged');
    await expect(board(page).locator('.marker').first()).toBeAttached();
    const six = await keys();
    expect(six.length).toBeGreaterThan(0);

    const seven = await browserSeven(page);
    expect(seven).toEqual(six);
  });

  test('instrument changes redraw immediately, keeping the key heading', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('list').getByRole('link', { name: /CAGED/ }).click();
    await key(page, 7).click();
    await qualityRadio(page, 'Minor').click();
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();

    let dialog = await openPanel(page);
    await dialog
      .getByRole('spinbutton')
      .first()
      .fill('12')
      .catch(() => undefined);
    await dialog.getByRole('radio', { name: 'Left-handed' }).check();
    await confirmPanel(page);
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();
    await expect(board(page).locator('.cell[data-fret="0"]')).toHaveCount(6);

    dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    await confirmPanel(page);
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();
    await expect(board(page).locator('.cell[data-fret="0"]')).toHaveCount(7);
    await expect(board(page).locator('.marker[data-string="7"]')).toHaveCount(0);
  });
});

/** Markers (`data-key`) of the AF-21 seven-string board, on a fresh page. */
const browserSeven = async (page: Page) => {
  await page.addInitScript(() => {
    globalThis.__fmInstrument = 'AF-21';
  });
  await page.goto('/caged');
  await expect(board(page).locator('.cell[data-string="7"]')).not.toHaveCount(0);
  return (
    await board(page)
      .locator('.marker')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-key') ?? ''))
  ).sort();
};

// Slice 014 interim text: still used by the Drop D cases until US3 (T041/T046) replaces them.
const unsupported = (tuning: string) =>
  `CAGED depends on the standard relationship between the strings, so its shapes don't exist in ${tuning}.`;

test.describe('caged US5: other tunings', () => {
  test('Q17: Half step down draws C1 A4 G6 E9 D11', async ({ page }) => {
    await withFixture(page, 'AF-2');
    await page.goto('/caged');
    expect((await tags(page).allInnerTexts()).slice(0, 5).map((t) => t.trim()[0])).toEqual([
      'C',
      'A',
      'G',
      'E',
      'D'
    ]);
    await expect(board(page).locator('.marker').first()).toBeVisible();
  });

  // Drop D (AF-4): shapes on strings 5→1 plus the "altered" mark (slice 015 US3).
  test('Q18: AF-4 draws shapes with the altered mark', async ({ page }) => {
    await withFixture(page, 'AF-4');
    await page.goto('/caged');
    await expect(board(page).locator('.marker').first()).toBeVisible();
    await expect(tags(page).first()).toBeVisible();
    await expect(board(page).locator('text.string-mark')).toHaveText('altered');
    await expect(page.getByRole('status').filter({ hasText: /relationship/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Key' })).toBeVisible();
    await expect(qualityRadio(page, 'Major')).toBeVisible();
  });

  test('Q19: AF-8 shows the notice and nothing else', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, tuning: 'AF-8' })
      );
    });
    await page.goto('/caged');
    await expect(page.getByRole('status').filter({ hasText: unsupported('Open G') })).toBeVisible();
    await expect(board(page).locator('.marker')).toHaveCount(0);
    await expect(board(page).locator('.tag')).toHaveCount(0);
    await expect(page.getByText(/shapes fit on the fretboard/)).toHaveCount(0);
    await expect(board(page).getByRole('button')).toHaveText([
      'View in standard tuning',
      'Go to Triads'
    ]);
    await expect(page.getByRole('group', { name: 'Key' })).toBeVisible();
    await expect(qualityRadio(page, 'Major')).toBeVisible();
  });

  test('switching back to Standard redraws shapes for the kept key and quality', async ({
    page
  }) => {
    await page.goto('/caged');
    await key(page, 7).click();
    await qualityRadio(page, 'Minor').click();
    let dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: /^Open G/ }).check();
    await confirmPanel(page);
    await expect(page.getByRole('status').filter({ hasText: unsupported('Open G') })).toBeVisible();
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();
    dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: /^Standard/ }).check();
    await confirmPanel(page);
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();
    await expect(tags(page).first()).toContainText('Gm shape');
    await expect(page.getByText(/shapes don't exist in/)).toHaveCount(0);
  });
});

test.describe('caged US6: behaves like the other tools', () => {
  const nav = (page: Page) => page.getByRole('navigation', { name: 'Tools' });

  test('Q20: G minor survives a visit to Triads; Triads is untouched', async ({ page }) => {
    await page.goto('/caged');
    await key(page, 7).click();
    await qualityRadio(page, 'Minor').click();
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();
    await nav(page).getByRole('link', { name: 'Triads' }).click();
    await expect(page).toHaveURL(/\/triads$/);
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    await nav(page).getByRole('link', { name: 'CAGED' }).click();
    await expect(page).toHaveURL(/\/caged$/);
    await expect(page.getByText('G minor', { exact: true })).toBeVisible();
  });

  test('Q21: the home card shows Continue, also after a reload', async ({ page }) => {
    await page.goto('/caged');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('fretboard-master:prefs')))
      .toContain('"lastTool":"caged"');
    await page.goto('/');
    const card = page.getByRole('list').getByRole('link', { name: /^Continue: CAGED/ });
    await expect(card).toHaveCount(1);
    await page.reload();
    await expect(card).toHaveCount(1);
    await expect(page.getByText('Continue', { exact: true })).toHaveCount(1);
  });

  test('Q22: key changes add no history entries; one Back leaves /caged', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('list').getByRole('link', { name: /CAGED/ }).click();
    await expect(page).toHaveURL(/\/caged$/);
    const before = await page.evaluate(() => history.length);
    for (const pc of [2, 5, 7]) await key(page, pc).click();
    await expect(page.getByText('G major', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(before);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
  });

  test('Q23: Reset tool returns C major and keeps the instrument', async ({ page }) => {
    await page.goto('/caged');
    await key(page, 1).click();
    await qualityRadio(page, 'Minor').click();
    await page.getByRole('button', { name: 'Reset tool' }).click();
    await expect(page.getByText('C major', { exact: true })).toBeVisible();
    await expect(qualityRadio(page, 'Major')).toBeChecked();
    const dialog = await openPanel(page);
    await expect(dialog.getByRole('radio', { name: /^Standard/ })).toBeChecked();
    expect(await order(page)).toEqual(['C', 'A', 'G', 'E', 'D']);
  });
});

test.describe('caged polish: accessibility (Q24, Q25)', () => {
  const settle = async (page: Page) => {
    await expect(board(page)).toBeVisible();
    await runAxe(page);
  };

  test('axe: C major (AF-1)', async ({ page }) => {
    await page.goto('/caged');
    await expect(page.getByText('C major', { exact: true })).toBeVisible();
    await settle(page);
  });

  // C minor, not G minor: the fit note shows only when fewer than five shapes fit (spec clarification:
  // G on 12 frets fits all five, so it has no note; minor has the same counts as major).
  test('axe: C minor on 12 frets with the fit note', async ({ page }) => {
    await withFixture(page, 'AF-1-12');
    await page.goto('/caged');
    await qualityRadio(page, 'Minor').click();
    await expect(page.getByText('C minor', { exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /shapes fit/ })).toBeVisible();
    await settle(page);
  });

  test('axe: Drop D draws shapes with the altered mark', async ({ page }) => {
    await withFixture(page, 'AF-4');
    await page.goto('/caged');
    await expect(board(page).locator('text.string-mark')).toHaveText('altered');
    await runAxe(page);
  });

  test('Q24: left-handed with lowest-on-top keeps tags and markers, axe clean', async ({
    page
  }) => {
    await page.goto('/caged');
    await expect(tags(page)).toHaveCount(9);
    const texts = (await tags(page).allInnerTexts()).map((t) => t.trim());
    const markers = await board(page).locator('.marker').count();

    const dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: 'Left-handed' }).check();
    await dialog.getByRole('radio', { name: 'Lowest string on top' }).check();
    await confirmPanel(page);

    await expect(tags(page)).toHaveCount(9);
    const after = (await tags(page).allInnerTexts()).map((t) => t.trim());
    expect([...after].sort()).toEqual([...texts].sort());
    expect(await board(page).locator('.marker').count()).toBe(markers);
    await settle(page);
  });

  for (const width of [320, 2560]) {
    test(`axe at ${width} px, no horizontal page scroll`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/caged');
      await expect(tags(page)).toHaveCount(9);
      await settle(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('Q25: Tab order, tags not focusable, description lists the five occurrences', async ({
    page
  }) => {
    await page.goto('/caged');
    // D♭ major shows the Switch button; start from the first key button.
    await key(page, 1).click();
    await expect(page.getByRole('button', { name: /^Switch to/ })).toBeVisible();
    await key(page, 0).focus();

    const kind = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return 'none';
        if (el.closest('[role="radiogroup"]')) return 'quality';
        if (el.closest('[role="group"][aria-label="Key"]')) return 'key';
        if (el.classList.contains('switch')) return 'switch';
        if (
          el.closest('[role="region"][aria-label="Fretboard"], svg') ||
          el.classList.contains('description-toggle')
        )
          return 'board';
        if ((el.textContent ?? '').trim() === 'Reset tool') return 'reset';
        return `other:${el.tagName}:${(el.textContent ?? '').trim().slice(0, 20)}`;
      });
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      const k = await kind();
      if (seen[seen.length - 1] !== k) seen.push(k);
      if (k === 'reset') break;
      await page.keyboard.press('Tab');
    }
    expect(seen).toEqual(['key', 'quality', 'switch', 'board', 'reset']);

    await expect(board(page).locator('.tag button, .tag[tabindex], .tag a')).toHaveCount(0);
    const description = (await board(page).locator('.description').textContent()) ?? '';
    // Occurrences are listed in order (D♭ major: C A G E D).
    const at = ['C', 'A', 'G', 'E', 'D'].map((s) => description.indexOf(`${s} shape, frets`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
  });

  test('200 % text zoom: tags and controls wrap, nothing is truncated', async ({ page }) => {
    await page.goto('/caged');
    await expect(tags(page)).toHaveCount(9);
    // CSP forbids injected <style>; the CSSOM route is allowed.
    await page.evaluate(() => document.documentElement.style.setProperty('font-size', '200%'));
    const truncated = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.tag, button, [role="radio"]')]
        .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1)
        .map((el) => (el.textContent ?? '').trim().slice(0, 30))
    );
    expect(truncated).toEqual([]);
    await expect(tags(page)).toHaveCount(9);
  });
});
