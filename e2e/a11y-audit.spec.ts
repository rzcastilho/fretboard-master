import { expect, test, type Page } from '@playwright/test';

import { runAxe } from './support/helpers';

/** US6: zero axe violations on every screen/state, names/roles/states on controls, every sound has a visible counterpart. */

const PREFS_KEY = 'fretboard-master:prefs';
const LANGUAGES = ['en', 'pt-BR', 'es'] as const;
const THEMES = ['light', 'dark'] as const;

type PanelState = 'default' | 'legend' | 'description' | 'instrument';

interface Target {
  name: string;
  path: string;
  /** Panel states that exist on this screen. */
  states: PanelState[];
  ready: (page: Page) => Promise<void>;
}

const TOOL_STATES: PanelState[] = ['default', 'legend', 'description', 'instrument'];
const fretboardReady = (page: Page) => page.locator('.nut').first().waitFor();

const TARGETS: Target[] = [
  {
    name: 'home',
    path: '/',
    states: ['default', 'instrument'],
    ready: (p) => p.locator('main').waitFor()
  },
  { name: 'notes', path: '/notes', states: TOOL_STATES, ready: fretboardReady },
  { name: 'triads', path: '/triads', states: TOOL_STATES, ready: fretboardReady },
  { name: 'caged', path: '/caged', states: TOOL_STATES, ready: fretboardReady },
  { name: 'about', path: '/about', states: ['default'], ready: (p) => p.locator('main').waitFor() },
  {
    name: 'not-found',
    path: '/no-such-page',
    states: ['default'],
    ready: (p) => p.getByRole('status').first().waitFor()
  },
  {
    // A received share link whose view had to be adjusted, so the polite notice is on screen.
    name: 'received-link',
    path: '/caged?v=1&rt=2',
    states: ['default'],
    ready: (p) => p.locator('main').waitFor()
  }
];

async function seedPrefs(page: Page, language: string) {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key as string) === null) {
        localStorage.setItem(key as string, value as string);
      }
    },
    [
      PREFS_KEY,
      JSON.stringify({
        version: 1,
        tuning: 'AF-1',
        frets: 22,
        muted: false,
        volume: 0.8,
        labels: { notes: 'name', triads: 'interval' },
        language
      })
    ]
  );
}

/** Language-independent: the two view-aid buttons are the only `aria-controls` buttons in `.view-aids`. */
const viewAidButton = (page: Page, index: 0 | 1) =>
  page.locator('.view-aids .buttons button').nth(index);

async function applyState(page: Page, state: PanelState) {
  if (state === 'legend' || state === 'description') {
    const button = viewAidButton(page, state === 'description' ? 0 : 1);
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  } else if (state === 'instrument') {
    await page.locator('.instrument-button, .instrument-summary').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
}

test.describe('axe matrix (US6-1)', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const colorScheme of THEMES) {
    for (const language of LANGUAGES) {
      test.describe(`${colorScheme} · ${language}`, () => {
        test.use({ colorScheme, locale: language });

        for (const target of TARGETS) {
          for (const state of target.states) {
            test(`${target.name} — ${state}`, async ({ page }) => {
              await seedPrefs(page, language);
              await page.goto(target.path);
              await target.ready(page);
              await applyState(page, state);
              await runAxe(page);
            });
          }
        }
      });
    }
  }
});

test.describe('name, role and state (US6-2)', () => {
  test('view-aid toggles expose expanded state and controls', async ({ page }) => {
    await page.goto('/triads');
    for (const name of ['Describe this view', 'Legend']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(button).toHaveAttribute('aria-controls', /.+/);
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
    }
  });

  test('Triads selectors are named groups with checked radios', async ({ page }) => {
    await page.goto('/triads');
    await expect(page.getByRole('group', { name: 'Root' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Inversion' })).toBeVisible();
    await expect(
      page.getByRole('radiogroup', { name: 'Inversion' }).getByRole('radio', { checked: true })
    ).toHaveCount(1);
  });

  test('Notes toggles report pressed state', async ({ page }) => {
    await page.goto('/notes');
    const note = page
      .getByRole('group', { name: 'Choose notes' })
      .getByRole('button', { name: 'C', exact: true });
    await expect(note).toHaveAttribute('aria-pressed', 'false');
    await note.click();
    await expect(note).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('group', { name: 'Strings' }).getByRole('button', { name: /^String 6/ })
    ).toHaveAttribute('aria-pressed', /true|false/);
  });

  test('CAGED layer switches report checked state', async ({ page }) => {
    await page.goto('/caged');
    const layers = page.getByRole('group', { name: 'Layers' }).getByRole('switch');
    expect(await layers.count()).toBeGreaterThan(0);
    for (const sw of await layers.all()) {
      await expect(sw).toHaveAttribute('aria-checked', /true|false/);
    }
  });

  test('instrument panel is a named dialog with named fret steppers', async ({ page }) => {
    await page.goto('/triads');
    await page.getByRole('button', { name: 'Instrument', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /fewer frets|decrease/i }).first()
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /more frets|increase/i }).first()
    ).toBeVisible();
  });

  test('navigation exposes the current page and the fretboard is a named region', async ({
    page
  }) => {
    await page.goto('/triads');
    await expect(page.getByRole('region', { name: 'Fretboard' })).toBeVisible();
    await expect(page.locator('[aria-current="page"]').first()).toBeVisible();
  });
});

test.describe('polite status messages (US6-2)', () => {
  test('notice on a received link is a polite status and takes no focus', async ({ page }) => {
    await page.goto('/caged?v=1&rt=2');
    const notice = page.locator('.notice[role="status"][aria-live="polite"]');
    await expect(notice.first()).toBeVisible();
    const focused = await page.evaluate(() => document.activeElement?.closest('.notice') ?? null);
    expect(focused).toBeNull();
  });

  test('not-found notice is a polite status', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.locator('.notice[role="status"][aria-live="polite"]')).toBeVisible();
  });

  test('adjusted-view note is a status and the view-aid live region is polite', async ({
    page
  }) => {
    await page.goto('/caged');
    await expect(page.locator('.view-aids [aria-live="polite"][aria-atomic="true"]')).toHaveCount(
      1
    );
  });

  test('copy confirmation is announced politely without moving focus', async ({
    page,
    context
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    });
    await page.goto('/triads');
    const share = page.getByRole('banner').getByRole('button', { name: 'Share', exact: true });
    await share.click();
    const status = page.getByRole('status').filter({ hasText: /copied/i });
    await expect(status.first()).toBeVisible();
    await expect(share).toBeFocused();
  });
});

test.describe('sound → visible inventory (US6-3)', () => {
  test('tapping a position pulses its marker', async ({ page }) => {
    await page.goto('/notes');
    await page.locator('.cell[data-string="6"][data-fret="0"]').click();
    await expect(page.locator('.marker.pulse')).toHaveCount(1);
  });

  test('Triads Listen shows pulsing markers during playback', async ({ page }) => {
    await page.goto('/triads');
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await expect(page.locator('.marker.pulse').first()).toBeVisible();
  });

  test('CAGED Listen shows pulsing markers and a progress status during playback', async ({
    page
  }) => {
    await page.goto('/caged');
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await expect(page.locator('.marker.pulse').first()).toBeAttached();
    await expect(page.locator('[data-listen-status]')).toHaveText(/Playing/);
  });
});
