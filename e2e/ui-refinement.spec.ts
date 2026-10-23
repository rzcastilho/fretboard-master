import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectNoHorizontalScroll } from './support/helpers';

/** Spec 029: calm tool screens (G-1…G-3), one look per control family, equal home cards. */

type Tool = 'notes' | 'triads' | 'caged';
const TOOLS: readonly Tool[] = ['notes', 'triads', 'caged'];
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 }
] as const;

const grid = (page: Page) => page.locator('main .grid');
const zone = (page: Page, z: 'b' | 'c' | 'd' | 'e') => grid(page).locator(`.${z}`).first();

async function openTool(page: Page, tool: Tool, width = 1280, height = 800) {
  await page.setViewportSize({ width, height });
  await page.goto(`/${tool}`);
  await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
  await expect(grid(page)).toHaveAttribute('data-arrangement', /.+/);
}

const area = async (loc: Locator): Promise<number | null> => {
  if ((await loc.count()) === 0) return null;
  const b = await loc.boundingBox();
  return b && b.width > 0 && b.height > 0 ? b.width * b.height : null;
};

for (const { width, height } of VIEWPORTS) {
  test.describe(`geometry at ${width}×${height}`, () => {
    for (const tool of TOOLS) {
      test(`G-1: the fretboard zone dominates: ${tool}`, async ({ page }) => {
        await openTool(page, tool, width, height);
        const c = await area(zone(page, 'c'));
        if (c === null) throw new Error('zone C has no box');
        // At 320×568 zone B's wrapped rows may outgrow C, so B is not compared (spec SC-001).
        const others = {
          a: await area(page.locator('header').first()),
          b: width === 320 ? null : await area(zone(page, 'b')),
          d: await area(zone(page, 'd')),
          e: await area(zone(page, 'e'))
        };
        for (const [name, a] of Object.entries(others)) {
          if (a !== null) expect(c, `zone C larger than ${name}`).toBeGreaterThan(a);
        }
        // At 320×568 zone B wraps below the header, so C starts below the fold (spec SC-001).
        if (width === 320) return;
        const top = (await zone(page, 'c').boundingBox())?.y ?? Infinity;
        expect(top).toBeLessThan(height);
      });

      test(`G-2: zone B controls fit the first screen: ${tool}`, async ({ page }) => {
        await openTool(page, tool, width, height);
        const b = zone(page, 'b');
        const focusable = b.locator(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="radio"], [role="switch"]'
        );
        const n = await focusable.count();
        expect(n).toBeGreaterThan(0);
        // At 320×568 the wrapped rows run past the fold: only the width is bounded (spec SC-005).
        const bottom = width === 320 ? Infinity : height;
        const offenders: string[] = [];
        for (let i = 0; i < n; i++) {
          const el = focusable.nth(i);
          if (!(await el.isVisible())) continue;
          const r = await el.boundingBox();
          if (!r) continue;
          if (r.x < 0 || r.y < 0 || r.x + r.width > width || r.y + r.height > bottom) {
            offenders.push(
              `${await el.evaluate((e) => e.outerHTML.slice(0, 60))} @ ${JSON.stringify(r)}`
            );
          }
        }
        expect(offenders).toEqual([]);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      });

      test(`G-3: no horizontal page scroll: ${tool}`, async ({ page }) => {
        await openTool(page, tool, width, height);
        await expectNoHorizontalScroll(page);
      });
    }
  });
}

// ---- Control families (contracts/ui.md §2) --------------------------------------------------

interface Metrics {
  minBlock: string;
  padding: string;
  radius: string;
  border: string;
  fontSize: string;
  fontWeight: string;
  background: string;
}

const metrics = (loc: Locator): Promise<Metrics> =>
  loc.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      minBlock: s.minBlockSize,
      padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(' '),
      radius: [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomRightRadius,
        s.borderBottomLeftRadius
      ].join(' '),
      border: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].join(
        ' '
      ),
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      background: s.backgroundColor
    };
  });

const SHAPE = ['minBlock', 'padding', 'radius', 'border', 'fontSize'] as const;

function expectSameShape(
  label: string,
  cells: readonly (readonly [string, Metrics])[],
  keys: readonly (typeof SHAPE)[number][] = SHAPE
) {
  expect(cells.length, `${label}: instances found`).toBeGreaterThan(1);
  const [firstName, first] = cells[0];
  for (const [name, m] of cells.slice(1)) {
    for (const key of keys) {
      expect(m[key], `${label}: ${key} of ${name} equals ${firstName}`).toBe(first[key]);
    }
  }
}

async function shell(page: Page, tool: Tool = 'notes') {
  await openTool(page, tool);
}

