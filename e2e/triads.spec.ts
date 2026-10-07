import { expect, test, type Page } from '@playwright/test';

import { expandDetails, readAudioLog, runAxe } from './support/helpers';

const sizes = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'desktop', width: 1280, height: 800 }
];

for (const size of sizes) {
  test.describe(`triads US1 @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('US1-1: opens on C major, root position, 3-2-1, frets 5-5-3', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
      const board = page.getByRole('region', { name: 'Fretboard' });
      await expect(board.locator('.marker-label').filter({ hasText: /^R$/ })).toHaveCount(1);
      await expect(board.locator('.marker-label').filter({ hasText: /^3$/ })).toHaveCount(1);
      await expect(board.locator('.marker-label').filter({ hasText: /^5$/ })).toHaveCount(1);
    });

    test('US1-2/3: panel shows notes, intervals, stacking, low to high', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await expect(page.getByText('R – 3 – 5')).toBeVisible();
      await expect(page.getByText('major third + minor third')).toBeVisible();
      await expect(page.getByText('C (root), E (third), G (fifth)')).toBeVisible();
    });

    test('US1-4: label switch to note names and back', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await page.getByRole('radio', { name: 'Note names' }).click();
      const board = page.getByRole('region', { name: 'Fretboard' });
      await expect(board.locator('.marker-label').filter({ hasText: /^E$/ })).toHaveCount(1);
      await page.getByRole('radio', { name: 'Intervals' }).click();
      await expect(board.locator('.marker-label').filter({ hasText: /^R$/ })).toHaveCount(1);
    });

    test('no axe violations', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
      await runAxe(page);
    });
  });
}

for (const size of sizes) {
  test.describe(`triads US2 @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    const board = (page: import('@playwright/test').Page) =>
      page.getByRole('region', { name: 'Fretboard' });

    test('US2-1…4: all four controls visible; each change keeps the other three', async ({
      page
    }) => {
      await page.goto('/triads');
      await expandDetails(page);
      for (const name of ['Root', 'Quality', 'Inversion', 'String set']) {
        await expect(
          page.getByRole(name === 'Root' ? 'group' : 'radiogroup', { name })
        ).toBeVisible();
      }
      await page
        .getByRole('group', { name: 'Root' })
        .getByRole('button', { name: 'A', exact: true })
        .click();
      await page.getByRole('radio', { name: 'minor' }).click();
      await page.getByRole('radio', { name: '1st inversion' }).click();
      await page.getByRole('radio', { name: '4-3-2' }).click();
      await expect(page.getByText('A minor — 1st inversion', { exact: true })).toBeVisible();
      await expect(
        board(page)
          .locator('.marker-label')
          .filter({ hasText: /^(R|♭3|3|5)$/ })
      ).toHaveCount(3);
      await page.getByRole('radio', { name: 'major', exact: true }).click();
      await expect(page.getByText('A major — 1st inversion', { exact: true })).toBeVisible();
      await page.getByRole('radio', { name: 'Root position' }).click();
      await expect(page.getByText('A major — Root position', { exact: true })).toBeVisible();
      await expect(page.getByRole('radio', { name: '4-3-2' })).toHaveAttribute(
        'aria-checked',
        'true'
      );
    });

    test('playback stops on every control change', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      const changes = [
        () =>
          page
            .getByRole('group', { name: 'Root' })
            .getByRole('button', { name: 'D', exact: true })
            .click(),
        () => page.getByRole('radio', { name: 'minor' }).click(),
        () => page.getByRole('radio', { name: '2nd inversion' }).click(),
        () => page.getByRole('radio', { name: '5-4-3' }).click()
      ];
      for (const change of changes) {
        await page.getByRole('button', { name: 'Listen', exact: true }).click();
        await expect(board(page).locator('.marker.pulse').first()).toBeVisible();
        const before = (await readAudioLog(page)).filter(
          (e) => e.type === 'stop' && e.reason === 'view'
        ).length;
        await change();
        await expect
          .poll(
            async () =>
              (await readAudioLog(page)).filter((e) => e.type === 'stop' && e.reason === 'view')
                .length
          )
          .toBeGreaterThan(before);
      }
    });
  });
}

