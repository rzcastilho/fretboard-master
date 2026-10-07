import { expect, test, type Page } from '@playwright/test';

import { expandDetails, runAxe } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';
const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const tag = (page: Page, text: RegExp | string) =>
  board(page)
    .getByRole('button', { name: text, exact: typeof text === 'string' })
    .first();
const selector = (page: Page) => page.getByRole('radiogroup', { name: 'Shape' });
const radio = (page: Page, name: string) =>
  selector(page).getByRole('radio', { name, exact: true });
const markers = (page: Page, emphasis: string) =>
  board(page).locator(`.markers .marker.${emphasis}`);

const E_TAG = /^E shape · roots on strings 6, 4, 1$/;

/** Band centre vs viewport centre, or the clamped scroll ends. */
async function bandIsCentred(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('.scroller');
    const band = document.querySelector<SVGGraphicsElement>('.region-band');
    if (!scroller || !band) return false;
    const s = scroller.getBoundingClientRect();
    const b = band.getBoundingClientRect();
    const centred = Math.abs(b.left + b.width / 2 - (s.left + s.width / 2)) <= 2;
    const max = scroller.scrollWidth - scroller.clientWidth;
    const atEnd = scroller.scrollLeft <= 0.5 || scroller.scrollLeft >= max - 0.5;
    const fits = max <= 0;
    return centred || atEnd || fits;
  });
}

const withFixture = (page: Page, id: string) =>
  page.addInitScript((v) => {
    globalThis.__fmInstrument = v;
  }, id);

test.describe('caged focus US1: focus on one shape', () => {
  test('focus via tag: highlighted/dimmed, band 8–10, pressed, selector, centred', async ({
    page
  }) => {
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    await expect(markers(page, 'normal').first()).toBeVisible();
    await expect(board(page).locator('.region-band')).toHaveCount(0);

    await tag(page, E_TAG).click();
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');
    await expect(radio(page, 'E')).toHaveAttribute('aria-checked', 'true');
    await expect(markers(page, 'highlighted').first()).toBeVisible();
    await expect(markers(page, 'dimmed').first()).toBeAttached();
    await expect(markers(page, 'normal')).toHaveCount(0);
    await expect(board(page).locator('rect.region-band')).toHaveCount(1);

    // The scroll window is 500 ms (+1 frame) with full motion.
    await page.clock.runFor(600);
    expect(await bandIsCentred(page)).toBe(true);
    await expect(board(page).locator('.description')).toContainText(
      'E shape in focus, frets 8 to 10.'
    );
  });

  test('leave focus via a second tap and via See all', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await tag(page, E_TAG).click();
    await expect(markers(page, 'dimmed').first()).toBeAttached();
    await tag(page, E_TAG).click();
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'false');
    await expect(markers(page, 'dimmed')).toHaveCount(0);
    await expect(board(page).locator('.region-band')).toHaveCount(0);
    await expect(radio(page, 'See all')).toHaveAttribute('aria-checked', 'true');

    await tag(page, E_TAG).click();
    await radio(page, 'See all').click();
    await expect(markers(page, 'dimmed')).toHaveCount(0);
    await expect(board(page).locator('.region-band')).toHaveCount(0);
    await expect(board(page).locator('.description')).toContainText('All shapes.');
  });

  test('selector G equals tapping the G tag', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await radio(page, 'G').click();
    await expect(radio(page, 'G')).toHaveAttribute('aria-checked', 'true');
    const viaSelector = await markers(page, 'highlighted').count();
    const pressed = await board(page).locator('button.tag[aria-pressed="true"]').allInnerTexts();
    await radio(page, 'See all').click();
    await tag(page, /^G shape/)
      .first()
      .click();
    await expect(radio(page, 'G')).toHaveAttribute('aria-checked', 'true');
    expect(await markers(page, 'highlighted').count()).toBe(viaSelector);
    expect(await board(page).locator('button.tag[aria-pressed="true"]').allInnerTexts()).toEqual(
      pressed
    );
  });

  test('22 frets: the second C tag focuses only that occurrence; picking C changes nothing', async ({
    page
  }) => {
    await page.goto('/caged');
    await expandDetails(page);
    const cTags = board(page).getByRole('button', { name: /^C shape/ });
    await expect(cTags).toHaveCount(2);
    await cTags.nth(1).click();
    await expect(cTags.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(cTags.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(700); // let the centring scroll settle
    const band = await board(page).locator('.region-band').boundingBox();
    await radio(page, 'C').click();
    await page.waitForTimeout(700);
    await expect(cTags.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(cTags.nth(0)).toHaveAttribute('aria-pressed', 'false');
    expect(await board(page).locator('.region-band').boundingBox()).toEqual(band);
  });

  test('a 12-fret instrument disables D', async ({ page }) => {
    await withFixture(page, 'AF-1-12');
    await page.goto('/caged');
    await expandDetails(page);
    await expect(radio(page, 'D')).toHaveAttribute('aria-disabled', 'true');
    await radio(page, 'D').click({ force: true });
    await expect(radio(page, 'See all')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, 'E')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('reduced motion scrolls in the same frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    await tag(page, E_TAG).click();
    await page.clock.runFor(32);
    expect(await bandIsCentred(page)).toBe(true);
  });

  test('focus survives Notes → CAGED navigation, resets on a fresh open, never touches prefs', async ({
    page
  }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), PREFS_KEY))
      .not.toBeNull();
    const before = await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY);
    await tag(page, E_TAG).click();
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)).toBe(before);

    const nav = page.getByRole('navigation', { name: 'Tools' });
    await nav.getByRole('link', { name: 'Fretboard Notes' }).click();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    await nav.getByRole('link', { name: 'CAGED' }).click();
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)).toBe(before);

    await page.goto('/caged');
    await expandDetails(page);
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'false');
    await expect(radio(page, 'See all')).toHaveAttribute('aria-checked', 'true');
  });

  test('axe: zero violations with focus on', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await runAxe(page);
    await radio(page, 'E').click();
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');
    await runAxe(page);
  });

  test('keyboard-only: tags and selector', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await radio(page, 'See all').focus();
    await page.keyboard.press('ArrowLeft'); // wraps to D, the last letter
    await expect(radio(page, 'D')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(radio(page, 'E')).toHaveAttribute('aria-checked', 'true');
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');

    await tag(page, E_TAG).focus();
    await page.keyboard.press('Enter');
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Space');
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');
  });
});

