import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe, trackRequests } from './support/helpers';

const card = (page: Page, name: RegExp) => page.getByRole('list').getByRole('link', { name });
const muteButton = (page: Page) => page.getByRole('button', { name: 'Mute sound' });

/** `goto` resolves on load, before hydration records the opened tool; wait for that write. */
async function openTool(page: Page, tool: 'notes' | 'triads'): Promise<void> {
  await page.goto(`/${tool}`);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('fretboard-master:prefs')))
    .toContain(`"lastTool":"${tool}"`);
}

async function setDropDAndFrets(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /^6 strings/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Instrument' });
  await dialog.getByRole('radio', { name: /^Drop D:/ }).check();
  const spin = dialog.getByRole('spinbutton', { name: 'Frets' });
  await spin.focus();
  await page.keyboard.press('End');
  await dialog.getByRole('button', { name: 'Confirm' }).click();
}

async function setSound(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sound settings' }).click();
  await page.getByRole('slider', { name: 'Volume' }).fill('40');
  await muteButton(page).click();
}

test.describe('remembered preferences: US1', () => {
  test('US1-1, US1-4: instrument, sound and labels survive a reload', async ({ page }) => {
    await setDropDAndFrets(page);
    await setSound(page);
    await page.goto('/notes');
    await page
      .getByRole('radiogroup', { name: 'Label' })
      .getByRole('radio', { name: 'Octave' })
      .click();
    await page.goto('/triads');
    await page.getByRole('radio', { name: 'Note names' }).click();

    await page.goto('/');
    await page.reload();

    await expect(
      page.getByRole('button', { name: '6 strings · Drop D · right-handed' })
    ).toBeVisible();
    await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: /^6 strings/ }).click();
    await expect(
      page.getByRole('dialog', { name: 'Instrument' }).getByRole('spinbutton', { name: 'Frets' })
    ).toHaveAttribute('aria-valuenow', '24');
    await page
      .getByRole('dialog', { name: 'Instrument' })
      .getByRole('button', { name: 'Close' })
      .click();
    await page.getByRole('button', { name: 'Sound settings' }).click();
    await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('40');

    await page.goto('/notes');
    await expect(
      page.getByRole('radiogroup', { name: 'Label' }).getByRole('radio', { name: 'Octave' })
    ).toBeChecked();
    await page.goto('/triads');
    await expect(page.getByRole('radio', { name: 'Note names' })).toBeChecked();
  });

  test('US1-2: the last tool shows Continue; card order is unchanged', async ({ page }) => {
    await openTool(page, 'triads');
    await page.goto('/');
    await page.reload();
    const cards = page.getByRole('list').getByRole('link');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveAccessibleName('Fretboard Notes — Where is every note?');
    await expect(cards.nth(1)).toHaveAccessibleName('Continue: Triads. What is a chord made of?');
    await expect(page.getByText('Continue', { exact: true })).toHaveCount(1);
    await expectNoHorizontalScroll(page);
    await runAxe(page);
  });

  test('US1-3: musical selection is not restored (SC-005)', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: 'Hide names', exact: true }).click();
    await page.goto('/triads');
    await page
      .getByRole('radiogroup', { name: 'Quality' })
      .getByRole('radio', { name: 'minor' })
      .click();
    await expect(page.getByText('C minor — Root position', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    await page.goto('/notes');
    await expect(page.getByRole('button', { name: 'Hide names', exact: true })).toBeVisible();
    await expect(page.locator('.marker.selected')).toHaveCount(0);
  });

  test('US1-5: first visit has defaults and no Continue', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Continue', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '6 strings · standard tuning · right-handed' })
    ).toBeVisible();
    await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: 'Sound settings' }).click();
    await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('80');
  });

  test('About, Home and not-found do not change the last tool', async ({ page }) => {
    await openTool(page, 'notes');
    await page.goto('/about');
    await page.goto('/');
    await page.goto('/no-such-page');
    await page.goto('/');
    await expect(card(page, /^Continue: Fretboard Notes/)).toHaveCount(1);
    await expect(card(page, /^Continue: Triads/)).toHaveCount(0);
  });
});

const PREFS_KEY = 'fretboard-master:prefs';
const NOTICE = "Preferences won't be remembered on this device.";
const notice = (page: Page) => page.getByRole('status').filter({ hasText: NOTICE });

/** Seed a stored record before any page script runs. */
async function seed(page: Page, raw: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (localStorage.getItem('__seeded') === null) {
          localStorage.setItem(key as string, value as string);
          localStorage.setItem('__seeded', '1');
        }
      } catch {
        // storage unavailable
      }
    },
    [PREFS_KEY, raw]
  );
}

