import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { expandDetails, trackRequests } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';

/** SC-002: device locale → resolved interface language, with no stored choice. */
const DEVICE_CASES: ReadonlyArray<readonly [string, string]> = [
  ['pt-PT', 'pt-BR'],
  ['pt-BR', 'pt-BR'],
  ['es-ES', 'es'],
  ['es-MX', 'es'],
  ['es-419', 'es'],
  ['en-GB', 'en'],
  ['en-US', 'en'],
  ['fr', 'en'],
  ['ja', 'en']
];

test.describe('first visit: device language detection', () => {
  for (const [device, expected] of DEVICE_CASES) {
    test.describe(`device ${device}`, () => {
      test.use({ locale: device });

      test(`<html lang> is ${expected}`, async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('lang', expected);
      });
    });
  }

  test('first matching entry of navigator.languages wins', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['fr-FR', 'es-MX'],
        configurable: true
      });
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test.describe('device pt-PT', () => {
    test.use({ locale: 'pt-PT' });

    test('detection never writes a stored language (US1-5)', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
      const stored = await page.evaluate((key) => localStorage.getItem(key), PREFS_KEY);
      expect(stored === null || !stored.includes('"language"')).toBe(true);
    });
  });

  for (const [device, expected] of [
    ['es-ES', 'es'],
    ['pt-BR', 'pt-BR']
  ] as const) {
    test.describe(`hydration with device ${device}`, () => {
      test.use({ locale: device });

      test('first load emits no hydration_mismatch (FR-014)', async ({ page }) => {
        const messages: string[] = [];
        page.on('console', (msg) => messages.push(msg.text()));
        page.on('pageerror', (err) => messages.push(err.message));
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('lang', expected);
        await page.waitForLoadState('networkidle');
        expect(messages.filter((text) => text.includes('hydration_mismatch'))).toEqual([]);
      });
    });
  }
});

type Catalog = Record<string, string>;
const catalog = (tag: string): Catalog =>
  JSON.parse(readFileSync(`messages/${tag}.json`, 'utf8')) as Catalog;
const EN = catalog('en');
/** Catalog text for `tag`, with English fallback exactly as the app does (US3 fills the gaps). */
const text = (tag: string, key: string): string => catalog(tag)[key] ?? EN[key] ?? key;
const title = (tag: string, toolKey: string): string =>
  text(tag, 'title_screen').replace('{screen}', text(tag, toolKey));

const TOOLS = ['/notes', '/triads', '/caged', '/about'] as const;

const languageButton = (page: Page) => page.getByRole('button', { name: 'Language', exact: true });
/** Stable across language switches (the accessible name is translated). */
const panel = (page: Page) => page.locator('div[role="region"][id^="language-panel-"]');
// The region's accessible name is translated; the single grid is language-independent.
const board = (page: Page) => page.getByRole('grid');
const storedLanguage = (page: Page) =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : ((JSON.parse(raw) as { language?: string }).language ?? null);
  }, PREFS_KEY);

async function openPanel(page: Page): Promise<void> {
  await languageButton(page).click();
  await expect(panel(page)).toBeVisible();
}

