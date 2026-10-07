import { expect, test, type Page } from '@playwright/test';

import { expandDetails } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';
const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const attr = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme ?? null);

async function seedTheme(page: Page, theme: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key as string, value as string);
      } catch {
        // storage unavailable
      }
    },
    [PREFS_KEY, JSON.stringify({ version: 1, theme })]
  );
}

async function openAppearance(page: Page): Promise<void> {
  // Home shows the selector in the header; tool screens put it behind the disclosure.
  const button = page.getByRole('button', { name: 'Language and appearance' });
  if (await button.count()) await button.click();
}

test.describe('themes: US1', () => {
  test('follows the device live and defaults to light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const light = await bodyBg(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => bodyBg(page)).not.toBe(light);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => bodyBg(page)).toBe(light);
    expect(await attr(page)).toBeNull();
  });

  for (const [device, pin] of [
    ['light', 'dark'],
    ['dark', 'light']
  ] as const) {
    test(`pinned ${pin} on ${device} device: first frame is ${pin}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: device });
      await seedTheme(page, pin);
      await page.addInitScript(() => {
        requestAnimationFrame(() => {
          (window as unknown as { __firstBg: string }).__firstBg = getComputedStyle(
            document.documentElement
          ).backgroundColor;
          (window as unknown as { __firstTheme: string | undefined }).__firstTheme =
            document.documentElement.dataset.theme;
        });
      });
      await page.goto('/');
      const first = await page.evaluate(
        () => (window as unknown as { __firstTheme?: string }).__firstTheme
      );
      expect(first).toBe(pin);
    });
  }

  test('pin Light, reload, stays light; Follow device clears the pin', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await page.getByRole('radio', { name: 'Light' }).check();
    await expect.poll(() => attr(page)).toBe('light');
    await page.reload();
    expect(await attr(page)).toBe('light');
    await page.getByRole('radio', { name: 'Follow device' }).check();
    await expect.poll(() => attr(page)).toBeNull();
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), PREFS_KEY))
      .not.toContain('"theme"');
  });

  test('share link keeps the pin and adds no theme parameter', async ({ page }) => {
    await seedTheme(page, 'dark');
    await page.goto('/triads?v=1&root=C&quality=major');
    expect(await attr(page)).toBe('dark');
    expect(page.url()).not.toMatch(/theme/);
  });

  test('blocked storage: choosing still applies', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        }
      });
    });
    await page.goto('/');
    await page.getByRole('radio', { name: 'Dark' }).check();
    await expect.poll(() => attr(page)).toBe('dark');
  });

  for (const [lang, name, dark] of [
    ['en', 'Language and appearance', 'Dark'],
    ['pt-BR', 'Idioma e aparência', 'Escuro'],
    ['es', 'Idioma y apariencia', 'Oscuro']
  ] as const) {
    test(`keyboard flow through the disclosure (${lang})`, async ({ page }) => {
      await page.goto('/notes');
      if (lang !== 'en') {
        await page.getByRole('button', { name: 'Language and appearance' }).click();
        await page.getByRole('radio', { name: lang === 'pt-BR' ? 'Português' : 'Español' }).check();
        await page.keyboard.press('Escape');
      }
      const button = page.getByRole('button', { name });
      await button.focus();
      await page.keyboard.press('Enter');
      const radio = page.getByRole('radio', { name: dark });
      await radio.focus();
      await page.keyboard.press('Space');
      await expect.poll(() => attr(page)).toBe('dark');
    });
  }

  test('theme switch does not touch data-motion', async ({ page }) => {
    await page.goto('/notes');
    const motion = () => page.evaluate(() => document.documentElement.dataset.motion ?? null);
    const before = await motion();
    await openAppearance(page);
    await page.getByRole('radio', { name: 'Dark' }).check();
    await expect.poll(() => attr(page)).toBe('dark');
    expect(await motion()).toBe(before);
  });
});

const boardOf = (page: Page) =>
  page
    .getByRole('region', { name: 'Fretboard' })
    .or(page.getByRole('grid', { name: 'Fretboard' }))
    .first();

interface Painted {
  readonly path: string;
  readonly fill: string;
  readonly stroke: string;
  readonly opacity: string;
  readonly color: string;
}

/** Computed paint of every element inside the board SVG, in document order. */
async function paintOfBoard(page: Page): Promise<Painted[]> {
  // Sample at rest: let every running transition and animation finish first.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
  );
  return boardOf(page).evaluate((root) => {
    const svg = root.querySelector('svg');
    if (!svg) throw new Error('no board svg');
    return [svg, ...svg.querySelectorAll('*')].map((el, i) => {
      const cs = getComputedStyle(el);
      return {
        path: `${i}:${el.tagName}.${el.getAttribute('class') ?? ''}`,
        fill: cs.fill,
        stroke: cs.stroke,
        opacity: cs.opacity,
        color: cs.color
      };
    });
  });
}

const SCENES: readonly { name: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: 'Notes',
    open: async (page) => {
      await page.goto('/notes');
      await expandDetails(page);
      await page
        .getByRole('group', { name: 'Choose notes' })
        .getByRole('button', { name: 'G', exact: true })
        .click();
      await expect(boardOf(page).locator('.marker.highlighted').first()).toBeVisible();
    }
  },
  {
    name: 'Triads with comparison',
    open: async (page) => {
      await page.goto('/triads');
      await expandDetails(page);
      await page.getByRole('button', { name: 'Compare', exact: true }).click();
      await expect(boardOf(page).locator('.marker.comparison').first()).toBeVisible();
    }
  },
  {
    name: 'CAGED with layers',
    open: async (page) => {
      await page.goto('/caged');
      await expandDetails(page);
      const layers = page.getByRole('group', { name: 'Layers' });
      for (const name of ['Arpeggio', 'Pentatonic', 'Triad']) {
        await layers.getByRole('switch', { name, exact: true }).click();
      }
      await expect(boardOf(page).locator('.marker.layer-triad').first()).toBeVisible();
    }
  }
];

test.describe('themes: US2 — dark screenshots, one view per tool', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });

  for (const scene of SCENES) {
    test(`dark shot: ${scene.name}`, async ({ page }) => {
      await scene.open(page);
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)))
      );
      const slug = scene.name.toLowerCase().replace(/[^a-z]+/g, '-');
      await expect(page).toHaveScreenshot(`theme-dark-${slug}.png`);
    });
  }
});

test.describe('themes: US2 — the board is identical in light and dark', () => {
  for (const scene of SCENES) {
    test(`on-board computed colours equal in light and dark: ${scene.name}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      await scene.open(page);
      const light = await paintOfBoard(page);
      const lightBg = await bodyBg(page);
      await page.emulateMedia({ colorScheme: 'dark' });
      await expect.poll(() => bodyBg(page)).not.toBe(lightBg);
      const dark = await paintOfBoard(page);
      expect(light.length).toBeGreaterThan(20);
      expect(dark).toEqual(light);
    });
  }

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`board boundary is at least 3:1 against the surface (${colorScheme})`, async ({
      page
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/triads');
      await expandDetails(page);
      const result = await boardOf(page).evaluate((root) => {
        const parse = (value: string): [number, number, number] => {
          const m = value.match(/[\d.]+/g)?.map(Number) ?? [];
          return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0];
        };
        const lin = (c: number) => {
          const v = c / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        const lum = ([r, g, b]: [number, number, number]) =>
          0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const ratio = (a: string, b: string) => {
          const [hi, lo] = [lum(parse(a)), lum(parse(b))].sort((x, y) => y - x);
          return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
        };
        const wood = root.querySelector('.wood');
        if (!wood) throw new Error('no .wood');
        const cs = getComputedStyle(wood);
        let surface = 'rgb(255, 255, 255)';
        for (let el: Element | null = root; el; el = el.parentElement) {
          const bg = getComputedStyle(el).backgroundColor;
          if (!/,\s*0\)$/.test(bg) && bg !== 'transparent') {
            surface = bg;
            break;
          }
        }
        return {
          wood: ratio(cs.fill, surface),
          edge: ratio(cs.stroke, surface),
          width: Number.parseFloat(cs.strokeWidth)
        };
      });
      expect(Math.max(result.wood, result.edge)).toBeGreaterThanOrEqual(3);
      expect(result.width).toBeGreaterThan(0);
    });
  }
});

