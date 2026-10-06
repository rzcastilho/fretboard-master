import { expect, test, type Browser, type Page } from '@playwright/test';

import { expectNoHorizontalScroll, runAxe, setTextScale, trackRequests } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';

const board = (page: Page) => page.getByRole('region', { name: 'Fretboard' });
const E_TAG = /^E shape · roots on strings 6, 4, 1$/;
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const noticeCount = (page: Page) =>
  page.getByRole('status').filter({ hasText: /incomplete|This view uses|strings:/ });

/**
 * Build a canonical link the way a sender would: in a fresh browser context (default
 * preferences), drive the view, wait for the address to settle, and read it back.
 */
async function makeLink(
  browser: Browser,
  baseURL: string | undefined,
  path: string,
  drive: (page: Page) => Promise<void>
): Promise<string> {
  const context = await browser.newContext({ baseURL, locale: 'en-US' });
  try {
    const page = await context.newPage();
    await page.goto(path);
    await drive(page);
    await page.waitForTimeout(300);
    return page.url();
  } finally {
    await context.close();
  }
}

const cagedDMajorE = (browser: Browser, baseURL: string | undefined) =>
  makeLink(browser, baseURL, '/caged', async (page) => {
    await page
      .getByRole('group', { name: 'Key' })
      .getByRole('button', { name: 'D', exact: true })
      .click();
    await board(page).getByRole('button', { name: E_TAG }).first().click();
    await expect.poll(() => page.url()).toMatch(/fc=E\./);
  });

const notesLink = (browser: Browser, baseURL: string | undefined) =>
  makeLink(browser, baseURL, '/notes', async (page) => {
    await page
      .getByRole('group', { name: 'Choose notes' })
      .getByRole('button', { name: 'G', exact: true })
      .click();
    await page
      .getByRole('radiogroup', { name: 'Label' })
      .getByRole('radio', { name: 'Octave' })
      .click();
    await expect.poll(() => page.url()).toMatch(/lb=octave/);
  });

const triadsLink = (browser: Browser, baseURL: string | undefined) =>
  makeLink(browser, baseURL, '/triads', async (page) => {
    await page
      .getByRole('group', { name: 'Root' })
      .getByRole('button', { name: 'A', exact: true })
      .click();
    await radio(page, 'minor').click();
    await radio(page, '2nd inversion').click();
    await expect.poll(() => page.url()).toMatch(/inv=second/);
  });

/** Preferences a viewer might have stored; presentation only (language, handedness, sound). */
const ANA_PREFS = {
  version: 1,
  handedness: 'left',
  language: 'pt-BR',
  accidentals: 'flats',
  muted: true,
  volume: 0.4
};

async function seedPrefs(page: Page, prefs: object): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      // Seed once: later reloads must see whatever the app itself wrote.
      if (localStorage.getItem(key as string) === null)
        localStorage.setItem(key as string, value as string);
    },
    [PREFS_KEY, JSON.stringify(prefs)] as const
  );
}

const storedPrefs = (page: Page) =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
  }, PREFS_KEY);

const withoutLastTool = (r: Record<string, unknown> | null) => {
  if (r === null) return null;
  return Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'lastTool'));
};

