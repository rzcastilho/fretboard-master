import { expect, test, type Page } from '@playwright/test';

import { expectNoTruncationOrOverlap, readAudioLog, setTextScale } from './support/helpers';

type Click = Extract<Awaited<ReturnType<typeof readAudioLog>>[number], { type: 'click' }>;

async function clicks(page: Page): Promise<Click[]> {
  return (await readAudioLog(page)).flatMap((e) => (e.type === 'click' ? [e] : []));
}

const start = (page: Page) => page.getByRole('button', { name: 'Start Training' });
const T = 60 / 85;

/** Settle the number of clicks logged, then return them. */
async function clicksUpTo(page: Page, count: number, timeout: number): Promise<Click[]> {
  await expect
    .poll(async () => (await clicks(page)).length, { timeout })
    .toBeGreaterThanOrEqual(count);
  return clicks(page);
}

test.describe('metronome ratios: alternate with a count-in (US1)', () => {
  test('2.1: initial×4, loop1×12, repeat×2, loop2×24, repeat×2, loop1…', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await start(page).click();
    const seen: string[] = [];
    // 4 + 12 + 2 + 24 + 2 + 12 + 2 + 24 = 2 full cycles of the loop part, sampled per frame.
    await expect
      .poll(
        async () => {
          const text = ((await page.locator('.position').textContent()) ?? '')
            .replace(/\s+/g, ' ')
            .trim();
          if (seen[seen.length - 1] !== text) seen.push(text);
          return (await clicks(page)).length;
        },
        { timeout: 40_000, intervals: [20] }
      )
      .toBeGreaterThanOrEqual(4 + 12 + 2 + 24 + 2 + 12);
    const log = await clicks(page);
    const phases = log.slice(0, 4 + 12 + 2 + 24 + 2 + 12).map((c) => c.phase);
    expect(phases).toEqual([
      ...Array<string>(4).fill('initial'),
      ...Array<string>(12).fill('loop1'),
      ...Array<string>(2).fill('repeat'),
      ...Array<string>(24).fill('loop2'),
      ...Array<string>(2).fill('repeat'),
      ...Array<string>(12).fill('loop1')
    ]);
    for (let i = 0; i < log.length; i++) expect(log[i].slot).toBeGreaterThanOrEqual(0);
    const initial = ['COUNT IN 1/4', 'COUNT IN 2/4', 'COUNT IN 3/4', 'COUNT IN 4/4'];
    const idx = (s: string) => seen.indexOf(s);
    for (const s of initial) expect(seen).toContain(s);
    expect(seen).toContain('BEAT 1/4 · SUB 3');
    expect(seen).toContain('BEAT 4/4 · SUB 3');
    expect(seen).toContain('COUNT IN 1/2');
    expect(seen).toContain('COUNT IN 2/2');
    expect(seen).toContain('BEAT 1/4 · SUB 6');
    expect(seen).toContain('BEAT 4/4 · SUB 6');
    expect(idx('BEAT 4/4 · SUB 3')).toBeLessThan(idx('COUNT IN 1/2'));
    expect(idx('COUNT IN 2/2')).toBeLessThan(idx('BEAT 1/4 · SUB 6'));
  });

  for (const bpm of [30, 85, 300]) {
    test(`2.2: phase gaps are one beat at ${bpm} BPM`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto('/metronome');
      await page.getByRole('slider', { name: 'BPM' }).fill(String(bpm));
      await page.getByRole('slider', { name: '# of Beats' }).fill('1');
      await page.getByRole('slider', { name: 'Initial Count In' }).fill('1');
      await page.getByRole('slider', { name: 'Repeat Count In' }).fill('1');
      // Beats 1, Count In 1/1: initial, loop1 (3 clicks), repeat, loop2 (6 clicks), repeat.
      await start(page).click();
      const log = await clicksUpTo(page, 1 + 3 + 1 + 6 + 1 + 3, 20_000);
      const beat = 60 / bpm;
      const boundaries: [number, number][] = [];
      for (let i = 1; i < log.length; i++) {
        if (log[i].phase !== log[i - 1].phase) boundaries.push([i - 1, i]);
      }
      // Phase changes are not click-to-click when a beat holds sub-clicks: use the last click
      // of the previous phase's final beat (its beat start) and the first click of the next.
      expect(boundaries.length).toBeGreaterThanOrEqual(5);
      for (const [a, b] of boundaries) {
        const prevBeatStart = log
          .slice(0, b)
          .reverse()
          .find((c) => c.kind !== 'sub');
        expect(prevBeatStart).toBeTruthy();
        expect(Math.abs(log[b].when - (prevBeatStart as Click).when - beat)).toBeLessThan(0.002);
        expect(a).toBeLessThan(b);
      }
    });
  }

  test('2.3: a repeat count-in shows one dot and COUNT IN n/2', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('0');
    await start(page).click();
    await expect(page.locator('.position')).toContainText('COUNT IN 1/2', { timeout: 15_000 });
    await expect(page.locator('.dots.count-in .dot')).toHaveCount(1);
    await expect(page.locator('.position')).toContainText('COUNT IN 2/2', { timeout: 5000 });
    await expect(page.locator('.dots.count-in .dot')).toHaveCount(1);
    await expect(page.locator('.position')).toContainText('BEAT 1/4 · SUB 6', { timeout: 5000 });
    await expect(page.locator('.dots:not(.count-in) .dot')).toHaveCount(4);
  });

  test('2.1b: SUB changes on beat 1 of the next loop', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('0');
    await start(page).click();
    await expect(page.locator('.position')).toContainText('BEAT 4/4 · SUB 3', { timeout: 10_000 });
    await expect(page.locator('.position')).not.toContainText('SUB 6');
    await expect(page.locator('.position')).toContainText('BEAT 1/4 · SUB 6', { timeout: 10_000 });
  });

  test('US1-5: Loop 1 = Loop 2 still alternates with the repeat count-in', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await page.getByRole('combobox', { name: 'Loop 1' }).selectOption('6');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('0');
    await page.getByRole('slider', { name: '# of Beats' }).fill('1');
    await start(page).click();
    // loop1 (6 clicks), repeat ×2, loop2 (6 clicks), repeat ×2, loop1…
    const log = await clicksUpTo(page, 6 + 2 + 6 + 2 + 6, 20_000);
    expect(log.slice(0, 22).map((c) => c.phase)).toEqual([
      ...Array<string>(6).fill('loop1'),
      ...Array<string>(2).fill('repeat'),
      ...Array<string>(6).fill('loop2'),
      ...Array<string>(2).fill('repeat'),
      ...Array<string>(6).fill('loop1')
    ]);
    expect(T).toBeGreaterThan(0);
  });
});

