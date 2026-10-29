import { expect, test, type Page } from '@playwright/test';
import { expandDetails, expectNoHorizontalScroll, runAxe, setTextScale } from './support/helpers';

type ShareCall = { url: string; title: string };
type ShareGlobals = { __shareCalls: ShareCall[]; __copied: string[] };

/**
 * Stub `navigator.share` (recording `{ url, title }`), force `(pointer: coarse)`, and record
 * `navigator.clipboard.writeText` calls. `mode` decides how the share stub behaves.
 */
async function stubPlatform(
  page: Page,
  opts: { coarse: boolean; share: 'ok' | 'abort' | 'slow' | 'none' }
): Promise<void> {
  await page.addInitScript((o) => {
    const g = window as unknown as ShareGlobals;
    g.__shareCalls = [];
    g.__copied = [];
    if (o.share !== 'none') {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (data: ShareCall) => {
          g.__shareCalls.push({ url: data.url, title: data.title });
          if (o.share === 'abort') {
            return Promise.reject(new DOMException('dismissed', 'AbortError'));
          }
          if (o.share === 'slow') return new Promise<void>((r) => setTimeout(r, 600));
          return Promise.resolve();
        }
      });
    }
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const list = original(query);
      if (query.replace(/\s/g, '') === '(pointer:coarse)') {
        return new Proxy(list, {
          get(target, prop) {
            if (prop === 'matches') return o.coarse;
            const value = Reflect.get(target, prop, target);
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      }
      return list;
    };
  }, opts);
}

/** Count clipboard writes while still delegating to the real clipboard. */
async function recordClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const g = window as unknown as ShareGlobals;
    g.__copied = g.__copied ?? [];
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    const write = clipboard.writeText.bind(clipboard);
    clipboard.writeText = (text: string) => {
      g.__copied.push(text);
      return write(text);
    };
  });
}

const shareCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as ShareGlobals).__shareCalls);
const copiedCount = (page: Page) =>
  page.evaluate(() => (window as unknown as ShareGlobals).__copied.length);
const clipboardText = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

const shareButton = (page: Page, name = 'Share') =>
  page.getByRole('banner').getByRole('button', { name, exact: true });
const statusRegion = (page: Page, text: string) =>
  page.getByRole('status').filter({ hasText: text });
const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const E_TAG = /^Em shape · roots on strings 6, 4, 1$/;

/** CAGED, A minor, E shape focused, Chord + Pentatonic. */
async function setUpCagedAMinorE(page: Page): Promise<void> {
  await page.goto('/caged');
  await expandDetails(page);
  await page.getByRole('group', { name: 'Key' }).getByRole('button').nth(9).click();
  await page.getByRole('radio', { name: 'Minor', exact: true }).click();
  await page
    .getByRole('radiogroup', { name: 'Shape' })
    .getByRole('radio', { name: 'E', exact: true })
    .click();
  await page
    .getByRole('group', { name: 'Layers' })
    .getByRole('switch', { name: 'Pentatonic' })
    .click();
}

const CAGED_LINK_FULL =
  /^https?:\/\/[^/]+\/caged\?v=1&rt=9&sp=none&q=minor&fc=E\.0&ly=10100&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22$/;
const CAGED_LINK =
  /\/caged\?v=1&rt=9&sp=none&q=minor&fc=E\.0&ly=10100&cn=0&ts=-&lb=interval&tmp=0&sc=6&tu=AF-1&fr=22$/;

test.describe('share US1-1: a touch device sends the view through the system sheet', () => {
  test('sheet receives { url, title } once and nothing is shown', async ({ page }) => {
    await stubPlatform(page, { coarse: true, share: 'ok' });
    await setUpCagedAMinorE(page);
    await shareButton(page).click();
    await expect.poll(() => shareCalls(page)).toHaveLength(1);
    const [call] = await shareCalls(page);
    expect(call.title).toBe('A minor — CAGED, E shape');
    expect(call.url).toMatch(CAGED_LINK);
    await expect(statusRegion(page, 'Link copied')).toHaveCount(0);
    await expect(page.getByText('Copy this address')).toHaveCount(0);
  });
});

