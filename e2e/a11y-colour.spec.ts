import { expect, test, type Page } from '@playwright/test';

import { CVD_MATRICES, type CvdType } from '../tests/unit/a11y/color';

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
      await expect(board(page).locator('.marker')).toHaveCount(3);
    }
  },
  {
    name: 'CAGED',
    open: async (page) => {
      await page.goto('/caged');
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