const stepBtn = (page: Page, name: 'Previous shape' | 'Next shape') =>
  page.getByRole('button', { name, exact: true });
const marker = (page: Page, s: number, f: number) =>
  board(page).locator(`.markers .marker[data-key="${s}:${f}"]`);
const rings = (page: Page) => board(page).locator('.markers .connection-ring');
const D_TAG = /^D shape · roots on strings 4, 2$/;
const G_TAG = /^G shape · roots on strings 6, 3, 1$/;

/** Stop fake time so the 500 ms window only advances through `clock.runFor`. */
const freeze = (page: Page) => page.clock.pauseAt(new Date(Date.now() + 5_000));

test.describe('caged focus US2: step to the neighbor shape', () => {
  test('Next shape: D focused, s4f10 ringed and highlighted, ring gone after 500 ms', async ({
    page
  }) => {
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    await tag(page, E_TAG).click();
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');

    await freeze(page);
    await stepBtn(page, 'Next shape').click();
    await expect(tag(page, D_TAG)).toHaveAttribute('aria-pressed', 'true');
    await expect(marker(page, 4, 10).locator('.connection-ring')).toHaveCount(1);
    await expect(marker(page, 4, 10)).toHaveClass(/highlighted/);

    await page.clock.runFor(499);
    await expect(rings(page)).not.toHaveCount(0);
    await page.clock.runFor(2);
    await expect(rings(page)).toHaveCount(0);
  });

  test('Previous shape shows the shared pair with the neighbor nearer the nut', async ({
    page
  }) => {
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    await tag(page, E_TAG).click();
    await freeze(page);
    await stepBtn(page, 'Previous shape').click();
    await expect(tag(page, G_TAG)).toHaveAttribute('aria-pressed', 'true');
    await expect(rings(page).first()).toBeAttached();
    await expect(marker(page, 6, 8).locator('.connection-ring')).toHaveCount(1);
    await page.clock.runFor(600);
    await expect(rings(page)).toHaveCount(0);
  });

  test('ends are disabled: none → both, first → Previous, last → Next', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    const disabled = (n: 'Previous shape' | 'Next shape') =>
      stepBtn(page, n).getAttribute('aria-disabled');
    expect(await disabled('Previous shape')).toBe('true');
    expect(await disabled('Next shape')).toBe('true');

    const tags = board(page).locator('button[aria-pressed]');
    await tags.first().click();
    expect(await disabled('Previous shape')).toBe('true');
    expect(await disabled('Next shape')).toBeNull();

    await tags.last().click();
    expect(await disabled('Previous shape')).toBeNull();
    expect(await disabled('Next shape')).toBe('true');
  });

  test('two presses within 500 ms ring only the second pair', async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    await tag(page, E_TAG).click();
    await freeze(page);
    await stepBtn(page, 'Next shape').click(); // E → D: s4f10
    await expect(marker(page, 4, 10).locator('.connection-ring')).toHaveCount(1);
    await page.clock.runFor(300);
    await stepBtn(page, 'Next shape').click(); // D → next C
    await expect(marker(page, 4, 10).locator('.connection-ring')).toHaveCount(0);
    await expect(rings(page).first()).toBeAttached();
    await page.clock.runFor(300); // 600 ms after the first press
    await expect(rings(page).first()).toBeAttached();
    await page.clock.runFor(250);
    await expect(rings(page)).toHaveCount(0);
  });

  test('reduced motion still shows the ring for the window', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    await tag(page, E_TAG).click();
    await freeze(page);
    await stepBtn(page, 'Next shape').click();
    await expect(marker(page, 4, 10).locator('.connection-ring')).toHaveCount(1);
    await page.clock.runFor(499);
    await expect(rings(page)).not.toHaveCount(0);
    await page.clock.runFor(2);
    await expect(rings(page)).toHaveCount(0);
  });

  test('axe: zero violations with the ring showing', async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    await tag(page, E_TAG).click();
    await freeze(page);
    await stepBtn(page, 'Next shape').click();
    await expect(rings(page).first()).toBeAttached();
    await page.clock.resume(); // axe needs live timers; the ring DOM was asserted above
    await runAxe(page);
  });

  test('keyboard-only: both buttons operate with Enter and Space', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await radio(page, 'E').click();
    await stepBtn(page, 'Next shape').focus();
    await page.keyboard.press('Enter');
    await expect(tag(page, D_TAG)).toHaveAttribute('aria-pressed', 'true');
    await stepBtn(page, 'Previous shape').focus();
    await page.keyboard.press('Space');
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');
  });
});

