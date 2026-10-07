import { expect, test, type Page } from '@playwright/test';

import { expandDetails } from './support/helpers';

/**
 * Motion that explains change (026 US4). Transitions run on the document timeline, which
 * `page.clock` does not control, so these tests pause every running animation and set its
 * `currentTime`: deterministic and independent of the machine's speed.
 */
const SHORT = 300;
const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const grid = (page: Page) => page.getByRole('grid', { name: 'Fretboard' });
const root = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Root' }).getByRole('button', { name, exact: true });
const key = (page: Page, name: string) =>
  page.getByRole('group', { name: 'Key' }).getByRole('button', { name, exact: true });

async function open(page: Page, path: string) {
  // Run every animation at 1% speed, so a loaded machine cannot finish one before it is probed.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.01 });
  await page.goto(path);
  await expandDetails(page);
  await grid(page).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.marker').length > 0);
}

/** Pause every running animation at `ms`; resolves the number of animations found. */
const freezeAt = (page: Page, ms: number) =>
  page.evaluate((t) => {
    const all = document.getAnimations();
    for (const a of all) {
      a.pause();
      a.currentTime = t;
    }
    return all.length;
  }, ms);

const finishAll = (page: Page) =>
  page.evaluate(() => {
    for (const a of document.getAnimations()) a.finish();
  });

/** Longest end time of all running animations, delay included. */
const longestAnimation = (page: Page) =>
  page.evaluate(() =>
    Math.max(
      0,
      ...document.getAnimations().map((a) => Number(a.effect?.getComputedTiming().endTime ?? 0))
    )
  );

/** Every marker's translate and opacity, keyed by its position, plus the element itself. */
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, { x: number; y: number; opacity: number; id: string }> = {};
    document.querySelectorAll<SVGGElement>('.marker').forEach((el, i) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      el.dataset.probe = String(i);
      out[el.dataset.key ?? `#${i}`] = {
        x: m.m41,
        y: m.m42,
        opacity: Number(getComputedStyle(el).opacity),
        id: el.dataset.probe
      };
    });
    return out;
  });
}

const motionOf = (page: Page) => grid(page).getAttribute('data-motion');