test.describe('switch language anywhere (US2)', () => {
  test.use({ locale: 'en-US' });

  test('US2-1: Triads comparison survives English → Español', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await expect(board(page).locator('.marker')).toHaveCount(3);
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await page
      .getByRole('radiogroup', { name: 'Compare with' })
      .getByRole('radio', { name: 'minor' })
      .click();
    const comparison = board(page).locator('.marker.comparison');
    const before = await comparison.count();
    expect(before).toBeGreaterThan(0);
    // The address follows after a 150 ms debounce; capture it once it carries the comparison.
    await expect.poll(() => page.url()).toMatch(/cmp=1&cq=minor/);
    const url = page.url();

    await openPanel(page);
    await panel(page).getByRole('radio', { name: 'Español' }).check();

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(comparison).toHaveCount(before);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      text('es', 'tool_triads_name')
    );
    expect(page.url()).toBe(url);
    // Root interval label follows the catalog (R in English, T in Portuguese and Spanish after US3).
    await expect(
      page.getByText(text('es', 'interval_root'), { exact: true }).first()
    ).toBeAttached();
  });

  for (const path of TOOLS) {
    test(`US2-2 / SC-008: ${path} switch changes no URL, history or requests`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const tracker = trackRequests(page);
      tracker.start();
      const url = page.url();
      const history = await page.evaluate(() => window.history.length);
      const scroll = await page.evaluate(() => [window.scrollX, window.scrollY]);

      await openPanel(page);
      await expect(languageButton(page)).toHaveAttribute('aria-expanded', 'true');
      await panel(page).getByRole('radio', { name: 'Português' }).check();
      await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
      // The panel stays open and is now named in Portuguese.
      await expect(
        page.getByRole('region', { name: text('pt-BR', 'language_panel_label') })
      ).toBeVisible();
      await expect(panel(page).getByRole('radio', { name: 'Português' })).toBeFocused();

      expect(page.url()).toBe(url);
      expect(await page.evaluate(() => window.history.length)).toBe(history);
      expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual(scroll);
      expect(tracker.requests.map((r) => r.url())).toEqual([]);
    });
  }

  test('US2-2: opening the panel does not move focus away from the tool or play sound', async ({
    page
  }) => {
    await page.goto('/notes');
    await expandDetails(page);
    await openPanel(page);
    await panel(page).getByRole('radio').first().focus();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(languageButton(page)).toBeFocused();
  });

  test('US2-3: chosen language is remembered across a reload with another device language', async ({
    page
  }) => {
    await page.goto('/notes');
    await expandDetails(page);
    await openPanel(page);
    await panel(page).getByRole('radio', { name: 'Português' }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    expect(await storedLanguage(page)).toBe('pt-BR');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(
      page.getByRole('button', { name: text('pt-BR', 'language_open'), exact: true })
    ).toBeVisible();
  });

  test('US2-4: home shows the inline selector with per-option lang', async ({ page }) => {
    await page.goto('/');
    const group = page.getByRole('group', { name: 'Language' });
    await expect(group.getByRole('radio')).toHaveCount(3);
    await expect(group.locator('label[lang="en"]')).toHaveText('English');
    await expect(group.locator('label[lang="pt-BR"]')).toHaveText('Português');
    await expect(group.locator('label[lang="es"]')).toHaveText('Español');
    await expect(page.getByRole('button', { name: 'Language', exact: true })).toHaveCount(0);
    await group.getByRole('radio', { name: 'Español' }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('group', { name: text('es', 'language_label') })).toBeVisible();
    expect(await storedLanguage(page)).toBe('es');
  });

  test('US2-5: <html lang> and document.title follow the choice', async ({ page }) => {
    await page.goto('/triads');
    await expandDetails(page);
    await expect(page).toHaveTitle(title('en', 'tool_triads_name'));
    await openPanel(page);
    for (const [label, tag] of [
      ['Español', 'es'],
      ['Português', 'pt-BR'],
      ['English', 'en']
    ] as const) {
      await panel(page).getByRole('radio', { name: label }).check();
      await expect(page.locator('html')).toHaveAttribute('lang', tag);
      await expect(page).toHaveTitle(title(tag, 'tool_triads_name'));
    }
  });

  test('US2-6: an open notice stays open with updated text after a switch', async ({ page }) => {
    await page.goto('/no-such-page');
    const notice = page.getByRole('status').filter({ hasText: text('en', 'notice_not_found') });
    await expect(notice).toBeVisible();
    await page
      .getByRole('group', { name: 'Language' })
      .getByRole('radio', { name: 'Español' })
      .check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(
      page.getByRole('status').filter({ hasText: text('es', 'notice_not_found') })
    ).toBeVisible();
  });

  test('R-14: erasing preferences returns to the device language immediately', async ({ page }) => {
    await page.goto('/about');
    await openPanel(page);
    await panel(page).getByRole('radio', { name: 'Español' }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await page.getByRole('button', { name: text('es', 'about_erase') }).click();
    await page
      .getByRole('button', { name: text('es', 'about_erase_confirm'), exact: true })
      .click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await storedLanguage(page)).toBeNull();
  });
});