const connSwitch = (page: Page) => page.getByRole('switch', { name: 'Show connections' });
const keyBtn = (page: Page, pc: number) =>
  page.getByRole('group', { name: 'Key' }).getByRole('button').nth(pc);
const ringKeys = (page: Page) =>
  rings(page).evaluateAll((els) =>
    els.map((el) => (el.closest('.marker') as HTMLElement).dataset.key as string).sort()
  );
const sorted = (keys: string[]) => [...keys].sort();

// 22 frets: the TM table plus the same pairs +12 (contract §1).
const TM_6_3 = [
  ...['5:3', '4:5', '3:5', '2:5', '6:8', '1:8', '4:10', '3:12', '2:13', '1:12'],
  ...['5:15', '4:17', '3:17', '2:17', '6:20', '1:20']
];
const TM_7_2 = [
  ...['5:3', '4:5', '3:5', '6:8', '2:8', '1:8', '4:10', '3:12', '2:13'],
  ...['5:15', '4:17', '3:17', '6:20', '2:20', '1:20']
];

test.describe('caged focus US3: show connections', () => {
  test('C major: rings exactly the TM-6.3 anchors', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await expect(connSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(rings(page)).toHaveCount(0);
    await connSwitch(page).click();
    await expect(connSwitch(page)).toHaveAttribute('aria-checked', 'true');
    expect(await ringKeys(page)).toEqual(sorted(TM_6_3));
  });

  test('C minor: rings exactly TM-7.2 (Gm→Em includes s2f8)', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await page.getByRole('radio', { name: 'Minor', exact: true }).click();
    await connSwitch(page).click();
    const keys = await ringKeys(page);
    expect(keys).toContain('2:8');
    expect(keys).toEqual(sorted(TM_7_2));
  });

  test('off and no step shows no ring', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await expect(rings(page)).toHaveCount(0);
    await connSwitch(page).click();
    await connSwitch(page).click();
    await expect(rings(page)).toHaveCount(0);
  });

  test('connections on plus focus keeps every ring', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await connSwitch(page).click();
    await tag(page, E_TAG).click();
    expect(await ringKeys(page)).toEqual(sorted(TM_6_3));
  });

  test('switch and focus survive Notes → CAGED, reset on a fresh open, prefs unchanged', async ({
    page
  }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), PREFS_KEY))
      .not.toBeNull();
    const before = await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY);
    await connSwitch(page).click();
    await tag(page, E_TAG).click();
    const nav = page.getByRole('navigation', { name: 'Tools' });
    await nav.getByRole('link', { name: 'Fretboard Notes' }).click();
    await expect(page).toHaveURL(/\/notes(\?v=1&.*)?$/);
    await nav.getByRole('link', { name: 'CAGED' }).click();
    await expect(connSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(tag(page, E_TAG)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate((k) => localStorage.getItem(k), PREFS_KEY)).toBe(before);
    await page.goto('/caged');
    await expandDetails(page);
    await expect(connSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(rings(page)).toHaveCount(0);
  });

  test('Reset tool turns the switch off', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await connSwitch(page).click();
    await page.getByRole('button', { name: 'Reset tool' }).click();
    await expect(connSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(rings(page)).toHaveCount(0);
  });

  test('axe: zero violations with connections on', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await connSwitch(page).click();
    await expect(rings(page).first()).toBeAttached();
    await runAxe(page);
  });

  test('keyboard-only: switch operates with Enter and Space', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await connSwitch(page).focus();
    await page.keyboard.press('Enter');
    await expect(connSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Space');
    await expect(connSwitch(page)).toHaveAttribute('aria-checked', 'false');
  });

  test('F♯ minor: rings are the C-minor pattern shifted by 6 frets mod 12', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await page.getByRole('radio', { name: 'Minor', exact: true }).click();
    await keyBtn(page, 6).click();
    await connSwitch(page).click();
    const norm = (ids: string[]) =>
      sorted([...new Set(ids.map((id) => `${id.split(':')[0]}:${Number(id.split(':')[1]) % 12}`))]);
    const shifted = TM_7_2.map((id) => {
      const [s, f] = id.split(':').map(Number);
      return `${s}:${(f + 6) % 12}`;
    });
    expect(norm(await ringKeys(page))).toEqual(norm(shifted));
  });
});