test.describe('control families look the same everywhere', () => {
  // Computed styles are compared, not animated: with motion the selected colours are read
  // mid-transition right after a click.
  test.use({ reducedMotion: 'reduce' });

  test('.option: same box in Notes, Triads, CAGED and the notation toggle; selected is bold and filled', async ({
    page
  }) => {
    const cells: (readonly [string, Metrics])[] = [];
    const states: { name: string; normal: Metrics; selected: Metrics }[] = [];

    await shell(page, 'notes');
    const note = page.locator('section.b .option[aria-pressed]').first();
    await expect(note).toBeVisible();
    const noteDefault = await metrics(note);
    cells.push(['notes', noteDefault]);
    await note.click();
    await expect(note).toHaveAttribute('aria-pressed', 'true');
    states.push({ name: 'notes', normal: noteDefault, selected: await metrics(note) });

    for (const tool of ['triads', 'caged'] as const) {
      await shell(page, tool);
      const radios = page.locator('section.b .option[role="radio"]');
      const normal = radios.and(page.locator('[aria-checked="false"]')).first();
      const selected = radios.and(page.locator('[aria-checked="true"]')).first();
      await expect(normal).toBeVisible();
      const n = await metrics(normal);
      const s = await metrics(selected);
      cells.push([tool, n]);
      states.push({ name: tool, normal: n, selected: s });
    }

    await shell(page, 'notes');
    const toggle = page.locator('.toggle .option[aria-pressed="false"]').first();
    await expect(toggle).toBeVisible();
    cells.push(['notation toggle', await metrics(toggle)]);

    // Options sit in joined segments (030): the radius belongs to the segment's ends, not to
    // every option, so the shared box is everything but the radius.
    expectSameShape(
      '.option',
      cells,
      SHAPE.filter((k) => k !== 'radius')
    );
    for (const s of states) {
      expect(s.selected.fontWeight, `${s.name}: selected is heavier`).not.toBe(s.normal.fontWeight);
      expect(s.selected.background, `${s.name}: selected is filled`).not.toBe(s.normal.background);
    }
  });

  test('.btn: same box in Notes, Triads, CAGED and the instrument panel', async ({ page }) => {
    const cells: (readonly [string, Metrics])[] = [];
    await shell(page, 'notes');
    cells.push(['notes', await metrics(page.locator('section.e .btn').first())]);
    await shell(page, 'triads');
    cells.push(['triads', await metrics(page.locator('section.e .btn').first())]);
    await shell(page, 'caged');
    cells.push(['caged', await metrics(page.locator('.btn').filter({ visible: true }).first())]);
    await page.getByRole('button', { name: 'Instrument', exact: true }).click();
    cells.push([
      'instrument panel',
      await metrics(page.getByRole('dialog', { name: 'Instrument' }).locator('.btn').first())
    ]);
    expectSameShape('.btn', cells);
  });

  test('.switch: the CAGED connections switch has the pill track and on state', async ({
    page
  }) => {
    await shell(page, 'caged');
    const sw = page.getByRole('switch', { name: /Show connections/ });
    await expect(sw).toBeVisible();
    const track = sw.locator('.switch-track');
    const off = await track.evaluate((e) => getComputedStyle(e).backgroundColor);
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    const on = await track.evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(on).not.toBe(off);
    expect(await sw.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('0px');
  });

  test('.stepper: its buttons are the tools’ .btn', async ({ page }) => {
    await shell(page, 'notes');
    const tool = await metrics(page.locator('section.e .btn').first());
    await page.getByRole('button', { name: 'Instrument', exact: true }).click();
    const stepper = page.getByRole('dialog', { name: 'Instrument' }).locator('.stepper');
    await expect(stepper).toBeVisible();
    expectSameShape('.stepper .btn', [
      ['tool .btn', tool],
      ['stepper .btn', await metrics(stepper.locator('.btn'))]
    ]);
  });

  test('.link-button: app-bar Instrument and a notice dismiss share one box', async ({ page }) => {
    const cells: (readonly [string, Metrics])[] = [];
    for (const tool of TOOLS) {
      await shell(page, tool);
      cells.push([
        `${tool} app bar`,
        await metrics(page.getByRole('button', { name: 'Instrument', exact: true }))
      ]);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/caged?v=1&rt=2&q=banana&fr=99');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    const dismiss = page.getByRole('status').getByRole('button', { name: 'Dismiss' }).first();
    await expect(dismiss).toBeVisible();
    await expect(dismiss).toHaveClass(/link-button/);
    cells.push(['notice dismiss', await metrics(dismiss)]);
    expectSameShape('.link-button', cells);
  });
});

// ---- Home cards (US2) -----------------------------------------------------------------------

test.describe('home cards', () => {
  for (const width of [360, 1280]) {
    test(`cards in a row have equal height at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const cards = page.getByRole('list').getByRole('link');
      const n = await cards.count();
      expect(n).toBeGreaterThan(1);
      const boxes = [];
      for (let i = 0; i < n; i++) {
        const bb = await cards.nth(i).boundingBox();
        if (!bb) throw new Error('card has no box');
        boxes.push(bb);
      }
      const rows = new Map<number, number[]>();
      for (const b of boxes)
        rows.set(Math.round(b.y), [...(rows.get(Math.round(b.y)) ?? []), b.height]);
      for (const heights of rows.values()) {
        for (const h of heights) expect(h).toBeCloseTo(heights[0], 0);
      }
      await expectNoHorizontalScroll(page);
    });
  }
});