test.describe('themes: US3 — higher-contrast variant', () => {
  const strokeOf = (page: Page) =>
    boardOf(page).evaluate((root) => {
      const edge = root.querySelector('.wood');
      const line = root.querySelector('.marker .glyph');
      return {
        edge: Number.parseFloat(edge ? getComputedStyle(edge).strokeWidth : '0'),
        marker: Number.parseFloat(line ? getComputedStyle(line).strokeWidth : '0')
      };
    });

  const woodFill = (page: Page) =>
    boardOf(page).evaluate((root) => {
      const wood = root.querySelector('.wood');
      return wood ? getComputedStyle(wood).fill : '';
    });

  test('variant applies live, keeps the pin, and the board stays dark warm and identical', async ({
    page
  }) => {
    await page.emulateMedia({ colorScheme: 'light', contrast: 'no-preference' });
    await seedTheme(page, 'light');
    await page.goto('/triads');
    await expandDetails(page);
    const standardStroke = await strokeOf(page);
    const standardWood = await woodFill(page);
    const standardBg = await bodyBg(page);

    // Toggle without reload.
    await page.emulateMedia({ contrast: 'more' });
    await expect.poll(() => woodFill(page)).not.toBe(standardWood);
    expect(await attr(page)).toBe('light');
    const lightMore = await woodFill(page);
    const moreStroke = await strokeOf(page);
    expect(moreStroke.edge).toBeGreaterThanOrEqual(standardStroke.edge);
    expect(moreStroke.marker).toBeGreaterThanOrEqual(standardStroke.marker);
    expect(await bodyBg(page)).toBe(standardBg);

    // Same board in dark: pin dark live through the store, no reload.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });
    await expect.poll(() => bodyBg(page)).not.toBe(standardBg);
    expect(await woodFill(page)).toBe(lightMore);

    // Warm and dark: red channel above blue, all channels low.
    const [r, g, b] = (lightMore.match(/[\d.]+/g) ?? []).map(Number);
    expect(Math.max(r ?? 255, g ?? 255, b ?? 255)).toBeLessThan(100);
    expect(r ?? 0).toBeGreaterThan(b ?? 255);

    // Back to standard live.
    await page.emulateMedia({ contrast: 'no-preference' });
    await expect.poll(() => woodFill(page)).toBe(standardWood);
  });
});