for (const size of sizes) {
  test.describe(`triads US3 @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    const pickRoot = (page: import('@playwright/test').Page, name: string | RegExp) =>
      page
        .getByRole('group', { name: 'Root' })
        .getByRole('button', { name, exact: typeof name === 'string' })
        .click();
    const panel = (page: import('@playwright/test').Page) =>
      page.getByRole('region', { name: 'Composition' });

    test('US3-1/2: D♯ major sounds-as + suggestion; switching keeps the shape', async ({
      page
    }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await pickRoot(page, /D sharp/);
      await expect(page.getByText('E♭ major — Root position', { exact: true })).toBeVisible();
      const board = page.getByRole('region', { name: 'Fretboard' });
      const before = await board
        .locator('.marker-label')
        .filter({ hasText: /^(R|♭3|3|5)$/ })
        .allTextContents();
      await page.getByRole('button', { name: 'Switch to D♯' }).click();
      await expect(page.getByText('D♯ major — Root position', { exact: true })).toBeVisible();
      await expect(panel(page).getByText('F\u{1D12A} sounds as G')).toBeVisible();
      await page.getByRole('button', { name: 'Simpler spelling: E♭' }).click();
      await expect(page.getByText('E♭ major — Root position', { exact: true })).toBeVisible();
      await expect(panel(page).getByText(/sounds as/)).toHaveCount(0);
      expect(
        await board
          .locator('.marker-label')
          .filter({ hasText: /^(R|♭3|3|5)$/ })
          .allTextContents()
      ).toEqual(before);
    });

    test('US3-3: default spelling follows the quality (C♯ minor, D♭ major)', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await pickRoot(page, /C sharp/);
      await expect(page.getByText('D♭ major — Root position', { exact: true })).toBeVisible();
      await page.getByRole('radio', { name: 'minor' }).click();
      await expect(page.getByText('C♯ minor — Root position', { exact: true })).toBeVisible();
    });

    test('US3-4/5: C augmented is C–E–G♯; naturals have no switch command', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await page.getByRole('radio', { name: 'augmented' }).click();
      const notes = panel(page).getByRole('list', { name: 'Notes' });
      await expect(notes.getByRole('listitem')).toHaveText(['C', 'E', 'G♯']);
      await expect(page.getByRole('button', { name: /Switch to/ })).toHaveCount(0);
    });

    test('US3-6: D♯ augmented shows two sounds-as lines and suggests E♭', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await pickRoot(page, /D sharp/);
      await page.getByRole('radio', { name: 'augmented' }).click();
      await page.getByRole('button', { name: 'Switch to D♯' }).click();
      await expect(panel(page).getByText('F\u{1D12A} sounds as G')).toBeVisible();
      await expect(panel(page).getByText('A\u{1D12A} sounds as B')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Simpler spelling: E♭' })).toBeVisible();
    });

    test('US3-7: B augmented has F𝄪 line, no suggestion, no switch', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await pickRoot(page, 'B');
      await page.getByRole('radio', { name: 'augmented' }).click();
      await expect(panel(page).getByText('F\u{1D12A} sounds as G')).toBeVisible();
      await expect(page.getByRole('button', { name: /Simpler spelling|Switch to/ })).toHaveCount(0);
    });

    test('US3-8: A augmented has no sounds-as line', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await pickRoot(page, 'A');
      await page.getByRole('radio', { name: 'augmented' }).click();
      await expect(panel(page).getByText(/sounds as/)).toHaveCount(0);
    });

    test('US3-9: note-name labels show F𝄪 for D♯ major', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await pickRoot(page, /D sharp/);
      await page.getByRole('button', { name: 'Switch to D♯' }).click();
      await page.getByRole('radio', { name: 'Note names' }).click();
      const board = page.getByRole('region', { name: 'Fretboard' });
      await expect(board.locator('.marker-label').filter({ hasText: 'F\u{1D12A}' })).toHaveCount(1);
    });

    test('US3: panel has no axe violations with sounds-as lines', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await pickRoot(page, /D sharp/);
      await page.getByRole('button', { name: 'Switch to D♯' }).click();
      await runAxe(page);
    });
  });
}

for (const size of sizes) {
  test.describe(`triads US4 @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    const board = (page: import('@playwright/test').Page) =>
      page.getByRole('region', { name: 'Fretboard' });

    test('US4-1: Octave up moves every fret by 12, Octave down becomes available', async ({
      page
    }) => {
      await page.goto('/triads');
      await expandDetails(page);
      const before = await board(page).getByRole('gridcell').allTextContents();
      await page.getByRole('button', { name: 'Octave up' }).click();
      await expect(page.getByRole('button', { name: 'Octave down' })).toHaveAttribute(
        'aria-disabled',
        'false'
      );
      await expect(board(page).locator('.marker-label').filter({ hasText: /^R$/ })).toHaveCount(1);
      expect(await board(page).getByRole('gridcell').allTextContents()).not.toEqual([]);
      expect(before.length).toBeGreaterThan(0);
    });

    test('US4-2: lowest occurrence has Octave down disabled, not hidden', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      const down = page.getByRole('button', { name: 'Octave down' });
      await expect(down).toBeVisible();
      await expect(down).toHaveAttribute('aria-disabled', 'true');
    });

    test('US4-3: highest occurrence has Octave up disabled', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await page.getByRole('button', { name: 'Octave up' }).click();
      await expect(page.getByRole('button', { name: 'Octave up' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    test('US4-4: 1st inversion on 6-5-4 has both commands disabled', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await page.getByRole('radio', { name: '1st inversion' }).click();
      await page.getByRole('radio', { name: '6-5-4' }).click();
      await expect(page.getByRole('button', { name: 'Octave up' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      await expect(page.getByRole('button', { name: 'Octave down' })).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    test('US4: no axe violations with disabled octave command', async ({ page }) => {
      await page.goto('/triads');
      await expandDetails(page);
      await runAxe(page);
    });
  });
}

test.describe('triads US5 wide stretch', () => {
  test('US5-1: Drop D C major root on 6-5-4 shows the mark', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-4';
    });
    await page.goto('/triads');
    await expandDetails(page);
    await page.getByRole('radio', { name: '6-5-4' }).click();
    await expect(page.getByText('Wide stretch', { exact: true })).toBeVisible();
    await runAxe(page);
  });

  test('US5-2: standard tuning shows no mark', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    for (const set of ['6-5-4', '5-4-3', '4-3-2', '3-2-1']) {
      await page.getByRole('radio', { name: set }).click();
      await expect(page.getByText('Wide stretch', { exact: true })).toHaveCount(0);
    }
  });

  test('US5-3: 0-1-0 shape shows no mark', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await page.getByRole('radio', { name: '2nd inversion' }).click();
    await expect(page.getByText('Wide stretch', { exact: true })).toHaveCount(0);
  });
});

test.describe('triads US6 special qualities', () => {
  test('US6-1: augmented states symmetry', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await page.getByRole('radio', { name: 'augmented' }).click();
    await expect(page.getByText(/Augmented triads are symmetric/)).toBeVisible();
    await runAxe(page);
  });

  test('US6-2: diminished marks the ♭5 as characteristic', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await page.getByRole('radio', { name: 'diminished' }).click();
    await expect(page.getByText(/The ♭5 is the characteristic note/)).toBeVisible();
    await expect(page.getByText(/Augmented triads are symmetric/)).toHaveCount(0);
  });

  test('US6-3: major and minor show neither statement', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    for (const q of ['major', 'minor']) {
      await page.getByRole('radio', { name: q }).click();
      await expect(page.getByText(/symmetric|characteristic note/)).toHaveCount(0);
    }
  });
});