test.describe('motion that explains change (US4)', () => {
  test('Triads root slides every marker along its own string, within 300 ms', async ({ page }) => {
    await open(page, '/triads');
    const before = await snapshot(page);
    await root(page, 'D').click();
    expect(await motionOf(page)).toBe('slide');
    expect(await longestAnimation(page)).toBeLessThanOrEqual(SHORT);
    await freezeAt(page, SHORT / 2);
    // Mid-way the marked elements are the old ones, still on their row (y unchanged).
    const mid = await page.evaluate(() =>
      [...document.querySelectorAll<SVGGElement>('.marker[data-probe]')].map((el) => ({
        probe: el.dataset.probe,
        y: new DOMMatrix(getComputedStyle(el).transform).m42
      }))
    );
    expect(mid.length).toBeGreaterThan(0);
    for (const m of mid) {
      const old = Object.values(before).find((b) => b.id === m.probe);
      expect(old).toBeDefined();
      expect(m.y).toBeCloseTo(old?.y ?? NaN, 1);
    }
    await finishAll(page);
    await expect(board(page).locator('.markers .marker')).not.toHaveCount(0);
  });

  test('Triads quality moves only the changed role; other markers stay put', async ({ page }) => {
    await open(page, '/triads');
    await page.evaluate(() =>
      document
        .querySelectorAll('.marker')
        .forEach((el, i) => ((el as HTMLElement).dataset.probe = `${i}`))
    );
    const before = await snapshot(page);
    await page
      .getByRole('radiogroup', { name: 'Quality' })
      .getByRole('radio', { name: 'minor' })
      .click();
    expect(await motionOf(page)).toBe('by-role');
    const stills = await page.evaluate(() =>
      ['root', 'fifth'].map((fn) => {
        const el = document.querySelector<SVGGElement>(`.marker.${fn}`);
        return {
          fn,
          animations: el ? el.getAnimations({ subtree: true }).length : -1
        };
      })
    );
    for (const s of stills) expect(s.animations, `${s.fn} animates`).toBe(0);
    const after = await snapshot(page);
    const roles = (snap: Record<string, { x: number; y: number }>) =>
      Object.values(snap).map((m) => `${m.x},${m.y}`);
    // Root and fifth keep their exact transform.
    expect(roles(after).filter((p) => roles(before).includes(p)).length).toBeGreaterThanOrEqual(2);
  });

  test('comparison on slides from the base marker; off fades out', async ({ page }) => {
    await open(page, '/triads');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    expect(await motionOf(page)).toBe('by-role');
    await expect(board(page).locator('.marker.comparison').first()).toBeAttached();
    expect(await longestAnimation(page)).toBeLessThanOrEqual(SHORT);
    await finishAll(page);
    // The slide-from starts on the frame after the insert, so finish until none is left.
    await expect
      .poll(async () => {
        await finishAll(page);
        return page.evaluate(() => document.getAnimations().length);
      })
      .toBe(0);
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    expect(await motionOf(page)).toBe('by-role');
    // Poll: the outro starts on the frame after the click.
    await expect
      .poll(async () => {
        await freezeAt(page, SHORT / 2);
        return page.evaluate(() => {
          const els = [...document.querySelectorAll('.marker.comparison')];
          return (
            els.length > 0 &&
            els.every((el) => {
              const o = Number(getComputedStyle(el).opacity);
              return o > 0 && o < 1;
            })
          );
        });
      })
      .toBe(true);
  });

  test('inversion cross-fades: old and new are both partly visible mid-way', async ({ page }) => {
    await open(page, '/triads');
    await page.getByRole('radio', { name: '1st inversion' }).click();
    expect(await motionOf(page)).toBe('cross-fade');
    expect(await longestAnimation(page)).toBeLessThanOrEqual(SHORT);
    await freezeAt(page, SHORT / 2);
    const opacities = await page.evaluate(() =>
      [...document.querySelectorAll('.markers > .marker')].map((el) =>
        Number(getComputedStyle(el).opacity)
      )
    );
    expect(opacities.length).toBeGreaterThanOrEqual(6);
    for (const o of opacities) {
      expect(o).toBeGreaterThan(0);
      expect(o).toBeLessThan(1);
    }
    await finishAll(page);
  });

  test('CAGED key slides; layer on reveals; focus keeps markers in place', async ({ page }) => {
    await open(page, '/caged');
    await key(page, 'G').click();
    expect(await motionOf(page)).toBe('slide');
    expect(await longestAnimation(page)).toBeLessThanOrEqual(SHORT);
    await finishAll(page);

    await page
      .getByRole('group', { name: 'Layers' })
      .getByRole('switch', { name: 'Arpeggio' })
      .click();
    expect(await motionOf(page)).toBe('reveal');
    expect(await longestAnimation(page)).toBeLessThanOrEqual(SHORT);
    await finishAll(page);

    await page
      .getByRole('radiogroup', { name: 'Shape' })
      .getByRole('radio', { name: 'E', exact: true })
      .click();
    expect(await motionOf(page)).toBe('focus');
  });

  test('state first: description and URL are final before the animation ends', async ({ page }) => {
    await open(page, '/triads');
    const url = page.url();
    await root(page, 'D').click();
    expect(await freezeAt(page, 0)).toBeGreaterThan(0);
    await expect(board(page).locator('.description')).toContainText('D');
    await expect(page.getByRole('button', { name: 'D', exact: true }).first()).toBeVisible();
    // The link already carries the new root while every animation is still at its start.
    await expect(page).toHaveURL(/rt=2/);
    expect(page.url()).not.toBe(url);
    await finishAll(page);
  });

  test('interrupted mid-transition: the latest change wins', async ({ browser }) => {
    const settle = async (steps: string[]) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await open(page, '/triads');
      for (const s of steps) {
        await root(page, s).click();
        await freezeAt(page, SHORT / 2);
      }
      await finishAll(page);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(0))));
      const settled = await page.evaluate(() =>
        [...document.querySelectorAll('.markers > .marker')]
          .map((el) => {
            const m = new DOMMatrix(getComputedStyle(el).transform);
            return `${(el as HTMLElement).dataset.key}@${Math.round(m.m41)},${Math.round(m.m42)}`;
          })
          .sort()
      );
      await ctx.close();
      return settled;
    };
    expect(await settle(['D', 'E'])).toEqual(await settle(['E']));
  });

  test('instant changes: label type, tool switch and theme do not animate', async ({ page }) => {
    await open(page, '/triads');
    await page.getByRole('radio', { name: 'Note names' }).click();
    expect(await motionOf(page)).toBe('none');
    await root(page, 'D').click();
    expect(await motionOf(page)).toBe('slide');
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    expect(await motionOf(page)).toBe('slide'); // the theme never touches data-motion
    await page
      .getByRole('navigation', { name: 'Tools' })
      .getByRole('link', { name: 'CAGED' })
      .click();
    await expect(page).toHaveURL(/\/caged/);
    await expect(page.getByRole('group', { name: 'Key' })).toBeVisible();
    expect(await motionOf(page)).toBe('none');
  });

  test('reduced motion toggled live: everything is instant', async ({ page }) => {
    await open(page, '/triads');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await root(page, 'D').click();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(0))));
    const longest = await longestAnimation(page);
    expect(longest).toBeLessThanOrEqual(1);
    await page.getByRole('radio', { name: '1st inversion' }).click();
    expect(await longestAnimation(page)).toBeLessThanOrEqual(1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await root(page, 'E').click();
    expect(await longestAnimation(page)).toBeGreaterThan(1);
  });
});