test.describe('metronome ratios: choose the loops and the switch (US2)', () => {
  const ratioSwitch = (page: Page) => page.getByRole('switch', { name: 'Subdivision ratio' });
  const loop1 = (page: Page) => page.getByRole('combobox', { name: 'Loop 1' });
  const loop2 = (page: Page) => page.getByRole('combobox', { name: 'Loop 2' });
  const options = (select: ReturnType<typeof loop1>) => select.locator('option').allTextContents();

  test('2.4: defaults, matching options, switch off, keyboard, controls absent while running', async ({
    page
  }) => {
    await page.goto('/metronome');
    await expect(page.getByRole('heading', { level: 3, name: 'Subdivision ratio' })).toBeVisible();
    await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(loop1(page)).toHaveValue('3');
    await expect(loop2(page)).toHaveValue('6');
    expect(await options(loop2(page))).toEqual(await options(loop1(page)));

    await ratioSwitch(page).focus();
    await page.keyboard.press('Space');
    await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(loop2(page)).toHaveCount(0);
    await expect(loop1(page)).toBeVisible();
    await expect(start(page)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(loop2(page)).toHaveValue('6');

    await start(page).click();
    await expect(ratioSwitch(page)).toHaveCount(0);
    await expect(loop1(page)).toHaveCount(0);
    await expect(loop2(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(ratioSwitch(page)).toHaveCount(0);
    await expect(loop2(page)).toHaveCount(0);
  });

  test('2.5: section off plays only initial and loop1 with SUB 3', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await ratioSwitch(page).click();
    await start(page).click();
    const log = await clicksUpTo(page, 4 + 12 + 12 + 12, 20_000);
    const phases = new Set(log.map((c) => c.phase));
    expect([...phases].sort()).toEqual(['initial', 'loop1']);
    await expect(page.locator('.position')).toContainText('SUB 3');
  });

  test('Reset leaves the settings unchanged and Start begins with initial click 1', async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await loop2(page).selectOption('4');
    await start(page).click();
    await clicksUpTo(page, 2, 10_000);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(loop2(page)).toHaveValue('4');
    await expect(ratioSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await start(page).click();
    await expect.poll(async () => (await clicks(page)).at(-1)?.phase).toBe('initial');
    const log = await clicks(page);
    const last = log.filter((c) => c.phase === 'initial' && c.slot === 0 && c.countIn === 1);
    expect(last.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('metronome ratios: count-in settings at each switch (US3)', () => {
  const countInSwitch = (page: Page) => page.getByRole('switch', { name: 'Count In' });
  const ratioSwitch = (page: Page) => page.getByRole('switch', { name: 'Subdivision ratio' });
  const slider = (page: Page, name: string) => page.getByRole('slider', { name });
  const phasesOf = (log: Click[], n: number) => log.slice(0, n).map((c) => c.phase);
  const rep = (phase: string, n: number) => Array<string>(n).fill(phase);

  test('2.6a (US3-1): Count In off → no count-in, loop1 → loop2 one beat apart', async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await countInSwitch(page).click();
    await slider(page, '# of Beats').fill('1');
    await start(page).click();
    const log = await clicksUpTo(page, 3 + 6 + 3, 20_000);
    expect(phasesOf(log, 12)).toEqual([...rep('loop1', 3), ...rep('loop2', 6), ...rep('loop1', 3)]);
    expect(log.some((c) => c.phase === 'initial' || c.phase === 'repeat')).toBe(false);
    expect(Math.abs(log[3].when - log[0].when - T)).toBeLessThan(0.002);
    expect(Math.abs(log[9].when - log[3].when - T)).toBeLessThan(0.002);
  });

  test('2.6b (US3-2): Count In on with Repeat 0 → initial plays, no repeat phase', async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await slider(page, '# of Beats').fill('1');
    await slider(page, 'Initial Count In').fill('2');
    await slider(page, 'Repeat Count In').fill('0');
    await start(page).click();
    const log = await clicksUpTo(page, 2 + 3 + 6 + 3, 20_000);
    expect(phasesOf(log, 14)).toEqual([
      ...rep('initial', 2),
      ...rep('loop1', 3),
      ...rep('loop2', 6),
      ...rep('loop1', 3)
    ]);
    expect(log.some((c) => c.phase === 'repeat')).toBe(false);
  });

  test('2.6c (US3-3): Repeat 6 → six accented repeat clicks one beat apart', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await slider(page, '# of Beats').fill('1');
    await slider(page, 'Initial Count In').fill('0');
    await slider(page, 'Repeat Count In').fill('6');
    const seen: string[] = [];
    await start(page).click();
    await expect
      .poll(
        async () => {
          const text = ((await page.locator('.position').textContent()) ?? '')
            .replace(/\s+/g, ' ')
            .trim();
          if (seen[seen.length - 1] !== text) seen.push(text);
          return (await clicks(page)).length;
        },
        { timeout: 30_000, intervals: [20] }
      )
      .toBeGreaterThanOrEqual(3 + 6 + 6 + 6);
    const log = await clicks(page);
    expect(phasesOf(log, 21)).toEqual([
      ...rep('loop1', 3),
      ...rep('repeat', 6),
      ...rep('loop2', 6),
      ...rep('repeat', 6)
    ]);
    const repeat = log.slice(3, 9);
    expect(repeat.every((c) => c.accent && c.kind === 'accent')).toBe(true);
    expect(repeat.map((c) => c.countIn)).toEqual([1, 2, 3, 4, 5, 6]);
    for (let i = 1; i < repeat.length; i++) {
      expect(Math.abs(repeat[i].when - repeat[i - 1].when - T)).toBeLessThan(0.002);
    }
    for (let n = 1; n <= 6; n++) expect(seen).toContain(`COUNT IN ${n}/6`);
  });

  test('2.6d (US3-4): section off with Count In on → no repeat count-in', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await ratioSwitch(page).click();
    await slider(page, '# of Beats').fill('1');
    await slider(page, 'Initial Count In').fill('0');
    await slider(page, 'Repeat Count In').fill('4');
    await start(page).click();
    const log = await clicksUpTo(page, 12, 20_000);
    expect(new Set(log.map((c) => c.phase))).toEqual(new Set(['loop1']));
  });

  test('2.9a: # of Beats 1 alternates the loops every beat', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await countInSwitch(page).click();
    await slider(page, '# of Beats').fill('1');
    await start(page).click();
    const log = await clicksUpTo(page, 3 + 6 + 3 + 6, 20_000);
    expect(phasesOf(log, 18)).toEqual([
      ...rep('loop1', 3),
      ...rep('loop2', 6),
      ...rep('loop1', 3),
      ...rep('loop2', 6)
    ]);
  });

  test('2.9b: 16 beats with Repeat 8 fits the status line at 320 px', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/metronome');
    await slider(page, '# of Beats').fill('16');
    await slider(page, 'Initial Count In').fill('0');
    await slider(page, 'Repeat Count In').fill('8');
    await slider(page, 'BPM').fill('300');
    await start(page).click();
    const position = page.locator('.position');
    const seen = new Set<string>();
    let fits = true;
    await expect
      .poll(
        async () => {
          const text = ((await position.textContent()) ?? '').replace(/\s+/g, ' ').trim();
          seen.add(text);
          fits &&= await position.evaluate(
            (el) =>
              el.scrollWidth <= el.clientWidth + 1 &&
              el.getBoundingClientRect().right <= document.documentElement.clientWidth &&
              document.documentElement.scrollWidth <= document.documentElement.clientWidth
          );
          return seen.has('COUNT IN 8/8') && seen.has('BEAT 16/16 · SUB 3');
        },
        { timeout: 30_000, intervals: [20] }
      )
      .toBe(true);
    expect(seen).toContain('COUNT IN 1/8');
    expect(fits).toBe(true);
  });

  test('2.9c: rapid Start/Pause/Resume/Space → no overlapping streams or doubled count-in', async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    // 'starting' ignores gestures by design, so each press waits for the previous one to land.
    const pause = page.getByRole('button', { name: 'Pause', exact: true });
    const resume = page.getByRole('button', { name: 'Resume', exact: true });
    const running = async () => {
      const n = (await clicks(page)).length;
      await expect.poll(async () => (await clicks(page)).length).toBeGreaterThan(n);
    };
    await start(page).click();
    await running();
    await pause.click();
    await resume.click();
    await running();
    await pause.click();
    await resume.click();
    await running();
    await page.keyboard.press('Space');
    await expect(resume).toBeVisible();
    await page.keyboard.press('Space');
    await expect(pause).toBeVisible();
    await clicksUpTo(page, 8, 20_000);
    await page.waitForTimeout(1500);
    const log = await clicks(page);
    const runs = new Set(log.map((c) => c.run));
    for (const run of runs) {
      const own = log.filter((c) => c.run === run && c.kind !== 'sub');
      const whens = own.map((c) => c.when);
      for (let i = 1; i < whens.length; i++) {
        expect(whens[i] - whens[i - 1]).toBeGreaterThan(T - 0.01);
      }
      expect(
        own.filter((c) => c.phase === 'initial' && c.countIn === 1).length
      ).toBeLessThanOrEqual(1);
    }
  });
});