test.describe('triads US7 hear the shape', () => {
  const listen = (page: Page) => page.getByRole('button', { name: 'Listen', exact: true });

  test('US7-1: Listen sounds low, mid, high, then the block at calculated pitches', async ({
    page
  }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await listen(page).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBeGreaterThanOrEqual(4);
    const steps = (await readAudioLog(page)).flatMap((e) => (e.type === 'step' ? [e] : []));
    expect(steps.slice(0, 4).every((e) => e.kind === 'sequence')).toBe(true);
    // C major root on 3-2-1: G3 (55)... frets 5-5-3 → C4 (60), E4 (64), G4 (67)
    expect(steps.slice(0, 4).map((e) => [...e.pitches].sort((a, b) => a - b))).toEqual([
      [60],
      [64],
      [67],
      [60, 64, 67]
    ]);
  });

  test('US7-2: any change stops Listen', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await listen(page).click();
    await expect(page.locator('.marker.pulse').first()).toBeVisible();
    await page.getByRole('radio', { name: 'minor' }).click();
    await expect(page.locator('.marker.pulse')).toHaveCount(0);
  });

  test('US7-3: muted, markers still pulse', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await page.getByRole('button', { name: 'Mute sound' }).click();
    await listen(page).click();
    await expect(page.locator('.marker.pulse').first()).toBeVisible();
  });
});