test.describe('open link US1: land on exactly the shared view', () => {
  test('Ana: a CAGED D major, E shape link opens mirrored and in Portuguese, no home screen', async ({
    page,
    browser,
    baseURL
  }) => {
    const link = await cagedDMajorE(browser, baseURL);
    expect(link).toMatch(/\/caged\?v=1&rt=2&/);

    await seedPrefs(page, ANA_PREFS);
    await page.goto(link);
    // The region name is localised (pt-BR here): wait on the nut instead.
    await page.locator('.nut').waitFor();

    // Tool, key, quality and shape are exactly the shared ones.
    expect(new URL(page.url()).pathname).toBe('/caged');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('navigation', { name: 'Ferramentas' })).toBeVisible();
    await expect(
      page.getByRole('radiogroup', { name: 'Forma' }).getByRole('radio', { name: 'E', exact: true })
    ).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Maior', exact: true })).toBeChecked();
    // The settled address is the same view (key D, E shape in focus).
    await expect.poll(() => page.url()).toBe(link);
    // Presentation is the viewer's own: left-handed means the string labels sit right of the nut.
    const label = await page.locator('.string-label').first().boundingBox();
    const nut = await page.locator('.nut').boundingBox();
    if (!label || !nut) throw new Error('no boxes');
    expect(label.x).toBeGreaterThan(nut.x);
    // No home screen was shown on the way: the heading is the tool's.
    await expect(page.getByRole('heading', { level: 1, name: 'CAGED' })).toBeVisible();
  });

  for (const [name, make, tool] of [
    ['Notes', notesLink, 'notes'],
    ['Triads', triadsLink, 'triads'],
    ['CAGED', cagedDMajorE, 'caged']
  ] as const) {
    test(`${name}: a Share-produced link opens identical state with no notice`, async ({
      page,
      browser,
      baseURL
    }) => {
      const link = await make(browser, baseURL);
      await page.goto(link);
      expect(new URL(page.url()).pathname).toBe(`/${tool}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // Every state field applied: the canonical address of what is drawn equals the link.
      await page.waitForTimeout(300);
      expect(page.url()).toBe(link);
      await expect(noticeCount(page)).toHaveCount(0);

      if (tool === 'notes') {
        await expect(
          page
            .getByRole('group', { name: 'Choose notes' })
            .getByRole('button', { name: 'G', exact: true })
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(
          page.getByRole('radiogroup', { name: 'Label' }).getByRole('radio', { name: 'Octave' })
        ).toBeChecked();
      } else if (tool === 'triads') {
        await expect(radio(page, 'minor')).toBeChecked();
        await expect(radio(page, '2nd inversion')).toBeChecked();
        await expect(
          page.getByRole('group', { name: 'Root' }).getByRole('button', { name: 'A', exact: true })
        ).toHaveAttribute('aria-pressed', 'true');
      } else {
        await expect(
          page
            .getByRole('radiogroup', { name: 'Shape' })
            .getByRole('radio', { name: 'E', exact: true })
        ).toHaveAttribute('aria-checked', 'true');
        await expect(page.getByRole('radio', { name: 'Major', exact: true })).toBeChecked();
      }
    });
  }

  test('opening writes no preference: presentation and sound keep their stored values', async ({
    page,
    browser,
    baseURL
  }) => {
    const link = await cagedDMajorE(browser, baseURL);
    await seedPrefs(page, ANA_PREFS);
    await page.goto('/about');
    const before = await storedPrefs(page);
    expect(before).toMatchObject(ANA_PREFS);

    await page.goto(link);
    await page.locator('.nut').waitFor();
    await page.waitForTimeout(300);

    const after = await storedPrefs(page);
    // Only `lastTool` may change. Recording it rewrites the record with its defaults filled in, so
    // compare every stored value the viewer chose, and the instrument and labels they did not.
    expect(after).toMatchObject(ANA_PREFS);
    expect(after).toMatchObject({ tuning: 'AF-1', frets: 22 });
    expect(after?.labels).toEqual({ notes: 'name', triads: 'interval' });
    expect(Object.keys(withoutLastTool(after) ?? {}).sort()).toEqual(
      [
        'accidentals',
        'frets',
        'handedness',
        'labels',
        'language',
        'muted',
        'tuning',
        'version',
        'volume'
      ].sort()
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });

  test('a bare tool path opens normally with no notice', async ({ page }) => {
    await page.goto('/caged');
    await board(page).waitFor();
    await expect(page.getByRole('radio', { name: 'Major', exact: true })).toBeChecked();
    await expect(noticeCount(page)).toHaveCount(0);
    await expect.poll(() => page.url()).toMatch(/\/caged\?v=1&/);
  });

  test('client-side navigation keeps in-memory session state and never re-applies a link', async ({
    page,
    browser,
    baseURL
  }) => {
    const link = await triadsLink(browser, baseURL);
    await page.goto(link);
    await expect(radio(page, '2nd inversion')).toBeChecked();

    // The opened link's state is edited in the session…
    await radio(page, 'Root position').click();
    await expect.poll(() => page.url()).toContain('inv=root');

    const nav = (name: string) =>
      page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name });
    await nav('CAGED').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/caged');
    await nav('Triads').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/triads');
    // …and survives leaving and returning: the original link is not applied again.
    await expect(radio(page, 'Root position')).toBeChecked();
    await expect(radio(page, 'minor')).toBeChecked();

    // Back/Forward onto a tool address with a query keeps the in-memory state too.
    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/caged');
    await page.goForward();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/triads');
    await expect(radio(page, 'Root position')).toBeChecked();
    await expect(noticeCount(page)).toHaveCount(0);
  });
});

// ---- US2: a link on a different instrument ---------------------------------------------------

const CAGED_BASE = 'v=1&rt=2&sp=none&q=major&fc=-&ly=10000&cn=0&ts=-&lb=interval';
const cagedUrl = (instrument: string, tmp = 0) => `/caged?${CAGED_BASE}&tmp=${tmp}&${instrument}`;
const DROP_D = 'sc=6&tu=AF-4&fr=22';
const STANDARD = 'sc=6&tu=AF-1&fr=22';
const instrumentNotice = (page: Page) =>
  page.getByRole('status').filter({ hasText: /This view uses/ });
const useMine = (page: Page) => page.getByRole('button', { name: 'Use mine' });
const adopt = (page: Page) => page.getByRole('button', { name: 'Adopt this one' });
const tuningBadge = (page: Page) => page.getByRole('button', { name: /^Tuning:/ });

test.describe('open link US2: different instrument, Use mine or Adopt this one', () => {
  test('Drop D link with stored Standard shows the notice with its three actions', async ({
    page
  }) => {
    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    const notice = instrumentNotice(page);
    await expect(notice).toContainText('This view uses Drop D');
    await expect(notice.getByRole('button')).toHaveText(['Use mine', 'Adopt this one', 'Dismiss']);
    await expect(tuningBadge(page)).toContainText('Drop D');
  });

  test('no notice when the link instrument equals the stored one', async ({ page }) => {
    await page.goto(cagedUrl(STANDARD));
    await board(page).waitFor();
    await expect(instrumentNotice(page)).toHaveCount(0);
  });

  test('opening another tool keeps the stored instrument', async ({ page }) => {
    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    await page
      .getByRole('navigation', { name: 'Tools' })
      .getByRole('link', { name: 'Notes' })
      .click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/notes');
    await expect(instrumentNotice(page)).toHaveCount(0);
    await expect(tuningBadge(page)).toHaveCount(0);
    await expect.poll(() => page.url()).toMatch(/tu=AF-1/);
  });

  test('leaving the tool and coming back shows the notice again', async ({ page }) => {
    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    await instrumentNotice(page).getByRole('button', { name: 'Dismiss' }).click();
    await expect(instrumentNotice(page)).toHaveCount(0);
    const nav = (name: string) =>
      page.getByRole('navigation', { name: 'Tools' }).getByRole('link', { name });
    await nav('Notes').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/notes');
    await nav('CAGED').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/caged');
    await expect(instrumentNotice(page)).toBeVisible();
  });

  test('Use mine recalculates on the stored instrument, closes the notice, writes nothing', async ({
    page
  }) => {
    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    const before = await storedPrefs(page);
    await useMine(page).click();
    await expect(instrumentNotice(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'CAGED' })).toBeFocused();
    await expect(tuningBadge(page)).toHaveCount(0);
    await expect.poll(() => page.url()).toMatch(/tu=AF-1/);
    const after = await storedPrefs(page);
    expect(withoutLastTool(after)).toEqual(withoutLastTool(before));
  });

  test('Adopt this one stores Drop D, closes the notice and leaves the view unchanged', async ({
    page
  }) => {
    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    const address = page.url();
    await adopt(page).click();
    await expect(instrumentNotice(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'CAGED' })).toBeFocused();
    await expect(tuningBadge(page)).toContainText('Drop D');
    await expect.poll(() => page.url()).toBe(address);
    await expect.poll(async () => (await storedPrefs(page))?.tuning).toBe('AF-4');
    await page.reload();
    await board(page).waitFor();
    await expect(tuningBadge(page)).toContainText('Drop D');
    await expect(instrumentNotice(page)).toHaveCount(0);
  });

  test('a custom tuning lists its string notes lowest to highest', async ({ page }) => {
    await page.goto(cagedUrl('sc=6&tu=c.64.59.56.50.45.40&fr=22'));
    await board(page).waitFor();
    await expect(instrumentNotice(page)).toContainText('This view uses E A D G♯ B E');
  });

  test('a 7-string link on 6 stored strings names the count', async ({ page }) => {
    await page.goto(
      '/notes?v=1&sel=-&str=1.2.3.4.5.6.7&rg=0.22&bg=naturals&hn=0&cd=-&lb=name&sc=7&tu=AF-21&fr=22'
    );
    await expect(instrumentNotice(page)).toContainText('This view uses 7 strings:');
  });

  test('Use mine on a 7-6-5 triad set moves to the nearest set with the adjusted notice', async ({
    page
  }) => {
    await page.goto(
      '/triads?v=1&rt=0&sp=none&q=major&inv=root&ss=7&vw=isolated&oc=0&cmp=0&cq=-&lb=interval&sc=7&tu=AF-21&fr=22'
    );
    await expect(instrumentNotice(page)).toContainText('7 strings');
    await useMine(page).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'We adjusted the view to the new instrument' })
    ).toBeVisible();
    await expect(
      page.getByRole('radiogroup', { name: /string set/i }).getByRole('radio', { name: '6-5-4' })
    ).toBeChecked();
  });

  test('non-compatible link tuning in CAGED shows the standard fallback; Use mine ends it', async ({
    page
  }) => {
    await page.goto(cagedUrl('sc=6&tu=c.64.59.56.50.45.40&fr=22', 1));
    await board(page).waitFor();
    await expect(instrumentNotice(page)).toContainText('E A D G♯ B E');
    await expect(page.getByRole('button', { name: /Temporary tuning: Standard/ })).toBeVisible();
    await useMine(page).click();
    await expect(page.getByRole('button', { name: /Temporary tuning/ })).toHaveCount(0);
  });

  test('changing the instrument in the panel saves it and closes the notice', async ({ page }) => {
    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    await page.getByRole('button', { name: 'Instrument', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Half step down' }).check();
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(instrumentNotice(page)).toHaveCount(0);
    await expect.poll(async () => (await storedPrefs(page))?.tuning).toBe('AF-2');
  });
});

// ---- US3: untrusted, incomplete or newer links never break the app --------------------------

const incomplete = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'This link was incomplete' });

test.describe('open link US3: untrusted, incomplete or newer links', () => {
  test('invalid frets and quality default, the valid key stays, one notice', async ({ page }) => {
    await page.goto('/caged?v=1&rt=2&q=banana&fr=99');
    await board(page).waitFor();
    await expect(incomplete(page)).toHaveCount(1);
    await expect(page.getByRole('radio', { name: 'Major', exact: true })).toBeChecked();
    await expect(page.getByText('D major', { exact: true })).toBeVisible();
    await expect.poll(() => page.url()).toMatch(/rt=2&/);
    await expect.poll(() => page.url()).toMatch(/fr=22/);
  });

  test('an unknown tool opens home at "/" with the incomplete notice, not not-found', async ({
    page
  }) => {
    await page.goto('/scales?v=1&rt=0');
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Master' })).toBeVisible();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await expect(incomplete(page)).toHaveCount(1);
    await expect(page.getByText('We could not find that page')).toHaveCount(0);
  });

  test('a path that is not a link keeps the not-found notice', async ({ page }) => {
    await page.goto('/scales');
    await expect(page.getByText('We could not find that page')).toBeVisible();
    await expect(incomplete(page)).toHaveCount(0);
  });

  test('a newer version opens the tool with the selection kept and the notice', async ({
    page
  }) => {
    await page.goto('/notes?v=9&sel=0.4.7');
    await expect(page.getByRole('heading', { level: 1, name: 'Fretboard Notes' })).toBeVisible();
    await expect(incomplete(page)).toHaveCount(1);
    const choose = page.getByRole('group', { name: 'Choose notes' });
    for (const n of ['C', 'E', 'G']) {
      await expect(choose.getByRole('button', { name: n, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    }
  });

  test('missing parameters take defaults with one notice', async ({ page }) => {
    await page.goto('/triads?v=1&rt=5');
    await expect(page.getByRole('heading', { level: 1, name: 'Triads' })).toBeVisible();
    await expect(incomplete(page)).toHaveCount(1);
    await expect(
      page.getByRole('group', { name: 'Root' }).getByRole('button', { name: 'F', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(radio(page, 'major')).toBeChecked();
  });

  test('unknown extra parameters on an otherwise valid link show no notice', async ({
    page,
    browser,
    baseURL
  }) => {
    const link = await cagedDMajorE(browser, baseURL);
    await page.goto(`${link}&utm_source=chat&x=1`);
    await board(page).waitFor();
    await expect(noticeCount(page)).toHaveCount(0);
  });

  test('an invalid custom tuning uses the stored instrument: incomplete notice only', async ({
    page
  }) => {
    await page.goto(cagedUrl('sc=6&tu=c.&fr=22'));
    await board(page).waitFor();
    await expect(incomplete(page)).toHaveCount(1);
    await expect(instrumentNotice(page)).toHaveCount(0);
    await expect(tuningBadge(page)).toHaveCount(0);
  });

  test('hostile values never run, render as markup, or break the view', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    const long = 'x'.repeat(3_000);
    for (const path of [
      '/notes?v=1&sel=<script>alert(1)</script>&lb=%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E',
      `/caged?v=1&rt=2&q=${long}&fc=${long}`
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(incomplete(page)).toHaveCount(1);
      await expect(page.locator('main script, main img[src="x"]')).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Fretboard' })).toBeVisible();
    }
    expect(dialogs).toEqual([]);
  });

  test('both notices together leave the fretboard reachable', async ({ page }) => {
    await page.goto(`/caged?v=1&rt=2&q=banana&${DROP_D}`);
    await board(page).waitFor();
    await expect(instrumentNotice(page)).toBeVisible();
    await expect(incomplete(page)).toHaveCount(1);
    await expect(board(page).getByRole('grid', { name: 'Fretboard' })).toBeVisible();
    await expect(board(page)).toBeInViewport();
    await incomplete(page).getByRole('button', { name: 'Dismiss' }).click();
    await expect(incomplete(page)).toHaveCount(0);
    await expect(instrumentNotice(page)).toBeVisible();
  });
});

test.describe('open link US4: address and history after opening', () => {
  const REPAIRABLE = '/caged?v=1&rt=2&q=banana&fc=zzz&ly=10000&cn=0&ts=-&lb=interval';

  test('a repaired link settles on the canonical address without a new history entry', async ({
    page
  }) => {
    await page.goto('about:blank');
    const before = await page.evaluate(() => history.length);
    await page.goto(REPAIRABLE);
    await board(page).waitFor();
    await page.waitForTimeout(300);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/caged');
    expect(url.search).not.toContain('banana');
    expect(url.search).not.toContain('zzz');
    // goto added exactly one entry; the repair replaced it rather than pushing another.
    expect(await page.evaluate(() => history.length)).toBe(before + 1);
  });

  test('Back once from a repaired link leaves the app', async ({ page }) => {
    await page.goto('about:blank');
    await page.goto(REPAIRABLE);
    await board(page).waitFor();
    await page.waitForTimeout(300);
    await page.goBack();
    await expect.poll(() => page.url()).toBe('about:blank');
  });

  test('reloading the canonical address reproduces the same view and address', async ({ page }) => {
    await page.goto(REPAIRABLE);
    await board(page).waitFor();
    await page.waitForTimeout(300);
    const canonical = page.url();
    await page.reload();
    await board(page).waitFor();
    await page.waitForTimeout(300);
    expect(page.url()).toBe(canonical);
    // Already canonical: nothing was repaired, so no notice appears.
    await expect(noticeCount(page)).toHaveCount(0);
  });
});

// ---- Polish: accessibility, small screens, offline --------------------------------------------

const BOTH_NOTICES = `/caged?v=1&rt=2&q=banana&${DROP_D}`;
const anyNotice = (page: Page) => page.locator('[role="status"].notice');

test.describe('open link polish: accessibility and resilience', () => {
  test('both notices visible: zero axe violations', async ({ page }) => {
    await page.goto(BOTH_NOTICES);
    await board(page).waitFor();
    await expect(anyNotice(page)).toHaveCount(2);
    await runAxe(page);
  });

  test('Tab order is Use mine, Adopt this one, Dismiss; Enter and Space activate', async ({
    page
  }) => {
    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    const notice = instrumentNotice(page);
    await useMine(page).focus();
    await page.keyboard.press('Tab');
    await expect(adopt(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(notice.getByRole('button', { name: 'Dismiss' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(useMine(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(notice).toHaveCount(0);

    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    await adopt(page).focus();
    await page.keyboard.press('Space');
    await expect(instrumentNotice(page)).toHaveCount(0);
  });

  test('notices are polite status regions, never assertive', async ({ page }) => {
    await page.goto(BOTH_NOTICES);
    await board(page).waitFor();
    const notices = anyNotice(page);
    await expect(notices).toHaveCount(2);
    for (const notice of await notices.all()) {
      await expect(notice).toHaveAttribute('aria-live', 'polite');
      await expect(notice.locator('[role="alert"], [aria-live="assertive"]')).toHaveCount(0);
    }
  });

  test('200 % zoom: both notices stay visible without horizontal scroll', async ({ page }) => {
    await page.goto(BOTH_NOTICES);
    await board(page).waitFor();
    await setTextScale(page, 200);
    await expect(anyNotice(page)).toHaveCount(2);
    for (const notice of await anyNotice(page).all()) await expect(notice).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('opening a link makes no network request after load', async ({ page }) => {
    const tracker = trackRequests(page);
    await page.goto(cagedUrl(DROP_D));
    await board(page).waitFor();
    await expect(instrumentNotice(page)).toBeVisible();
    await page.waitForTimeout(300);
    expect(tracker.requests.map((r) => r.url())).toEqual([]);
  });
});

for (const { tag, locale } of [
  { tag: 'en', locale: 'en-US' },
  { tag: 'es', locale: 'es-ES' },
  { tag: 'pt-BR', locale: 'pt-BR' }
]) {
  test.describe(`open link polish: 320 px notice in ${tag}`, () => {
    test.use({ locale, viewport: { width: 320, height: 700 } });

    test('no horizontal scroll and the message fits two lines', async ({ page }) => {
      await page.goto(cagedUrl(DROP_D));
      await expect(page.locator('html')).toHaveAttribute('lang', tag);
      const notice = page.locator('[role="status"].notice', {
        has: page.locator('button:nth-of-type(3)')
      });
      await expect(notice).toHaveCount(1);
      await expectNoHorizontalScroll(page);
      const lines = await notice.locator('p').evaluate((el) => {
        const style = getComputedStyle(el);
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
        return Math.round(el.getBoundingClientRect().height / lineHeight);
      });
      expect(lines).toBeLessThanOrEqual(2);
    });
  });
}