test.describe('metronome ratios: pause and resume at the exact position (US4)', () => {
  const position = (page: Page) => page.locator('.position');
  const pause = (page: Page) => page.getByRole('button', { name: 'Pause', exact: true });
  const resume = (page: Page) => page.getByRole('button', { name: 'Resume', exact: true });
  const norm = async (page: Page) =>
    ((await position(page).textContent()) ?? '').replace(/\s+/g, ' ').trim();

  test('2.7a (US4-1/2): pause on BEAT 3/4 · SUB 6 freezes; resume plays loop2 beat 4', async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('0');
    await start(page).click();
    await expect(position(page)).toContainText('BEAT 3/4 · SUB 6', { timeout: 20_000 });
    await pause(page).click();
    await expect(resume(page)).toBeVisible();
    const frozenText = await norm(page);
    expect(frozenText).toContain('SUB 6');
    const frozenCount = (await clicks(page)).length;
    await page.waitForTimeout(1500);
    expect((await clicks(page)).length).toBe(frozenCount);
    expect(await norm(page)).toBe(frozenText);

    await resume(page).click();
    const log = await clicksUpTo(page, frozenCount + 1, 10_000);
    const next = log[frozenCount];
    expect(next).toMatchObject({ phase: 'loop2', beat: 4 });
    expect(next.kind).not.toBe('sub');
  });

  test('2.7b (US4-3): pause on COUNT IN 1/2 resumes with repeat click 2, then the loop', async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.goto('/metronome');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('0');
    await start(page).click();
    await expect(position(page)).toContainText('COUNT IN 1/2', { timeout: 15_000 });
    await pause(page).click();
    await expect(resume(page)).toBeVisible();
    expect(await norm(page)).toContain('COUNT IN 1/2');
    const frozenCount = (await clicks(page)).length;
    await page.waitForTimeout(1200);
    expect((await clicks(page)).length).toBe(frozenCount);

    await resume(page).click();
    const log = await clicksUpTo(page, frozenCount + 2, 10_000);
    const [second, afterwards] = [log[frozenCount], log[frozenCount + 1]];
    expect(second).toMatchObject({ phase: 'repeat', countIn: 2 });
    expect(afterwards.phase).toBe('loop2');
    expect(afterwards.when - second.when).toBeGreaterThan(T - 0.02);
    expect(afterwards.when - second.when).toBeLessThan(T + 0.05);
  });
});

