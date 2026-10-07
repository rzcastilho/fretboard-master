import { expect, test, type Page } from '@playwright/test';

/** US5: print / save as PDF. `emulateMedia({ media: 'print' })` drives the same DOM and CSS. */

const PREFS_KEY = 'fretboard-master:prefs';
const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });

async function seed(page: Page, prefs: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key as string, value as string);
      } catch {
        // storage unavailable
      }
    },
    [PREFS_KEY, JSON.stringify({ version: 1, ...prefs })]
  );
}

const luminance = (rgb: string): number => {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const bg = (page: Page, selector: string) =>
  page.evaluate(
    (s) => getComputedStyle(document.querySelector(s) as Element).backgroundColor,
    selector
  );

/** Printed text size in pt: CSS size in marker/viewBox units × scales × 0.75 px→pt. */
async function printedPt(page: Page, selector: string): Promise<number[]> {
  return page.evaluate((sel) => {
    const svg = document.querySelector('svg[role="grid"]') as SVGSVGElement;
    const ratio = svg.clientWidth / svg.viewBox.baseVal.width;
    return [...svg.querySelectorAll(sel)].map((el) => {
      const px = parseFloat(getComputedStyle(el).fontSize);
      const scaleHost = el.closest('[data-marker-scale]') as HTMLElement | null;
      const markerScale = scaleHost ? Number(scaleHost.dataset.markerScale) : 1;
      return px * markerScale * ratio * 0.75;
    });
  }, selector);
}

async function openCaged(page: Page): Promise<void> {
  await page.goto('/caged');
  await expect(board(page).locator('svg[role="grid"] .marker').first()).toBeVisible();
}

async function printDom(page: Page): Promise<string> {
  return page.evaluate(() => {
    const svg = document.querySelector('svg[role="grid"]') as SVGSVGElement;
    return `${svg.getAttribute('width')}x${svg.getAttribute('height')}|${svg.querySelectorAll('.marker').length}`;
  });
}

test.describe('print: US5', () => {
  test('dark theme prints a light page and board with every marker shape and label', async ({
    page
  }) => {
    await seed(page, { theme: 'dark' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await openCaged(page);
    const screenBg = luminance(await bg(page, 'body'));
    expect(screenBg).toBeLessThan(0.5);
    const markers = await board(page).locator('svg[role="grid"] .marker').count();
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    expect(luminance(await bg(page, 'body'))).toBeGreaterThan(0.9);
    expect(await board(page).locator('svg[role="grid"] .marker').count()).toBe(markers);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const [degree, tag] of [
      ['root', 'rect'],
      ['third', 'circle'],
      ['fifth', 'polygon']
    ] as const) {
      const first = board(page).locator(`svg[role="grid"] .marker.${degree}`).first();
      if (await first.count()) {
        expect(
          await first
            .locator('.glyph')
            .first()
            .evaluate((e) => e.tagName)
        ).toBe(tag);
      }
    }
    const labels = board(page).locator('svg[role="grid"] .marker .marker-label');
    expect(await labels.count()).toBeGreaterThan(0);
    // The board face is light.
    const wood = await board(page).evaluate(
      (el) => getComputedStyle(el.querySelector('.board, rect') as Element).fill
    );
    expect(luminance(wood)).toBeGreaterThan(0.8);
  });

  test('Triads comparison prints dashed outlines and arrows', async ({ page }) => {
    await page.goto('/triads');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.emulateMedia({ media: 'print' });
    const comparison = board(page).locator('svg[role="grid"] .marker.comparison');
    await expect(comparison.first()).toBeVisible();
    const dash = await comparison
      .locator('.glyph')
      .evaluate((el) => getComputedStyle(el).strokeDasharray);
    expect(dash).not.toBe('none');
    await expect(board(page).locator('g.arrows .arrow')).toHaveCount(1);
  });

  test('numbering, tuning, description and legend are present; chrome is hidden', async ({
    page
  }) => {
    await seed(page, { tuning: 'AF-2' });
    await openCaged(page);
    await page.emulateMedia({ media: 'print' });
    await expect(board(page).locator('.fret-number').first()).toBeVisible();
    await expect(board(page).locator('.string-label').first()).toBeVisible();
    await expect(page.locator('.tuning-badge')).toBeVisible();
    const description = page.locator('.view-aids .description');
    await expect(description).toBeVisible();
    expect((await description.textContent())?.trim().length).toBeGreaterThan(0);
    await expect(page.locator('.view-aids .legend')).toBeVisible();
    await expect(page.locator('.view-aids .legend li').first()).toBeVisible();
    for (const hidden of [
      page.getByRole('navigation'),
      page.getByRole('button', { name: 'Share' }),
      page.getByRole('button', { name: 'Language and appearance' }),
      page.getByRole('group', { name: 'Theme' }),
      page.locator('section.b'),
      page.getByRole('slider', { name: 'Fretboard overview' }),
      page.locator('.panels-opener'),
      page.locator('[data-print="omit"]').first()
    ]) {
      await expect(hidden).toBeHidden();
    }
  });

  test('a view with no highlighted markers still prints board, numbering, context and tuning', async ({
    page
  }) => {
    await seed(page, { tuning: 'AF-2' });
    await page.goto('/notes');
    await expect(board(page)).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    expect(await board(page).locator('svg[role="grid"] .marker.highlighted').count()).toBe(0);
    await expect(board(page).locator('.fret-number').first()).toBeVisible();
    await expect(board(page).locator('.string-label').first()).toBeVisible();
    await expect(page.locator('.tuning-badge')).toBeVisible();
    await expect(page.locator('.view-aids .description')).toBeVisible();
  });

  test('the printed DOM is the same whatever the viewport, scroll, theme and contrast', async ({
    page
  }) => {
    await openCaged(page);
    const reference: string[] = [];
    for (const [width, height, scheme, contrast] of [
      [390, 844, 'light', 'no-preference'],
      [844, 390, 'dark', 'no-preference'],
      [1280, 800, 'light', 'more']
    ] as const) {
      await page.emulateMedia({ media: 'screen', colorScheme: scheme, contrast });
      await page.setViewportSize({ width, height });
      await board(page).evaluate((el) => {
        const s = el.querySelector('.scroller') ?? el;
        s.scrollLeft = 200;
      });
      await page.emulateMedia({ media: 'print', colorScheme: scheme, contrast });
      await expect(board(page).locator('svg[role="grid"]')).toBeVisible();
      reference.push(await printDom(page));
    }
    expect(new Set(reference).size).toBe(1);
  });

  for (const [width, label] of [
    [718, 'A4 portrait'],
    [739, 'Letter portrait'],
    [1047, 'A4 landscape'],
    [979, 'Letter landscape']
  ] as const) {
    test(`7 strings × 24 frets fits ${label} (${width}px) with text ≥ 7 pt`, async ({ page }) => {
      await seed(page, { strings: 7, frets: 24 });
      await page.setViewportSize({ width, height: 900 });
      await openCaged(page);
      await page.emulateMedia({ media: 'print' });
      const svg = board(page).locator('svg[role="grid"]');
      await expect(svg).toBeVisible();
      const fits = await page.evaluate(() => {
        const el = document.querySelector('svg[role="grid"]') as SVGSVGElement;
        const scroller = el.parentElement as HTMLElement;
        return {
          cropped: scroller.scrollWidth > scroller.clientWidth + 1,
          page: document.documentElement.scrollWidth <= window.innerWidth
        };
      });
      expect(fits).toEqual({ cropped: false, page: true });
      for (const sel of ['.fret-number', '.string-label', '.marker-label']) {
        const sizes = await printedPt(page, sel);
        expect(sizes.length).toBeGreaterThan(0);
        for (const pt of sizes) expect(pt).toBeGreaterThanOrEqual(6.95);
      }
    });
  }

  test('page.pdf without background graphics renders; no @page size rule', async ({ page }) => {
    await seed(page, { theme: 'dark' });
    await openCaged(page);
    const pdf = await page.pdf({ printBackground: false });
    expect(pdf.byteLength).toBeGreaterThan(1000);
    const sizeRules = await page.evaluate(() => {
      let found = 0;
      for (const sheet of [...document.styleSheets]) {
        for (const rule of [...sheet.cssRules]) {
          if (rule instanceof CSSPageRule && rule.style.getPropertyValue('size')) found++;
        }
      }
      return found;
    });
    expect(sizeRules).toBe(0);
    await page.emulateMedia({ media: 'print' });
    const fill = await board(page)
      .locator('svg[role="grid"] .marker .glyph')
      .first()
      .evaluate((el) => getComputedStyle(el).fill);
    expect(fill).not.toBe('none');
  });

  test('Home and About print light without navigation', async ({ page }) => {
    await seed(page, { theme: 'dark' });
    for (const path of ['/', '/about']) {
      await page.goto(path);
      await page.emulateMedia({ media: 'print' });
      expect(luminance(await bg(page, 'body'))).toBeGreaterThan(0.9);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('navigation')).toBeHidden();
      await expect(page.getByRole('button', { name: /Language and appearance/ })).toBeHidden();
    }
  });
});