test.describe('caged rotate hint US4', () => {
  const HINT = 'Turn your phone sideways to see more of the neck.';
  const hint = (page: Page) => page.getByText(HINT);
  const stored = (page: Page) =>
    page.evaluate((k) => localStorage.getItem(k), PREFS_KEY).then((raw) => raw);
  const erase = async (page: Page) => {
    await page.goto('/about');
    await page.getByRole('button', { name: 'Erase my preferences' }).click();
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page).toHaveURL('/');
  };

  test('portrait phone, empty storage: shows once, records, reload shows none, axe clean', async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/caged');
    await expandDetails(page);
    await expect(hint(page)).toBeVisible();
    await runAxe(page);
    await expect.poll(() => stored(page)).toContain('"rotateHint":true');
    expect(JSON.parse((await stored(page)) as string).version).toBe(1);
    await page.reload();
    await expect(board(page)).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
  });

  test('hides on rotation to landscape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/caged');
    await expandDetails(page);
    await expect(hint(page)).toBeVisible();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(hint(page)).toHaveCount(0);
  });

  test('desktop: none shown and nothing recorded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/caged');
    await expandDetails(page);
    await expect(board(page)).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
    expect(((await stored(page)) ?? '').includes('rotateHint')).toBe(false);
  });

  test('blocked storage: at most once per page load', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        }
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/caged');
    await expandDetails(page);
    await expect(hint(page)).toHaveCount(1);
    await page.getByRole('link', { name: 'Home' }).first().click();
    await expect(page).toHaveURL('/');
    await page.getByRole('link', { name: /CAGED/ }).first().click();
    await expect(page).toHaveURL(/\/caged(\?v=1&.*)?$/);
    await expect(board(page)).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
  });

  test('Erase my preferences clears the record so it may show again', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/caged');
    await expandDetails(page);
    await expect(hint(page)).toBeVisible();
    await expect.poll(() => stored(page)).toContain('rotateHint');
    await erase(page);
    expect(((await stored(page)) ?? '').includes('rotateHint')).toBe(false);
    await page.goto('/caged');
    await expandDetails(page);
    await expect(hint(page)).toBeVisible();
  });

  test('Reset tool keeps the record', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/caged');
    await expandDetails(page);
    await expect(hint(page)).toBeVisible();
    await page.getByRole('button', { name: 'Reset tool' }).click();
    expect(await stored(page)).toContain('"rotateHint":true');
  });
});

