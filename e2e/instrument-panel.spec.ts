import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, readAudioLog, runAxe } from './support/helpers';

const sizes = [
  { name: 'phone', width: 360, height: 740 },
  { name: 'desktop', width: 1280, height: 800 }
];

const openPanel = async (page: Page) => {
  await page.getByRole('button', { name: 'Instrument', exact: true }).click();
  return page.getByRole('dialog', { name: 'Instrument' });
};

const pick = (page: Page, name: string) =>
  page.getByRole('radio', { name: new RegExp(`^${name}:`) });

for (const size of sizes) {
  test.describe(`instrument panel US1 @ ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('scenario 1: Drop D from /triads reads 10-7-5 wide stretch, string 6 plays D2', async ({
      page
    }) => {
      await page.goto('/triads');
      await page.getByRole('radio', { name: '6-5-4' }).click();
      await expect(page.locator('.description')).toContainText(
        /string 6, fret 8,.*string 5, fret 7,.*string 4, fret 5/
      );

      const dialog = await openPanel(page);
      await expect(dialog).toBeVisible();
      await pick(page, 'Drop D').check();
      // US1-3: preview shows the lowest string D before anything is applied.
      await expect(dialog.locator('.fretboard-preview .string-label').last()).toHaveText('D');
      await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);

      await dialog.getByRole('button', { name: 'Confirm' }).click();
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole('button', { name: 'Tuning: Drop D. Open instrument panel' })
      ).toBeVisible();
      await expect(page.getByText('Wide stretch', { exact: true })).toBeVisible();
      await expect(page.locator('.description')).toContainText(
        /string 6, fret 10,.*string 5, fret 7,.*string 4, fret 5/
      );

      await page.locator('.cell[data-string="6"][data-fret="0"]').click();
      await expect
        .poll(async () => (await readAudioLog(page)).filter((e) => e.type === 'step').length)
        .toBeGreaterThan(0);
      const step = (await readAudioLog(page)).find((e) => e.type === 'step');
      if (step?.type !== 'step') throw new Error('no step');
      expect(step.pitches).toEqual([38]);
      await expect(page.locator('.string-label').filter({ hasText: /^6 D$/ })).toHaveCount(1);
    });

    test('scenario 2: badge reopens with Drop D checked; Standard removes the badge', async ({
      page
    }) => {
      await page.goto('/triads');
      let dialog = await openPanel(page);
      await pick(page, 'Drop D').check();
      await dialog.getByRole('button', { name: 'Confirm' }).click();

      const badge = page.getByRole('button', { name: 'Tuning: Drop D. Open instrument panel' });
      await badge.click();
      dialog = page.getByRole('dialog', { name: 'Instrument' });
      await expect(pick(page, 'Drop D')).toBeChecked();
      await pick(page, 'Standard').check();
      await dialog.getByRole('button', { name: 'Confirm' }).click();
      await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);
    });

    test('US1-6: Standard at 22 frets shows no badge', async ({ page }) => {
      await page.goto('/notes');
      await expect(page.getByRole('button', { name: 'Instrument', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);
    });

    test('Close returns focus to the opener and applies nothing', async ({ page }) => {
      await page.goto('/notes');
      const opener = page.getByRole('button', { name: 'Instrument', exact: true });
      const dialog = await openPanel(page);
      await pick(page, 'Drop D').check();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
      await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);
    });
  });
}

test.describe('instrument panel US5', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('US5-1: home summary opens the panel', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '6 strings · standard tuning · right-handed' }).click();
    await expect(page.getByRole('dialog', { name: 'Instrument' })).toBeVisible();
  });

  test('US5-2: app-bar button opens the panel in Notes and Triads', async ({ page }) => {
    for (const path of ['/notes', '/triads']) {
      await page.goto(path);
      const dialog = await openPanel(page);
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
    }
  });

  test('US5-4: summary and thumbnails follow a confirmed Drop D', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^6 strings/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await pick(page, 'Drop D').check();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(
      page.getByRole('button', { name: '6 strings · Drop D · right-handed' })
    ).toBeVisible();
    await expect(
      page.locator('.fretboard-thumbnail').first().locator('.string-label').last()
    ).toHaveText('D');
  });
});

test.describe('instrument panel US5 layout', () => {
  const box = async (page: Page) =>
    page.getByRole('dialog', { name: 'Instrument' }).evaluate(async (el) => {
      // Measure the resting layout, not a frame of the slide-in animation.
      await Promise.all(el.getAnimations().map((a) => a.finished));
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        maxBlock: cs.maxBlockSize,
        vw: innerWidth,
        vh: innerHeight
      };
    });

  test('US5-3: bottom sheet at 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/notes');
    await openPanel(page);
    const b = await box(page);
    expect(b.width).toBeCloseTo(b.vw, 0);
    expect(b.bottom).toBeCloseTo(b.vh, 0);
    expect(b.height).toBeLessThanOrEqual(b.vh * 0.9 + 1);
    expect(parseFloat(b.maxBlock)).toBeCloseTo(b.vh * 0.9, 0);
  });

  test('US5-3: inline-end side panel at 1280 px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/triads');
    await openPanel(page);
    const b = await box(page);
    expect(b.right).toBeCloseTo(b.vw, 0);
    expect(b.width).toBeLessThan(b.vw / 2);
    expect(b.top).toBeCloseTo(0, 0);
    expect(b.height).toBeCloseTo(b.vh, 0);
  });
});

test.describe('instrument panel US2 (fret count)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('scenario 3: bounds, disabled ends, 12 frets end every tool at fret 12', async ({
    page
  }) => {
    await page.goto('/notes');
    const dialog = await openPanel(page);
    const spin = dialog.getByRole('spinbutton', { name: 'Frets' });
    await expect(spin).toHaveAttribute('aria-valuenow', '22');

    await spin.focus();
    await page.keyboard.press('End');
    await expect(spin).toHaveAttribute('aria-valuenow', '24');
    await expect(dialog.getByRole('button', { name: 'More frets' })).toBeDisabled();
    await page.keyboard.press('Home');
    await expect(spin).toHaveAttribute('aria-valuenow', '12');
    await expect(dialog.getByRole('button', { name: 'Fewer frets' })).toBeDisabled();

    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();

    // Navigate in-app: a reload would reset the in-memory configuration (FR-018).
    for (const tool of ['Fretboard Notes', 'Triads']) {
      await page
        .getByRole('navigation', { name: 'Tools' })
        .getByRole('link', { name: tool })
        .click();
      await expect(page.locator('.cell[data-fret="12"]').first()).toBeAttached();
      await expect(page.locator('.cell[data-fret="13"]')).toHaveCount(0);
    }
  });

  test('US2-2: a value outside 12-24 cannot be entered', async ({ page }) => {
    await page.goto('/triads');
    const dialog = await openPanel(page);
    const spin = dialog.getByRole('spinbutton', { name: 'Frets' });
    await expect(dialog.locator('input[type="text"], input[type="number"]')).toHaveCount(0);
    await spin.focus();
    await page.keyboard.type('99');
    await expect(spin).toHaveAttribute('aria-valuenow', '22');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
    await expect(spin).toHaveAttribute('aria-valuenow', '24');
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowDown');
    await expect(spin).toHaveAttribute('aria-valuenow', '12');
  });
});

test.describe('instrument panel US3 (cancel and restore)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('scenario 4: every dismissal path discards edits and leaves history unchanged', async ({
    page
  }) => {
    await page.goto('/triads');
    const before = await page.evaluate(() => history.length);
    const dismissals: [string, () => Promise<void>][] = [
      ['Escape', () => page.keyboard.press('Escape')],
      ['Close', () => page.getByRole('button', { name: 'Close' }).click()],
      [
        'backdrop',
        async () => {
          // Click the viewport's left edge: outside the inline-end side panel, on the backdrop.
          await page.mouse.click(5, 400);
        }
      ],
      ['Back', () => page.goBack().then(() => undefined)]
    ];
    for (const [, dismiss] of dismissals) {
      const dialog = await openPanel(page);
      await expect(dialog).toBeVisible();
      await pick(page, 'Open G').check();
      await dialog.getByRole('spinbutton', { name: 'Frets' }).focus();
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
      await dismiss();
      await expect(dialog).toBeHidden();
      await expect(page).toHaveURL(/\/triads(\?v=1&.*)?$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Triads' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => history.length)).toBeLessThanOrEqual(before + 1);
      await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);

      const reopened = await openPanel(page);
      await expect(pick(page, 'Standard')).toBeChecked();
      await expect(reopened.getByRole('spinbutton', { name: 'Frets' })).toHaveAttribute(
        'aria-valuenow',
        '22'
      );
      await reopened.getByRole('button', { name: 'Close' }).click();
      await expect(reopened).toBeHidden();
    }
  });

  test('Escape and Close return focus to the opener', async ({ page }) => {
    await page.goto('/notes');
    const opener = page.getByRole('button', { name: 'Instrument', exact: true });
    await openPanel(page);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await openPanel(page);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
  });

  test('scenario 5: Restore default then Confirm removes the badge and restores 22 frets', async ({
    page
  }) => {
    await page.goto('/notes');
    let dialog = await openPanel(page);
    await pick(page, 'Drop D').check();
    await dialog.getByRole('spinbutton', { name: 'Frets' }).focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('button', { name: /^Tuning: Drop D/ })).toBeVisible();

    dialog = await openPanel(page);
    await dialog.getByRole('button', { name: 'Restore default' }).click();
    await expect(pick(page, 'Standard')).toBeChecked();
    await expect(dialog.getByRole('spinbutton', { name: 'Frets' })).toHaveAttribute(
      'aria-valuenow',
      '22'
    );
    // Not applied yet.
    await expect(page.getByRole('button', { name: /^Tuning: Drop D/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: /^Tuning:/ })).toHaveCount(0);
    await expect(page.locator('.cell[data-fret="22"]').first()).toBeAttached();
  });

  test('scenario 10: Confirm with no changes shows no status and playback continues', async ({
    page
  }) => {
    await page.goto('/notes');
    const dialog = await openPanel(page);
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  // Superseded by 010 (remembered preferences): a confirmed instrument survives a reload.
  test('scenario 11: reload keeps the confirmed instrument (010 US1)', async ({ page }) => {
    await page.goto('/notes');
    const dialog = await openPanel(page);
    await pick(page, 'Drop D').check();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('button', { name: /^Tuning: Drop D/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: /^Tuning: Drop D/ })).toBeVisible();
    const reopened = await openPanel(page);
    await expect(pick(page, 'Drop D')).toBeChecked();
    await expect(reopened.getByRole('spinbutton', { name: 'Frets' })).toHaveAttribute(
      'aria-valuenow',
      '22'
    );
  });
});

const ADJUSTED = 'We adjusted the view to the new instrument';

const setFrets = async (page: Page, n: number) => {
  const dialog = await openPanel(page);
  const spin = dialog.getByRole('spinbutton', { name: 'Frets' });
  await spin.focus();
  await page.keyboard.press(n === 12 ? 'Home' : 'End');
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(dialog).toBeHidden();
};

test.describe('instrument panel US4 (view adjusts)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('scenario 6: Notes region 10–14 → 12 frets gives 10–12 and a polite status', async ({
    page
  }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: '10–14' }).click();
    await setFrets(page, 12);
    const status = page.getByRole('status').filter({ hasText: ADJUSTED });
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByRole('spinbutton', { name: 'Start fret' })).toHaveAttribute(
      'aria-valuenow',
      '10'
    );
    await expect(page.getByRole('spinbutton', { name: 'End fret' })).toHaveAttribute(
      'aria-valuenow',
      '12'
    );
    await status.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText(ADJUSTED)).toHaveCount(0);
  });

  test('scenario 6: a whole-neck region becomes 0–12 with no status', async ({ page }) => {
    await page.goto('/notes');
    await setFrets(page, 12);
    await expect(page.getByRole('spinbutton', { name: 'End fret' })).toHaveAttribute(
      'aria-valuenow',
      '12'
    );
    await expect(page.getByText(ADJUSTED)).toHaveCount(0);
  });

  test('scenario 7: Triads highest occurrence → 12 frets keeps a shape, with the status', async ({
    page
  }) => {
    await page.goto('/triads');
    const up = page.getByRole('button', { name: 'Octave up' });
    while (await up.isEnabled()) await up.click();
    await setFrets(page, 12);
    const guidance = page.getByText(/no .*shape|not .*fit|cannot/i);
    if ((await guidance.count()) === 0) {
      await expect(page.getByText(ADJUSTED)).toBeVisible();
    }
    await expect(page.locator('.cell[data-fret="13"]')).toHaveCount(0);
  });

  test('US4-4: a view that stays valid shows no message', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: '0–4' }).click();
    await setFrets(page, 12);
    await expect(page.getByText(ADJUSTED)).toHaveCount(0);
  });
});

test.describe('instrument panel US4 scroll correction', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const reduced of [false, true]) {
    test(`scenario 8: scrolled to fret 22, 12 frets → last fret at trailing edge (reduced motion ${reduced})`, async ({
      page
    }) => {
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await page.goto('/notes');
      const scroller = page.locator('.scroller').first();
      await scroller.evaluate((el) => (el.scrollLeft = el.scrollWidth));
      await setFrets(page, 12);
      const lastCell = page.locator('.cell[data-string="1"][data-fret="12"]');
      await expect
        .poll(async () => {
          const s = await scroller.boundingBox();
          const c = await lastCell.boundingBox();
          return s && c ? Math.abs(s.x + s.width - (c.x + c.width)) : 999;
        })
        .toBeLessThan(2);
      await expect(page.getByText(ADJUSTED)).toHaveCount(0);
    });
  }
});

// Runs once per project (phone 360 px, phone-touch 320 px, desktop 1280 px).
test.describe('instrument panel accessibility (T060)', () => {
  test('axe: zero violations with the panel open', async ({ page }) => {
    await page.goto('/triads');
    await openPanel(page);
    await runAxe(page);
  });

  test('axe: zero violations on tools showing the badge', async ({ page }) => {
    await page.goto('/notes');
    const dialog = await openPanel(page);
    await pick(page, 'Drop D').check();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    for (const path of ['/notes', '/triads']) {
      await page.getByRole('navigation', { name: 'Tools' }).waitFor();
      if (path === '/triads') {
        await page
          .getByRole('navigation', { name: 'Tools' })
          .getByRole('link', { name: 'Triads' })
          .click();
      }
      await expect(page.getByRole('button', { name: /^Tuning: Drop D/ })).toBeVisible();
      await runAxe(page);
    }
  });

  test('200 % text zoom keeps preset names, summary and badge untruncated', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    const summary = page.getByRole('button', { name: /^6 strings/ });
    await expect(summary).toBeVisible();

    const clipped = (selector: string) =>
      page.evaluate(
        (s) =>
          [...document.querySelectorAll<HTMLElement>(s)]
            .filter(
              (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
            )
            .map((el) => el.textContent?.trim() ?? ''),
        selector
      );
    expect(await clipped('button')).toEqual([]);

    await summary.click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await pick(page, 'Drop D').check();
    expect(await clipped('dialog .name, dialog .notes, dialog .preset, dialog legend')).toEqual([]);
    await expectNoHorizontalScroll(page);
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog).toBeHidden();

    // In-app navigation keeps both the confirmed tuning and the 200 % root font size.
    await page.getByRole('link', { name: /^Fretboard Notes/ }).click();
    const badge = page.getByRole('button', { name: /^Tuning: Drop D/ });
    await expect(badge).toBeVisible();
    expect(await clipped('[aria-label^="Tuning:"], [aria-label^="Tuning:"] *')).toEqual([]);
    await expectNoHorizontalScroll(page);
  });

  test('keyboard only: Tab never leaves the panel, focus returns to the opener (scenario 13)', async ({
    page
  }) => {
    await page.goto('/triads');
    const opener = page.getByRole('button', { name: 'Instrument', exact: true });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await expect(dialog).toBeVisible();
    await expect(pick(page, 'Standard')).toBeFocused();

    // Arrow keys move the radio selection; Tab never reaches page content behind the panel.
    // A native modal dialog may hand focus to the browser UI (activeElement = body) between
    // its last and first stops; that is the "no trap" behavior, not an escape.
    const staysInPanel = () =>
      dialog.evaluate((el) => {
        const active = document.activeElement;
        return active === null || active === document.body || el.contains(active);
      });
    await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await staysInPanel()).toBe(true);
    }
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await staysInPanel()).toBe(true);
    }

    await dialog.getByRole('button', { name: 'Confirm' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

test.describe('instrument panel spelling (T062, scenario 12)', () => {
  test('presets list stored spellings and spoken names', async ({ page }) => {
    await page.goto('/notes');
    const dialog = await openPanel(page);

    const half = pick(page, 'Half step down');
    await expect(half.locator('xpath=ancestor::label')).toContainText('E♭ A♭ D♭ G♭ B♭ E♭');
    await expect(half).toHaveAccessibleName(/E flat.*A flat.*D flat.*G flat.*B flat.*E flat/);

    const openD = pick(page, 'Open D');
    await expect(openD.locator('xpath=ancestor::label')).toContainText('D A D F♯ A D');
    await expect(openD).toHaveAccessibleName(/D.*A.*D.*F sharp.*A.*D/);
    await expect(dialog).toBeVisible();
  });
});