test.describe('share US1-2: desktop copies the link', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('clipboard holds the link and "Link copied" is a status', async ({ page }) => {
    // The share API exists, but a fine pointer never uses it.
    await stubPlatform(page, { coarse: false, share: 'ok' });
    await setUpCagedAMinorE(page);
    await shareButton(page).click();
    await expect(statusRegion(page, 'Link copied')).toBeVisible();
    expect(await clipboardText(page)).toMatch(CAGED_LINK);
    expect(await shareCalls(page)).toHaveLength(0);
  });

  test('the notice can be dismissed', async ({ page }) => {
    await stubPlatform(page, { coarse: false, share: 'none' });
    await page.goto('/caged');
    await expandDetails(page);
    await shareButton(page).click();
    await expect(statusRegion(page, 'Link copied')).toBeVisible();
    await statusRegion(page, 'Link copied').getByRole('button', { name: 'Dismiss' }).click();
    await expect(statusRegion(page, 'Link copied')).toHaveCount(0);
  });
});

test.describe('share US1-3: every tool has a Share button', () => {
  const CASES = [
    ['/notes', 'Notes', /\/notes\?v=1&sel=-&/],
    ['/triads', 'C major — Triads, root position', /\/triads\?v=1&rt=0&sp=none&q=major&inv=root&/],
    ['/caged', 'C major — CAGED', /\/caged\?v=1&rt=0&sp=none&q=major&fc=-&/]
  ] as const;

  for (const [path, title, link] of CASES) {
    test(`${path}: present, at least 44×44, titled "${title}"`, async ({ page }) => {
      await stubPlatform(page, { coarse: true, share: 'ok' });
      await page.goto(path);
      const button = shareButton(page);
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await button.click();
      await expect.poll(() => shareCalls(page)).toHaveLength(1);
      const [call] = await shareCalls(page);
      expect(call.title).toBe(title);
      expect(call.url).toMatch(link);
    });
  }

  for (const path of ['/', '/about']) {
    test(`${path} has no Share button`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
    });
  }
});

test.describe('share US1-4: dismissing the system sheet', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('AbortError shows nothing, copies nothing, leaves the view unchanged', async ({ page }) => {
    await stubPlatform(page, { coarse: true, share: 'abort' });
    await recordClipboard(page);
    await setUpCagedAMinorE(page);
    await shareButton(page).click();
    await expect.poll(() => shareCalls(page)).toHaveLength(1);
    await expect(shareButton(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(statusRegion(page, 'Link copied')).toHaveCount(0);
    await expect(page.getByText('Copy this address')).toHaveCount(0);
    expect(await copiedCount(page)).toBe(0);
    await expect(board(page).getByRole('button', { name: E_TAG }).first()).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

test.describe('share US1-5: es and pt-BR', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  const CASES = [
    {
      label: 'Español',
      button: 'Compartir',
      copied: 'Enlace copiado',
      title: /^.+ menor — CAGED, forma de E$/
    },
    {
      label: 'Português',
      button: 'Compartilhar',
      copied: 'Link copiado',
      title: /^.+ menor — CAGED, forma de E$/
    }
  ] as const;

  for (const c of CASES) {
    test(`${c.label}: button, notice and title translated; link identical to en`, async ({
      page
    }) => {
      await stubPlatform(page, { coarse: false, share: 'ok' });
      await setUpCagedAMinorE(page);
      await shareButton(page).click();
      await expect(statusRegion(page, 'Link copied')).toBeVisible();
      const englishLink = await clipboardText(page);
      expect(englishLink).toMatch(CAGED_LINK);

      await page.getByRole('button', { name: 'Language and appearance', exact: true }).click();
      await page
        .locator('div[role="region"][id^="language-panel-"]')
        .getByRole('radio', { name: c.label })
        .check();
      await expect(shareButton(page, c.button)).toBeVisible();

      await shareButton(page, c.button).click();
      await expect(statusRegion(page, c.copied)).toBeVisible();
      expect(await clipboardText(page)).toBe(englishLink);
    });

    test(`${c.label}: the sheet title is translated`, async ({ page }) => {
      await stubPlatform(page, { coarse: true, share: 'ok' });
      await setUpCagedAMinorE(page);
      await page.getByRole('button', { name: 'Language and appearance', exact: true }).click();
      await page
        .locator('div[role="region"][id^="language-panel-"]')
        .getByRole('radio', { name: c.label })
        .check();
      await shareButton(page, c.button).click();
      await expect.poll(() => shareCalls(page)).toHaveLength(1);
      const [call] = await shareCalls(page);
      expect(call.title).toMatch(c.title);
      expect(call.url).toMatch(CAGED_LINK);
    });
  }
});

test.describe('share edge: double tap', () => {
  test('two rapid clicks reach a slow share sheet once', async ({ page }) => {
    await stubPlatform(page, { coarse: true, share: 'slow' });
    await page.goto('/triads');
    await expandDetails(page);
    const button = shareButton(page);
    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await button.click();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
    expect(await shareCalls(page)).toHaveLength(1);
  });
});

/** `none`: no `navigator.clipboard`; `reject`: `writeText` rejects (permission denied). */
async function breakClipboard(page: Page, mode: 'none' | 'reject'): Promise<void> {
  await page.addInitScript((m) => {
    if (m === 'none') {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    } else {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) }
      });
    }
  }, mode);
}