test.describe('triads US8 honest messages', () => {
  test('US8-1: beyond fret 12 shows guidance, never a blank board', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-1-12';
    });
    await page.goto('/triads');
    await expandDetails(page);
    await page.getByRole('radio', { name: 'diminished' }).click();
    await page.getByRole('radio', { name: '5-4-3' }).click();
    await expect(page.getByText('This shape lies beyond fret 12', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Another set' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Listen', exact: true })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await runAxe(page);
  });

  test('US8-2/3: does-not-close offers Another set, which shows a shape', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'NC-UNISON';
    });
    await page.goto('/triads');
    await expandDetails(page);
    await expect(page.getByText(/^This triad does not close on this string set/)).toBeVisible();
    await runAxe(page);
    await page.getByRole('button', { name: 'Another set' }).click();
    await expect(page.getByRole('radio', { name: '5-4-3' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(page.getByText(/^This triad does not close on this string set/)).toHaveCount(0);
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
  });

  test('guidance never covers controls', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'NC-UNISON';
    });
    await page.goto('/triads');
    await expandDetails(page);
    const guidance = await page
      .getByText(/^This triad does not close on this string set/)
      .boundingBox();
    if (!guidance) throw new Error('guidance not visible');
    for (const name of ['Another set', 'Octave up', 'Octave down', 'Listen']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      if (!box) throw new Error(`${name} not visible`);
      const overlap =
        guidance.x < box.x + box.width &&
        box.x < guidance.x + guidance.width &&
        guidance.y < box.y + box.height &&
        box.y < guidance.y + guidance.height;
      expect(overlap, name).toBe(false);
    }
  });
});

test.describe('triads cross-cutting (T067)', () => {
  const focusedName = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return '';
      return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
    });
  const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });

  /** Only the fretboard scroller may overflow horizontally; the page itself must not. */
  async function expectOnlyBoardScrolls(page: Page) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }

  test('keyboard only: every control is reachable and operable', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    const stops = new Set<string>();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      stops.add(await focusedName(page));
    }
    const has = (re: RegExp) => [...stops].some((s) => re.test(s));
    expect(has(/^A$/), 'root selector').toBe(true);
    expect(has(/^(major|minor|diminished|augmented)$/), 'quality').toBe(true);
    expect(has(/inversion|Root position/), 'inversion').toBe(true);
    expect(has(/^\d-\d-\d$/), 'string set').toBe(true);
    expect(has(/^Octave up$/), 'octave up').toBe(true);
    expect(has(/^Octave down$/), 'octave down').toBe(true);
    expect(has(/^Listen$/), 'listen').toBe(true);

    await page
      .getByRole('group', { name: 'Root' })
      .getByRole('button', { name: 'D', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('D major — Root position', { exact: true })).toBeVisible();
    await page.getByRole('radiogroup', { name: 'Quality' }).getByRole('radio').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('D minor — Root position', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Listen', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readAudioLog(page)).length).toBeGreaterThan(0);
  });

  for (const width of [320, 2560]) {
    test(`${width} px: only the fretboard scrolls horizontally; axe clean`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/triads');
      await expandDetails(page);
      await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
      await expect(board(page)).toBeVisible();
      await expectOnlyBoardScrolls(page);
      await runAxe(page);
    });
  }

  test('200 % text zoom at 320 px: no page scroll, controls reachable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/triads');
    await expandDetails(page);
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      window.dispatchEvent(new Event('resize'));
    });
    await expectOnlyBoardScrolls(page);
    await page.getByRole('radio', { name: 'minor' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('C minor — Root position', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Listen', exact: true })).toBeVisible();
  });

  test('axe: default, guidance, and wide-stretch states', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    await runAxe(page);

    const guidance = await page.context().newPage();
    await guidance.addInitScript(() => {
      globalThis.__fmInstrument = 'NC-UNISON';
    });
    await guidance.goto('/triads');
    await expandDetails(guidance);
    await expect(guidance.getByText(/^This triad does not close on this string set/)).toBeVisible();
    await runAxe(guidance);

    const wide = await page.context().newPage();
    await wide.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-4';
    });
    await wide.goto('/triads');
    await expandDetails(wide);
    await wide.getByRole('radio', { name: '6-5-4' }).click();
    await expect(wide.getByText('Wide stretch', { exact: true })).toBeVisible();
    await runAxe(wide);
  });
});