/** US3 / contracts/language-ui.md §6: texts read from the catalogs by key, per language. */
const SCREEN_SAMPLES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['/', ['tool_notes_name', 'tool_triads_question', 'nav_about', 'language_label']],
  ['/notes', ['nav_home', 'nav_about', 'fretboard_describe']],
  ['/triads', ['nav_home', 'nav_about', 'fretboard_describe']],
  ['/caged', ['nav_home', 'nav_about', 'fretboard_describe']],
  ['/about', ['nav_home', 'nav_about', 'about_heading']]
];

for (const tag of ['en', 'pt-BR', 'es'] as const) {
  test.describe(`per-screen text in ${tag} (US3)`, () => {
    test.use({ locale: tag });

    for (const [path, keys] of SCREEN_SAMPLES) {
      test(`${path} reads in ${tag}`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('lang', tag);
        for (const key of keys) {
          await expect(
            page.getByText(text(tag, key), { exact: true }).first(),
            `${path} ${key}`
          ).toBeAttached();
        }
        if (tag !== 'en') {
          // No mixed languages: the English text of a translated key is not on screen.
          const english = EN[keys.find((k) => k !== 'language_label') ?? 'nav_home'];
          if (english !== text(tag, keys[0])) {
            await expect(page.getByText(english, { exact: true })).toHaveCount(0);
          }
        }
      });
    }

    test('instrument panel shows the translated tuning and the English-kept Drop D', async ({
      page
    }) => {
      await page.goto('/notes');
      await expandDetails(page);
      await page.getByRole('button', { name: text(tag, 'instrument_button'), exact: true }).click();
      const dialog = page.getByRole('dialog', { name: text(tag, 'instrument_panel_title') });
      await expect(
        dialog.getByRole('radio', { name: new RegExp(`^${text(tag, 'tuning_af1')}:`) })
      ).toBeAttached();
      // 021: the tuning's note follows the default notation (solfège in es only).
      const drop = { en: 'Drop D', 'pt-BR': 'Drop D', es: 'Drop Re' }[tag];
      await expect(dialog.getByRole('radio', { name: new RegExp(`^${drop}:`) })).toBeAttached();
      expect(text(tag, 'tuning_af4')).toBe('Drop {note}');
    });

    test('root label is R in English and T in Portuguese and Spanish; note names follow the language default', async ({
      page
    }) => {
      await page.goto('/triads');
      await expandDetails(page);
      const root = tag === 'en' ? 'R' : 'T';
      expect(text(tag, 'interval_root')).toBe(root);
      await expect(board(page).getByText(root, { exact: true }).first()).toBeAttached();
      // 021: note names follow the language default: letters in en and pt-BR, solfège in es.
      const c = { en: /^C\b/, 'pt-BR': /^C\b/, es: /^Do\b/ }[tag];
      await expect(board(page).getByRole('gridcell', { name: c }).first()).toBeAttached();
      if (tag !== 'es') await expect(board(page).getByText(/^(Dó|Do|Ré|Re)$/)).toHaveCount(0);
    });

    test('accidental symbols are unchanged in every language', async ({ page }) => {
      await page.goto('/notes');
      await expandDetails(page);
      for (const key of ['accidental_sharp', 'accidental_flat']) {
        if (key in EN) expect(text(tag, key)).toBe(EN[key]);
      }
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/\b(sustenido|sostenido|bemol)\b/i);
      for (const symbol of ['♯', '♭', '𝄪', '𝄫']) {
        for (const key of Object.keys(EN)) {
          if (EN[key].includes(symbol)) expect(text(tag, key), key).toContain(symbol);
        }
      }
    });
  });
}