test.describe('metronome ratios: responsive and languages (2.10)', () => {
  const noScroll = (page: Page) =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    );

  const themes = ['light', 'dark', 'more contrast', 'forced colours'] as const;
  const langs = [
    { locale: 'en-US', ratio: 'Subdivision ratio' },
    { locale: 'pt-BR', ratio: null },
    { locale: 'es-ES', ratio: null }
  ] as const;

  for (const { locale, ratio } of langs) {
    for (const theme of themes) {
      test(`2.10: ${locale}, ${theme}, 320 px and 200 % text`, async ({ browser }) => {
        test.setTimeout(60_000);
        const context = await browser.newContext({
          locale,
          viewport: { width: 320, height: 800 },
          colorScheme: theme === 'dark' ? 'dark' : 'light',
          contrast: theme === 'more contrast' ? 'more' : 'no-preference',
          forcedColors: theme === 'forced colours' ? 'active' : 'none'
        });
        const page = await context.newPage();
        try {
          await page.goto('/metronome');
          await setTextScale(page, 200);
          const sw = page.getByRole('switch').nth(1);
          const selects = page.getByRole('combobox');
          await expect(selects).toHaveCount(2);
          await expect(sw).toBeVisible();
          if (ratio) await expect(page.getByRole('switch', { name: ratio })).toBeVisible();
          await expect(page.getByRole('heading', { level: 3 }).last()).toBeVisible();
          for (const el of [sw, selects.nth(0), selects.nth(1)]) {
            await expect(el).toBeVisible();
            const box = await el.boundingBox();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(320);
          }
          expect(await noScroll(page)).toBe(true);
          await expectNoTruncationOrOverlap(page);
        } finally {
          await context.close();
        }
      });
    }
  }

  test('2.10b: COUNT IN 8/8 and BEAT 16/16 · SUB 8 fit at 320 px and 200 % text', async ({
    page
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/metronome');
    await page.getByRole('slider', { name: '# of Beats' }).fill('16');
    await page.getByRole('slider', { name: 'BPM' }).fill('300');
    await page.getByRole('slider', { name: 'Initial Count In' }).fill('8');
    await page.getByRole('slider', { name: 'Repeat Count In' }).fill('8');
    await page.getByRole('combobox', { name: 'Loop 1' }).selectOption('8');
    await setTextScale(page, 200);
    await start(page).click();
    const position = page.locator('.position');
    const seen = new Set<string>();
    let fits = true;
    await expect
      .poll(
        async () => {
          const text = ((await position.textContent()) ?? '').replace(/\s+/g, ' ').trim();
          seen.add(text);
          fits &&= await position.evaluate(
            (el) =>
              el.scrollWidth <= el.clientWidth + 1 &&
              el.getBoundingClientRect().right <= document.documentElement.clientWidth &&
              document.documentElement.scrollWidth <= document.documentElement.clientWidth
          );
          return seen.has('COUNT IN 8/8') && seen.has('BEAT 16/16 · SUB 8');
        },
        { timeout: 30_000, intervals: [20] }
      )
      .toBe(true);
    expect(fits).toBe(true);
    await expectNoTruncationOrOverlap(page);
  });
});