test.describe('triads on seven strings (012 US3)', () => {
  const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = 'AF-21';
    });
  });

  test('Q11: 7-6-5 first in the set selector; C major root 13-12-10; E minor root 5-3-2', async ({
    page
  }) => {
    await page.goto('/triads');
    await expandDetails(page);
    const sets = page.getByRole('radiogroup', { name: /string set/i });
    await expect(sets.getByRole('radio')).toHaveText(['7-6-5', '6-5-4', '5-4-3', '4-3-2', '3-2-1']);
    await sets.getByRole('radio', { name: '7-6-5' }).click();
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    await expect(page.locator('.description')).toContainText(
      /string 7, fret 13,.*string 6, fret 12,.*string 5, fret 10/
    );
    await expect(board(page).locator('.marker.normal, .marker').first()).toBeVisible();

    await page
      .getByRole('group', { name: 'Root' })
      .getByRole('button', { name: 'E', exact: true })
      .click();
    await page.getByRole('radio', { name: 'minor' }).click();
    await expect(page.getByText('E minor — Root position', { exact: true })).toBeVisible();
    await expect(page.locator('.description')).toContainText(
      /string 7, fret 5,.*string 6, fret 3,.*string 5, fret 2/
    );
    await runAxe(page);
  });

  test('Q11: the notes sound at their calculated pitches (C3 E3 G3 on 7-6-5)', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await page
      .getByRole('radiogroup', { name: /string set/i })
      .getByRole('radio', { name: '7-6-5' })
      .click();
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await expect
      .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
      .toBeGreaterThanOrEqual(4);
    const steps = (await readAudioLog(page)).flatMap((e) => (e.type === 'step' ? [e] : []));
    // B1 35 + 13 = 48 (C3), E2 40 + 12 = 52 (E3), A2 45 + 10 = 55 (G3)
    expect(steps.slice(0, 4).map((e) => [...e.pitches].sort((a, b) => a - b))).toEqual([
      [48],
      [52],
      [55],
      [48, 52, 55]
    ]);
  });

  test('Q14: with 12 frets, 7-6-5 C major root shows the beyond-fret-12 guidance', async ({
    page
  }) => {
    await page.addInitScript(() => {
      globalThis.__fmInstrument = undefined;
    });
    await page.goto('/triads');
    await expandDetails(page);
    await page
      .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    const spin = dialog.getByRole('spinbutton', { name: 'Frets' });
    await spin.focus();
    await page.keyboard.press('Home');
    await expect(spin).toHaveAttribute('aria-valuenow', '12');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page
      .getByRole('radiogroup', { name: /string set/i })
      .getByRole('radio', { name: '7-6-5' })
      .click();
    await expect(page.getByText('This shape lies beyond fret 12', { exact: true })).toBeVisible();
    await expect(page.getByText(/does not close/)).toHaveCount(0);
    await runAxe(page);
  });
});

test.describe('triads: string-count change (012 US4)', () => {
  const ADJUSTED = 'We adjusted the view to the new instrument';
  const sets = (page: Page) => page.getByRole('radiogroup', { name: /string set/i });

  const chooseStrings = async (page: Page, count: 6 | 7) => {
    await page
      .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await dialog.getByRole('radio', { name: `${count} strings` }).check();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();
  };

  test('Q12: 7-6-5 → 6 strings lands on 6-5-4 with a polite notice that can be dismissed', async ({
    page
  }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await chooseStrings(page, 7);
    await sets(page).getByRole('radio', { name: '7-6-5' }).click();
    await expect(sets(page).getByRole('radio', { name: '7-6-5' })).toBeChecked();

    await chooseStrings(page, 6);
    const status = page.getByRole('status').filter({ hasText: ADJUSTED });
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(sets(page).getByRole('radio')).toHaveText(['6-5-4', '5-4-3', '4-3-2', '3-2-1']);
    await expect(sets(page).getByRole('radio', { name: '6-5-4' })).toBeChecked();
    await expect(page.locator('.description')).toContainText(/6/);
    await runAxe(page);

    await status.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText(ADJUSTED)).toHaveCount(0);
  });

  test('Q13: 7 → 6 strings on another set shows no notice and keeps the set', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await chooseStrings(page, 7);
    await sets(page).getByRole('radio', { name: '5-4-3' }).click();
    await chooseStrings(page, 6);
    await expect(sets(page).getByRole('radio', { name: '5-4-3' })).toBeChecked();
    await expect(page.getByText(ADJUSTED)).toHaveCount(0);
  });

  test('6 → 7 strings keeps the view with no notice', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await sets(page).getByRole('radio', { name: '6-5-4' }).click();
    await chooseStrings(page, 7);
    await expect(sets(page).getByRole('radio', { name: '6-5-4' })).toBeChecked();
    await expect(page.getByText(ADJUSTED)).toHaveCount(0);
  });
});