const standardSummary = (page: Page) =>
  page.getByRole('button', { name: '6 strings · standard tuning · right-handed' });

test.describe('remembered preferences: US2', () => {
  test('US2-1: blocked storage → defaults, one notice, none after navigating', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        }
      });
    });
    await page.goto('/');
    await expect(notice(page)).toHaveCount(1);
    await expect(standardSummary(page)).toBeVisible();
    await runAxe(page);
    await card(page, /Triads/).click();
    await expect(page).toHaveURL(/\/triads$/);
    await expect(notice(page)).toHaveCount(0);
    await page.getByRole('link', { name: 'Home' }).first().click();
    await expect(notice(page)).toHaveCount(0);
  });

  test('US2-1: Dismiss hides the notice', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        }
      });
    });
    await page.goto('/');
    await notice(page).getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice(page)).toHaveCount(0);
  });

  test('US2-2: valid tuning with invalid volume keeps the tuning', async ({ page }) => {
    await seed(page, '{"version":1,"tuning":"AF-2","volume":3}');
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: /^6 strings · (?!standard tuning)/ })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Sound settings' }).click();
    await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('80');
    await expect(notice(page)).toHaveCount(0);
  });

  for (const [label, raw] of [
    ['garbage text', 'not json at all {{{'],
    ['array', '[1,2,3]'],
    ['string', '"just a string"']
  ] as const) {
    test(`US2-3: ${label} → defaults, no notice`, async ({ page }) => {
      await seed(page, raw);
      await page.goto('/');
      await expect(standardSummary(page)).toBeVisible();
      await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'false');
      await expect(notice(page)).toHaveCount(0);
      await expect(page.getByText('Continue', { exact: true })).toHaveCount(0);
    });
  }

  test('US2-4: future version keeps recognizable items', async ({ page }) => {
    await seed(
      page,
      '{"version":7,"tuning":"AF-5","handedness":"left","tempo":"slow","muted":true}'
    );
    await page.goto('/');
    await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^6 strings/ })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test('US2-5: rejecting setItem → nothing visible fails, setting holds for the session', async ({
    page
  }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === 'fretboard-master:prefs') throw new DOMException('full', 'QuotaExceededError');
        return original.call(this, key, value);
      };
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await muteButton(page).click();
    await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'true');
    await card(page, /Triads/).click();
    await page.getByRole('link', { name: 'Home' }).first().click();
    await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('US2-6: each out-of-range value resets that item only', async ({ page }) => {
    await seed(
      page,
      JSON.stringify({
        version: 1,
        tuning: 'AF-99',
        frets: 99,
        muted: 'true',
        volume: 3,
        lastTool: 'caged',
        labels: { notes: 'octave', triads: 'octave' }
      })
    );
    await page.goto('/');
    await expect(standardSummary(page)).toBeVisible();
    await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Continue', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Sound settings' }).click();
    await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('80');
    await page.goto('/notes');
    await expect(
      page.getByRole('radiogroup', { name: 'Label' }).getByRole('radio', { name: 'Octave' })
    ).toBeChecked();
    await page.goto('/triads');
    await expect(page.getByRole('radio', { name: 'Intervals' })).toBeChecked();
  });

  test('US2-7: oversize value → all defaults; markup is never rendered', async ({ page }) => {
    await seed(page, 'a'.repeat(16_385));
    await page.goto('/');
    await expect(standardSummary(page)).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test('US2-7: markup in a stored value is not rendered', async ({ page }) => {
    await seed(page, '{"tuning":"<img src=x onerror=alert(1)>","lastTool":"<b>x</b>"}');
    let dialogs = 0;
    page.on('dialog', async (d) => {
      dialogs++;
      await d.dismiss();
    });
    await page.goto('/');
    await expect(standardSummary(page)).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    await expect(page.locator('main b')).toHaveCount(0);
    expect(dialogs).toBe(0);
  });

  test('SC-007: preferences never cause a network request', async ({ page }) => {
    const tracked = trackRequests(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    tracked.start();
    await muteButton(page).click();
    await card(page, /Triads/).click();
    await page.getByRole('link', { name: 'Home' }).first().click();
    await page.reload({ waitUntil: 'networkidle' });
    const prefsRequests = tracked.requests.filter((r) => /pref|storage|sync/i.test(r.url()));
    expect(prefsRequests).toEqual([]);
  });
});

test.describe('remembered preferences: US3', () => {
  const erase = (page: Page) => page.getByRole('button', { name: 'Erase my preferences' });
  const storedKeys = (page: Page) =>
    page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fretboard-master:')));

  async function setNonDefault(page: Page): Promise<void> {
    await page.goto('/triads');
    await setDropDAndFrets(page);
    await setSound(page);
    await page.goto('/about');
  }

  test('US3-1: erase → defaults, Home, no Continue', async ({ page }) => {
    await setNonDefault(page);
    await erase(page).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(card(page, /^Continue:/)).toHaveCount(0);
    await expect(standardSummary(page)).toBeVisible();
    await expect(muteButton(page)).toBeVisible();
  });

  test('US3-2: Cancel changes nothing', async ({ page }) => {
    await setNonDefault(page);
    const before = await storedKeys(page);
    await erase(page).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(erase(page)).toBeFocused();
    expect(await storedKeys(page)).toEqual(before);
  });

  test('US3-3: reload after erase still shows defaults, no stored key', async ({ page }) => {
    await setNonDefault(page);
    await erase(page).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page).toHaveURL('/');
    expect(await storedKeys(page)).toEqual([]);
    await page.reload();
    await expect(standardSummary(page)).toBeVisible();
    await expect(card(page, /^Continue:/)).toHaveCount(0);
    expect(await storedKeys(page)).toEqual([]);
  });

  test('US3-4: keyboard-only confirm and cancel with focus rules; SC-004 two actions', async ({
    page
  }) => {
    await page.goto('/about');
    await erase(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(erase(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Erase', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('axe: About idle and confirming', async ({ page }) => {
    await page.goto('/about');
    await runAxe(page);
    await erase(page).click();
    await expect(page.getByText('Erase all preferences on this device?')).toBeVisible();
    await runAxe(page);
    await expectNoHorizontalScroll(page);
  });
});

test.describe('remembered preferences: US4', () => {
  test('US4-1: another tab is unchanged after a change; US4-2: a new page shows the latest write', async ({
    page,
    context
  }) => {
    await page.goto('/');
    const other = await context.newPage();
    await other.goto('/');
    await expect(muteButton(other)).toHaveAttribute('aria-pressed', 'false');

    await muteButton(page).click();
    await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'true');
    // the other tab never reacts live (FR-015)
    await other.waitForTimeout(300);
    await expect(muteButton(other)).toHaveAttribute('aria-pressed', 'false');

    const third = await context.newPage();
    await third.goto('/');
    await expect(muteButton(third)).toHaveAttribute('aria-pressed', 'true');

    // last write wins: the other tab changes a different setting, a fresh page sees it
    await other.getByRole('button', { name: 'Sound settings' }).click();
    await other.getByRole('slider', { name: 'Volume' }).fill('30');
    const fourth = await context.newPage();
    await fourth.goto('/');
    await fourth.getByRole('button', { name: 'Sound settings' }).click();
    await expect(fourth.getByRole('slider', { name: 'Volume' })).toHaveValue('30');
    // the tab that wrote earlier still shows its own state
    await expect(muteButton(page)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('remembered preferences: custom tuning (011 US5)', () => {
  const customSummary = (page: Page) =>
    page.getByRole('button', { name: '6 strings · Custom · right-handed' });

  test('AS 5.1: a confirmed custom tuning survives a reload with the same notes', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^6 strings/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await dialog.getByRole('radio', { name: 'Custom' }).check();
    await dialog.getByRole('button', { name: 'Lower string 6' }).click();
    await dialog.getByRole('button', { name: 'Lower string 4' }).click();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(customSummary(page)).toBeVisible();

    await page.reload();
    await expect(customSummary(page)).toBeVisible();
    await page.getByRole('button', { name: /^6 strings/ }).click();
    const reopened = page.getByRole('dialog', { name: 'Instrument' });
    await expect(reopened.getByRole('radio', { name: 'Custom' })).toBeChecked();
    await expect(reopened.getByRole('button', { name: 'String 6, D sharp 2' })).toBeVisible();
    await expect(reopened.getByRole('button', { name: 'String 4, C sharp 3' })).toBeVisible();
  });

  test('AS 5.3: a damaged customTuning loads Standard with no error screen', async ({ page }) => {
    await seed(page, '{"version":1,"tuning":"AF-1","customTuning":[0,0,0,0,0,9]}');
    await page.goto('/');
    await expect(standardSummary(page)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('AS 5.5: erasing preferences resets a custom tuning to Standard', async ({ page }) => {
    await seed(page, '{"version":1,"tuning":"AF-1","customTuning":[-2,0,0,-1,0,0]}');
    await page.goto('/');
    await expect(customSummary(page)).toBeVisible();
    await page.goto('/about');
    await page.getByRole('button', { name: 'Erase my preferences' }).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(standardSummary(page)).toBeVisible();
  });
});