const fallbackField = (page: Page, label = 'Copy this address') => page.getByLabel(label);

test.describe('share US2: manual-copy fallback', () => {
  for (const mode of ['none', 'reject'] as const) {
    test(`US2-1 clipboard ${mode}: field is focused, fully selected, no "copied"`, async ({
      page
    }) => {
      await stubPlatform(page, { coarse: false, share: 'none' });
      await breakClipboard(page, mode);
      await setUpCagedAMinorE(page);
      await shareButton(page).click();
      const field = fallbackField(page);
      await expect(field).toBeVisible();
      await expect(field).toBeFocused();
      await expect(field).toHaveValue(CAGED_LINK_FULL);
      const selection = await field.evaluate((el: HTMLInputElement) => ({
        start: el.selectionStart,
        end: el.selectionEnd,
        length: el.value.length
      }));
      expect(selection).toEqual({ start: 0, end: selection.length, length: selection.length });
      await expect(page.getByRole('region', { name: 'Share link' })).toBeVisible();
      await expect(statusRegion(page, 'Link copied')).toHaveCount(0);
      await expect(page.getByText('Link copied')).toHaveCount(0);
    });
  }

  test('US2-2 Escape closes the panel and focus returns to Share', async ({ page }) => {
    await stubPlatform(page, { coarse: false, share: 'none' });
    await breakClipboard(page, 'none');
    await page.goto('/triads');
    await expandDetails(page);
    await shareButton(page).click();
    await expect(fallbackField(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(fallbackField(page)).toHaveCount(0);
    await expect(shareButton(page)).toBeFocused();
  });

  test('US2-2 Dismiss closes the panel and focus returns to Share', async ({ page }) => {
    await stubPlatform(page, { coarse: false, share: 'none' });
    await breakClipboard(page, 'reject');
    await page.goto('/triads');
    await expandDetails(page);
    await shareButton(page).click();
    await expect(fallbackField(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Dismiss' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(fallbackField(page)).toHaveCount(0);
    await expect(shareButton(page)).toBeFocused();
  });

  test('US2-3 a view change closes the panel', async ({ page }) => {
    await stubPlatform(page, { coarse: false, share: 'none' });
    await breakClipboard(page, 'none');
    await page.goto('/caged');
    await expandDetails(page);
    await shareButton(page).click();
    await expect(fallbackField(page)).toBeVisible();
    await page.getByRole('group', { name: 'Key' }).getByRole('button').nth(2).click();
    await expect(fallbackField(page)).toHaveCount(0);
  });

  test('US2-3 leaving the tool closes the panel', async ({ page }) => {
    await stubPlatform(page, { coarse: false, share: 'none' });
    await breakClipboard(page, 'none');
    await page.goto('/caged');
    await expandDetails(page);
    await shareButton(page).click();
    await expect(fallbackField(page)).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Triads' }).first().click();
    await expect(page).toHaveURL(/\/triads/);
    await expect(fallbackField(page)).toHaveCount(0);
  });

  const LANGS = [
    { label: 'Español', button: 'Compartir', field: 'Copia esta dirección' },
    { label: 'Português', button: 'Compartilhar', field: 'Copie este endereço' }
  ] as const;

  test('axe is clean with the fallback open in en', async ({ page }) => {
    await stubPlatform(page, { coarse: false, share: 'none' });
    await breakClipboard(page, 'none');
    await page.goto('/caged');
    await expandDetails(page);
    await shareButton(page).click();
    await expect(fallbackField(page)).toBeVisible();
    await runAxe(page);
  });

  for (const l of LANGS) {
    test(`axe is clean with the fallback open in ${l.label}`, async ({ page }) => {
      await stubPlatform(page, { coarse: false, share: 'none' });
      await breakClipboard(page, 'none');
      await page.goto('/caged');
      await expandDetails(page);
      await page.getByRole('button', { name: 'Language and appearance', exact: true }).click();
      await page
        .locator('div[role="region"][id^="language-panel-"]')
        .getByRole('radio', { name: l.label })
        .check();
      await shareButton(page, l.button).click();
      await expect(fallbackField(page, l.field)).toBeVisible();
      await expect(fallbackField(page, l.field)).toBeFocused();
      await runAxe(page);
    });
  }
});

async function chooseLanguage(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Language and appearance', exact: true }).click();
  await page
    .locator('div[role="region"][id^="language-panel-"]')
    .getByRole('radio', { name: label })
    .check();
}

test.describe('share polish: axe with the notice open (SC-008)', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  const LANGS = [
    { label: null, button: 'Share', copied: 'Link copied', name: 'en' },
    { label: 'Español', button: 'Compartir', copied: 'Enlace copiado', name: 'es' },
    { label: 'Português', button: 'Compartilhar', copied: 'Link copiado', name: 'pt-BR' }
  ] as const;

  for (const tool of ['/notes', '/triads', '/caged']) {
    for (const l of LANGS) {
      test(`${tool} in ${l.name}: axe is clean with the notice open`, async ({ page }) => {
        await stubPlatform(page, { coarse: false, share: 'none' });
        await page.goto(tool);
        if (l.label !== null) await chooseLanguage(page, l.label);
        await shareButton(page, l.button).click();
        await expect(statusRegion(page, l.copied)).toBeVisible();
        await runAxe(page);
      });
    }
  }
});

test.describe('share polish: fallback reflow (Principle VII)', () => {
  async function openFallback(page: Page): Promise<void> {
    await stubPlatform(page, { coarse: false, share: 'none' });
    await breakClipboard(page, 'none');
    await page.goto('/caged');
    await expandDetails(page);
    await shareButton(page).click();
    await expect(fallbackField(page)).toBeVisible();
  }

  async function expectBoardUncovered(page: Page): Promise<void> {
    const panel = await page.getByRole('region', { name: 'Share link' }).boundingBox();
    const fretboard = await board(page).boundingBox();
    expect(panel).not.toBeNull();
    expect(fretboard).not.toBeNull();
    if (!panel || !fretboard) return;
    const overlaps =
      panel.x < fretboard.x + fretboard.width &&
      panel.x + panel.width > fretboard.x &&
      panel.y < fretboard.y + fretboard.height &&
      panel.y + panel.height > fretboard.y;
    expect(overlaps).toBe(false);
  }

  test('320 px: no horizontal overflow, fretboard not covered', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openFallback(page);
    await expectNoHorizontalScroll(page);
    await expectBoardUncovered(page);
  });

  test('200% zoom (320 CSS px viewport, 200% text): no overflow, fretboard not covered', async ({
    page
  }) => {
    await page.setViewportSize({ width: 320, height: 320 });
    await openFallback(page);
    await setTextScale(page, 200);
    await expectNoHorizontalScroll(page);
    await expectBoardUncovered(page);
  });
});