test.describe('caged focus polish: targets, focus ring, axe', () => {
  test('controls are at least 44×44 px with a visible focus ring', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await radio(page, 'E').click();
    const controls = [
      tag(page, E_TAG),
      radio(page, 'See all'),
      radio(page, 'E'),
      stepBtn(page, 'Previous shape'),
      stepBtn(page, 'Next shape'),
      connSwitch(page)
    ];
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      await page.keyboard.press('Shift'); // keyboard modality so :focus-visible applies
      await control.focus();
      const outline = await control.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      expect(outline.style).not.toBe('none');
      expect(outline.width).toBeGreaterThan(0);
    }
  });

  test('axe: zero violations with focus and connections both on', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await radio(page, 'E').click();
    await connSwitch(page).click();
    await stepBtn(page, 'Next shape').click();
    await expect(rings(page).first()).toBeAttached();
    await runAxe(page);
  });
});

test.describe('caged focus: dim and scroll timing (026 US4)', () => {
  const scrollLeft = (page: Page) =>
    page.evaluate(() => document.querySelector<HTMLElement>('.scroller')?.scrollLeft ?? 0);
  const C_TAG = /^C shape/;
  const bandInView = (page: Page) =>
    page.evaluate(() => {
      const s = document.querySelector<HTMLElement>('.scroller')?.getBoundingClientRect();
      const b = document.querySelector('.region-band')?.getBoundingClientRect();
      return !!s && !!b && b.left >= s.left - 1 && b.right <= s.right + 1;
    });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
  });

  test('focus scrolls to the region within 500 ms and dims the others', async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    const start = await scrollLeft(page);
    // dispatchEvent: Playwright's own click would scroll the tag into view first.
    await tag(page, E_TAG).dispatchEvent('click');
    await page.clock.runFor(100);
    const early = await scrollLeft(page);
    await page.clock.runFor(500);
    const end = await scrollLeft(page);
    expect(end).toBeGreaterThan(start);
    expect(early).toBeGreaterThanOrEqual(start);
    expect(early).toBeLessThan(end);
    expect(await bandInView(page)).toBe(true);
    await expect(markers(page, 'dimmed').first()).toBeAttached();
  });

  test('no scroll when the region is already fully in view', async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    const start = await scrollLeft(page);
    await tag(page, C_TAG).first().click();
    await page.clock.runFor(700);
    expect(await scrollLeft(page)).toBe(start);
  });

  test('clearing focus restores emphasis without scrolling', async ({ page }) => {
    await page.clock.install();
    await page.goto('/caged');
    await expandDetails(page);
    // dispatchEvent: Playwright's own click would scroll the tag into view first.
    await tag(page, E_TAG).dispatchEvent('click');
    await page.clock.runFor(700);
    const focused = await scrollLeft(page);
    await radio(page, 'See all').click();
    await page.clock.runFor(700);
    expect(await scrollLeft(page)).toBe(focused);
    await expect(markers(page, 'dimmed')).toHaveCount(0);
  });

  test('reduced motion jumps instantly and still reveals the region', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/caged');
    await expandDetails(page);
    const start = await scrollLeft(page);
    // dispatchEvent: Playwright's own click would scroll the tag into view first.
    await tag(page, E_TAG).dispatchEvent('click');
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(start);
    expect(await bandInView(page)).toBe(true);
  });
});
