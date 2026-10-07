import { expect, test, type Page } from '@playwright/test';

import { CVD_MATRICES, type CvdType } from '../tests/unit/a11y/color';

import { expandDetails } from './support/helpers';
/** US5: root, third and fifth never depend on colour alone — shape, label, emphasis and outline carry the meaning. */

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const layerSwitch = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Layers' }).getByRole('switch', { name, exact: true });

const GLYPH_TAG = { root: 'rect', third: 'circle', fifth: 'polygon' } as const;
type Degree = keyof typeof GLYPH_TAG;

async function expectDegreeShapes(page: Page) {
  for (const degree of Object.keys(GLYPH_TAG) as Degree[]) {
    const marker = board(page).locator(`.marker.${degree}`).first();
    await expect(marker).toBeVisible();
    const glyph = marker.locator('.glyph').first();
    expect(await glyph.evaluate((el) => el.tagName.toLowerCase())).toBe(GLYPH_TAG[degree]);
    await expect(marker.locator('.marker-label')).not.toHaveText('');
  }
}

/** Route + set-up that shows root, third and fifth together. */
const TOOLS: { name: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: 'Triads',
    open: async (page) => {
      await page.goto('/triads');
      await expandDetails(page);
      await expect(board(page).locator('.marker')).toHaveCount(3);
    }
  },
  {
    name: 'CAGED',
    open: async (page) => {
      await page.goto('/caged');
      await expandDetails(page);
      await expect(board(page).locator('.marker.root').first()).toBeVisible();
    }
  }
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`colour independence (${colorScheme})`, () => {
    test.use({ colorScheme });

    for (const tool of TOOLS) {
      test(`US5-1: ${tool.name} — root, third, fifth differ by shape and carry a label`, async ({
        page
      }) => {
        await tool.open(page);
        await expectDegreeShapes(page);
      });
    }

    test('US5-2: emphasis levels differ by opacity and size, not hue', async ({ page }) => {
      await page.goto('/caged');
      await expandDetails(page);
      await layerSwitch(page, 'Pentatonic').click();
      const root = board(page).locator('.marker.root.highlighted').first();
      const degree = board(page).locator('.marker.degree').first();
      await expect(root).toBeVisible();
      await expect(degree).toBeVisible();
      const [rootBox, degreeBox] = await Promise.all([root.boundingBox(), degree.boundingBox()]);
      expect(rootBox).not.toBeNull();
      expect(degreeBox).not.toBeNull();
      expect(degreeBox?.width ?? 0).toBeLessThan(rootBox?.width ?? 0);
      const [rootOpacity, degreeOpacity] = await Promise.all([
        root.evaluate((el) => Number(getComputedStyle(el).opacity)),
        degree.evaluate((el) => Number(getComputedStyle(el).opacity))
      ]);
      expect(degreeOpacity).toBeLessThanOrEqual(rootOpacity);
    });

    test('US5-3: Triads comparison has a dashed outline and an arrow', async ({ page }) => {
      await TOOLS[0].open(page);
      await page.getByRole('button', { name: 'Compare', exact: true }).click();
      const comparison = board(page).locator('.marker.comparison');
      await expect(comparison).toHaveCount(1);
      const dash = await comparison
        .locator('.glyph')
        .evaluate((el) => getComputedStyle(el).strokeDasharray);
      expect(dash).not.toBe('none');
      await expect(board(page).locator('g.arrows .arrow')).toHaveCount(1);
    });

    test('US5-4: Legend entries carry shape text beside the sample', async ({ page }) => {
      await TOOLS[0].open(page);
      await page.getByRole('button', { name: 'Legend', exact: true }).click();
      const items = page.locator('.view-aids .legend li');
      await expect(items.filter({ hasText: 'Root' }).locator('.meaning')).toContainText('square');
      await expect(items.filter({ hasText: 'Third' }).locator('.meaning')).toContainText('circle');
      await expect(items.filter({ hasText: 'Fifth' }).locator('.meaning')).toContainText('diamond');
    });

    for (const type of ['deuteranopia', 'protanopia', 'tritanopia'] as CvdType[]) {
      test(`US5-5: shapes and labels remain under ${type} simulation`, async ({ page }) => {
        await TOOLS[0].open(page);
        await page.evaluate(
          ([kind, matrix]) => {
            const ns = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('width', '0');
            svg.setAttribute('height', '0');
            svg.setAttribute('aria-hidden', 'true');
            const filter = document.createElementNS(ns, 'filter');
            filter.setAttribute('id', `cvd-${kind}`);
            const fe = document.createElementNS(ns, 'feColorMatrix');
            fe.setAttribute('type', 'matrix');
            fe.setAttribute('color-interpolation-filters', 'linearRGB');
            const rows = matrix as number[][];
            fe.setAttribute(
              'values',
              rows.map((r) => `${r.join(' ')} 0 0`).join(' ') + ' 0 0 0 1 0'
            );
            filter.append(fe);
            svg.append(filter);
            document.body.append(svg);
            // CSP is style-src 'self': CSSOM writes are not blocked.
            document.documentElement.style.filter = `url(#cvd-${kind})`;
          },
          [type, CVD_MATRICES[type].map((r) => [...r])] as [string, number[][]]
        );
        await expectDegreeShapes(page);
      });
    }
  });
}

/** 026 US2: the reserved role colours are one value in both themes (shared --fb-* palette). */
test('US2: role fills resolve to the same colour in light and dark', async ({ page }) => {
  const read = async () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return ['root', 'third', 'fifth', 'label'].map((n) =>
        cs.getPropertyValue(`--fb-color-${n}`).trim()
      );
    });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/triads');
  const light = await read();
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await read()).toEqual(light);
  expect(light.every((v) => /^#[0-9a-f]{6}$/i.test(v))).toBe(true);
});

/** 026 US3-6: forced colours win, yet marker shapes and labels stay visible on system colours. */
test.describe('forced colours (026)', () => {
  test.use({ colorScheme: 'light' });

  for (const tool of TOOLS) {
    test(`${tool.name}: shapes and labels remain, board uses system colours`, async ({ page }) => {
      await page.emulateMedia({ forcedColors: 'active' });
      await tool.open(page);
      await expectDegreeShapes(page);
      const paint = await board(page).evaluate((root) => {
        const wood = root.querySelector('.wood');
        const line = root.querySelector('.nut');
        const probe = (color: string) => {
          const el = document.createElement('span');
          el.style.color = color;
          document.body.append(el);
          const resolved = getComputedStyle(el).color;
          el.remove();
          return resolved;
        };
        return {
          woodFill: wood ? getComputedStyle(wood).fill : '',
          lineFill: line ? getComputedStyle(line).fill : '',
          canvas: probe('Canvas'),
          canvasText: probe('CanvasText')
        };
      });
      expect(paint.woodFill).toBe(paint.canvas);
      expect([paint.canvasText, paint.canvas]).toContain(paint.lineFill);
    });
  }
});
