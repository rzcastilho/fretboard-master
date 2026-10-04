import { expect, test, type Page } from '@playwright/test';

import { readAudioLog } from './support/helpers';

// Measured in the page (pointerdown → <h1> focused), so Playwright round-trips under
// throttling (actionability checks, polling) are not counted.
async function timeClickToFocus(page: Page, click: () => Promise<void>): Promise<number> {
  await page.evaluate(() => {
    const w = globalThis as unknown as { __navMs: number | null };
    w.__navMs = null;
    let downAt = 0;
    document.addEventListener('pointerdown', (e) => (downAt = e.timeStamp), {
      capture: true,
      once: true
    });
    const onFocus = (e: FocusEvent) => {
      if ((e.target as Element).tagName !== 'H1') return;
      w.__navMs = performance.now() - downAt;
      document.removeEventListener('focusin', onFocus, true);
    };
    document.addEventListener('focusin', onFocus, true);
  });
  await click();
  await page.waitForFunction(
    () => (globalThis as unknown as { __navMs: number | null }).__navMs !== null,
    undefined,
    { timeout: 5000 }
  );
  return page.evaluate(() => (globalThis as unknown as { __navMs: number }).__navMs);
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

test.describe('navigation latency (FR-023)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('home → tool and tool → tool median ≤ 300 ms at 4× CPU throttle', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/');

    const toTool: number[] = [];
    const toolToTool: number[] = [];
    for (let i = 0; i < 5; i++) {
      await page.goto('/');
      toTool.push(
        await timeClickToFocus(page, () => page.getByRole('link', { name: /^Triads/ }).click())
      );
      toolToTool.push(
        await timeClickToFocus(page, () =>
          page
            .getByRole('navigation', { name: 'Tools' })
            .getByRole('link', { name: 'Fretboard Notes' })
            .click()
        )
      );
    }
    expect(median(toTool)).toBeLessThanOrEqual(300);
    expect(median(toolToTool)).toBeLessThanOrEqual(300);
  });
});

test.describe('tap-to-sound latency (constitution VI)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('median pointerdown → scheduled ≤ 100 ms at 4× CPU throttle', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await page.evaluate(() => {
      const w = globalThis as unknown as { __tapTimes: number[] };
      w.__tapTimes = [];
      document.addEventListener('pointerdown', (e) => w.__tapTimes.push(e.timeStamp), true);
    });

    const cell = (string: number, fret: number) =>
      page.locator(`.cell[data-string="${string}"][data-fret="${fret}"]`);
    const stepCount = async () =>
      (await readAudioLog(page)).filter((e) => e.type === 'step').length;

    // Unlocking tap: excluded from the measurement.
    await cell(6, 0).click();
    await expect.poll(stepCount).toBe(1);

    const positions: [number, number][] = [
      [5, 3],
      [4, 2],
      [3, 5],
      [2, 7],
      [1, 12],
      [6, 5]
    ];
    for (const [i, [string, fret]] of positions.entries()) {
      await cell(string, fret).click();
      await expect.poll(stepCount).toBe(i + 2);
    }

    const taps = await page.evaluate(
      () => (globalThis as unknown as { __tapTimes: number[] }).__tapTimes
    );
    const steps = (await readAudioLog(page)).filter((e) => e.type === 'step');
    expect(steps.length).toBeGreaterThanOrEqual(positions.length + 1);
    // taps[0] and steps[0] belong to the unlocking tap.
    const latencies = positions.map((_, i) => {
      const step = steps[i + 1];
      if (step?.type !== 'step') throw new Error('no step entry');
      return step.scheduledAtMs - taps[i + 1];
    });
    expect(median(latencies)).toBeLessThanOrEqual(100);
  });
});

test.describe('control-change latency (SC-001, quickstart #30)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('median select note → highlighted markers ≤ 100 ms at 4× CPU throttle', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/notes');
    const board = page.getByRole('grid', { name: 'Fretboard' });
    await board.waitFor();
    const selector = page.getByRole('group', { name: 'Choose notes' });
    // Measured in the page (pointerdown → highlighted markers in the DOM), like tap-to-sound, so
    // Playwright round-trips under throttling are not counted.
    await page.evaluate(() => {
      const w = globalThis as unknown as { __selectTimes: number[]; __downAt: number | null };
      w.__selectTimes = [];
      w.__downAt = null;
      const grid = document.querySelector('[role="grid"]');
      document.addEventListener('pointerdown', (e) => (w.__downAt = e.timeStamp), true);
      new MutationObserver(() => {
        if (w.__downAt === null || !grid?.querySelector('.marker.highlighted')) return;
        w.__selectTimes.push(performance.now() - w.__downAt);
        w.__downAt = null;
      }).observe(grid as Element, { subtree: true, childList: true, attributes: true });
    });

    const names = ['G', 'C', 'E', 'A', 'D'];
    for (const name of names) {
      const button = selector.getByRole('button', { name, exact: true });
      await button.click();
      await expect(board.locator('.marker.highlighted').first()).toBeVisible();
      await button.click(); // back to the initial view for the next sample
      await expect(board.locator('.marker.highlighted')).toHaveCount(0);
      await page.evaluate(() => ((globalThis as unknown as { __downAt: null }).__downAt = null));
    }
    const times = await page.evaluate(
      () => (globalThis as unknown as { __selectTimes: number[] }).__selectTimes
    );
    expect(times).toHaveLength(names.length);
    expect(median(times)).toBeLessThanOrEqual(100);
  });
});

test.describe('triads control-change latency (FR-031, SC-003)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('median control change → updated composition ≤ 100 ms at 4× CPU throttle', async ({
    page
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/triads');
    await expect(page.getByText('C major — Root position', { exact: true })).toBeVisible();
    // Measured in the page (pointerdown → heading text changed), so Playwright round-trips
    // under throttling are not counted.
    await page.evaluate(() => {
      const w = globalThis as unknown as {
        __ctlTimes: number[];
        __downAt: number | null;
        __last: string;
      };
      w.__ctlTimes = [];
      w.__downAt = null;
      const text = () =>
        document.body.innerText.match(/\w\S* (major|minor|diminished|augmented) — [^\n]+/)?.[0] ??
        '';
      w.__last = text();
      document.addEventListener('pointerdown', (e) => (w.__downAt = e.timeStamp), true);
      new MutationObserver(() => {
        const now = text();
        if (w.__downAt === null || now === w.__last) return;
        w.__last = now;
        w.__ctlTimes.push(performance.now() - w.__downAt);
        w.__downAt = null;
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });

    const steps: [string, string][] = [
      ['minor', 'C minor — Root position'],
      ['1st inversion', 'C minor — 1st inversion'],
      ['4-3-2', 'C minor — 1st inversion'],
      ['diminished', 'C diminished — 1st inversion'],
      ['2nd inversion', 'C diminished — 2nd inversion']
    ];
    let expected = 0;
    for (const [radio, heading] of steps) {
      await page.getByRole('radio', { name: radio, exact: true }).click();
      await expect(page.getByText(heading, { exact: true })).toBeVisible();
      if (radio !== '4-3-2') expected++; // a string-set change keeps the heading text (the live region may still update)
    }
    const times = await page.evaluate(
      () => (globalThis as unknown as { __ctlTimes: number[] }).__ctlTimes
    );
    expect(times.length).toBeGreaterThanOrEqual(expected);
    expect(median(times)).toBeLessThanOrEqual(100);
  });
});

test.describe('triads view-switch and tag-tap latency (FR-021, SC-006)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('median view switch and tag tap → updated board ≤ 100 ms at 4× CPU throttle', async ({
    page
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/triads');
    await page
      .getByRole('group', { name: 'Root' })
      .getByRole('button', { name: 'A', exact: true })
      .click();
    const board = page.getByRole('region', { name: 'Fretboard' });
    await board.waitFor();

    // Measured in the page (pointerdown → observed DOM change), so Playwright round-trips under
    // throttling are not counted. `check` runs on every mutation; the first time it is true after
    // a pointerdown, the elapsed time is recorded.
    await page.evaluate(() => {
      const w = globalThis as unknown as {
        __viewTimes: number[];
        __tagTimes: number[];
        __downAt: number | null;
        __kind: 'view' | 'tag';
        __check: () => boolean;
      };
      w.__viewTimes = [];
      w.__tagTimes = [];
      w.__downAt = null;
      w.__kind = 'view';
      w.__check = () => false;
      document.addEventListener('pointerdown', (e) => (w.__downAt = e.timeStamp), true);
      new MutationObserver(() => {
        if (w.__downAt === null || !w.__check()) return;
        (w.__kind === 'view' ? w.__viewTimes : w.__tagTimes).push(performance.now() - w.__downAt);
        w.__downAt = null;
      }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
      });
    });
    const arm = (kind: 'view' | 'tag', check: string) =>
      page.evaluate(
        ([k, c]) => {
          const w = globalThis as unknown as Record<string, unknown>;
          w.__kind = k;
          w.__check = new Function(`return (${c})`)();
          w.__downAt = null;
        },
        [kind, check] as const
      );
    const tagCount = `() => document.querySelectorAll('.tags button').length === 6`;
    const noTags = `() => document.querySelectorAll('.tags button').length === 0`;
    const pressedTag = (i: number) =>
      `() => document.querySelectorAll('.tags button')[${i}]?.getAttribute('aria-pressed') === 'true'`;

    const samples = 5;
    for (let i = 0; i < samples; i++) {
      // Isolated → Full neck.
      await arm('view', tagCount);
      await page.getByRole('radio', { name: 'Full neck' }).click();
      await expect(page.locator('.tags button')).toHaveCount(6);

      // Tag tap: select the 2nd-inversion tag (index 2), then the 1st (index 1) next round.
      const target = i % 2 === 0 ? 2 : 1;
      await arm('tag', pressedTag(target));
      await page.locator('.tags button').nth(target).click();
      await expect(page.locator('.tags button').nth(target)).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      // Full neck → All notes → Isolated, timing the All notes switch.
      await arm('view', noTags);
      await page.getByRole('radio', { name: 'All notes' }).click();
      await expect(page.locator('.tags button')).toHaveCount(0);
      await page.getByRole('radio', { name: 'Isolated' }).click();
      await page.evaluate(() => ((globalThis as unknown as { __downAt: null }).__downAt = null));
    }

    const { viewTimes, tagTimes } = await page.evaluate(() => {
      const w = globalThis as unknown as { __viewTimes: number[]; __tagTimes: number[] };
      return { viewTimes: w.__viewTimes, tagTimes: w.__tagTimes };
    });
    expect(viewTimes.length).toBeGreaterThanOrEqual(samples);
    expect(tagTimes.length).toBeGreaterThanOrEqual(samples);
    expect(median(viewTimes)).toBeLessThanOrEqual(100);
    expect(median(tagTimes)).toBeLessThanOrEqual(100);
  });
});

test.describe('triads Compare latency (FR-021, SC-007)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('median Compare on and comparison-quality change → updated board ≤ 100 ms at 4× CPU throttle', async ({
    page
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/triads');
    const board = page.getByRole('region', { name: 'Fretboard' });
    await expect(board.locator('.marker')).toHaveCount(3);
    const toggle = page.getByRole('button', { name: 'Compare', exact: true });
    const list = page.getByRole('radiogroup', { name: 'Compare with' });

    // Measured in the page (pointerdown → observed DOM change), so Playwright round-trips under
    // throttling are not counted.
    await page.evaluate(() => {
      const w = globalThis as unknown as {
        __onTimes: number[];
        __qualityTimes: number[];
        __downAt: number | null;
        __kind: 'on' | 'quality';
        __check: () => boolean;
      };
      w.__onTimes = [];
      w.__qualityTimes = [];
      w.__downAt = null;
      w.__kind = 'on';
      w.__check = () => false;
      document.addEventListener('pointerdown', (e) => (w.__downAt = e.timeStamp), true);
      new MutationObserver(() => {
        if (w.__downAt === null || !w.__check()) return;
        (w.__kind === 'on' ? w.__onTimes : w.__qualityTimes).push(performance.now() - w.__downAt);
        w.__downAt = null;
      }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true
      });
    });
    const arm = (kind: 'on' | 'quality', check: string) =>
      page.evaluate(
        ([k, c]) => {
          const w = globalThis as unknown as Record<string, unknown>;
          w.__kind = k;
          w.__check = new Function(`return (${c})`)();
          w.__downAt = null;
        },
        [kind, check] as const
      );
    const hasComparison = `() => document.querySelectorAll('.marker.comparison').length === 1`;
    // Compare off fades the comparison marker out (F5). Svelte flags an outroing node with the
    // `inert` property (not an attribute on SVG), so the board has updated once every comparison
    // marker left is outroing, not when the fade ends.
    const noComparison = `() => [...document.querySelectorAll('.marker.comparison')].every((n) => n.inert)`;
    const comparisonFifth = `() => document.querySelector('.marker.comparison.fifth') !== null`;
    const comparisonThird = `() => document.querySelector('.marker.comparison.third') !== null`;

    const samples = 5;
    for (let i = 0; i < samples; i++) {
      // Compare on (major vs minor: the third moves).
      await arm('on', hasComparison);
      await toggle.click();
      await expect(board.locator('.marker.comparison')).toHaveCount(1);

      // Comparison-quality change: diminished moves the fifth, then back to minor (the third).
      await arm('quality', comparisonFifth);
      await list.getByRole('radio', { name: 'diminished' }).click();
      await expect(board.locator('.marker.comparison.fifth')).toHaveCount(1);
      await arm('quality', comparisonThird);
      await list.getByRole('radio', { name: 'minor' }).click();
      await expect(board.locator('.marker.comparison.third')).toHaveCount(1);

      // Compare off, back to the initial view for the next sample.
      await arm('on', noComparison);
      await toggle.click();
      await expect(board.locator('.marker.comparison')).toHaveCount(0);
      await page.evaluate(() => ((globalThis as unknown as { __downAt: null }).__downAt = null));
    }

    const { onTimes, qualityTimes } = await page.evaluate(() => {
      const w = globalThis as unknown as { __onTimes: number[]; __qualityTimes: number[] };
      return { onTimes: w.__onTimes, qualityTimes: w.__qualityTimes };
    });
    expect(onTimes.length).toBeGreaterThanOrEqual(samples);
    expect(qualityTimes.length).toBeGreaterThanOrEqual(samples * 2);
    expect(median(onTimes)).toBeLessThanOrEqual(100);
    expect(median(qualityTimes)).toBeLessThanOrEqual(100);
  });
});

test.describe('linked-tools carry latency (SC-005, FR-017)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('nav click Notes → Triads with a carry shows the carried root ≤ 300 ms', async ({
    page
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const times: number[] = [];
    for (const [pitch, heading] of [
      ['A', 'A major — Root position'],
      ['D', 'D major — Root position'],
      ['E', 'E major — Root position'],
      ['G', 'G major — Root position'],
      ['B', 'B major — Root position']
    ] as const) {
      await page.goto('/notes');
      await page
        .getByRole('group', { name: 'Choose notes' })
        .getByRole('button', { name: pitch, exact: true })
        .click();
      // Measured in the page: pointerdown → carried heading text in the DOM.
      await page.evaluate((expected) => {
        const w = globalThis as unknown as { __carryMs: number | null };
        w.__carryMs = null;
        let downAt = 0;
        document.addEventListener('pointerdown', (e) => (downAt = e.timeStamp), {
          capture: true,
          once: true
        });
        const check = () => {
          if (w.__carryMs === null && document.body.innerText.includes(expected)) {
            w.__carryMs = performance.now() - downAt;
            observer.disconnect();
          }
        };
        const observer = new MutationObserver(check);
        observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      }, heading);
      await page
        .getByRole('navigation', { name: 'Tools' })
        .getByRole('link', { name: 'Triads' })
        .click();
      await page.waitForFunction(
        () => (globalThis as unknown as { __carryMs: number | null }).__carryMs !== null
      );
      times.push(
        await page.evaluate(() => (globalThis as unknown as { __carryMs: number }).__carryMs)
      );
    }
    expect(median(times)).toBeLessThanOrEqual(300);
  });
});

test.describe('instrument change latency (SC-001)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('median Confirm → fretboard with the new open-string label ≤ 300 ms at 4× CPU throttle', async ({
    page
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();

    // Measured in the page (pointerdown on Confirm → string 6 label changed), so Playwright
    // round-trips under throttling are not counted.
    await page.evaluate(() => {
      const w = globalThis as unknown as {
        __instrTimes: number[];
        __downAt: number | null;
        __expect: RegExp | null;
      };
      w.__instrTimes = [];
      w.__downAt = null;
      w.__expect = null;
      document.addEventListener('pointerdown', (e) => (w.__downAt = e.timeStamp), true);
      new MutationObserver(() => {
        if (w.__downAt === null || w.__expect === null) return;
        const labels = [...document.querySelectorAll('[role="grid"] .string-label')];
        if (!labels.some((n) => w.__expect?.test(n.textContent?.trim() ?? ''))) return;
        w.__instrTimes.push(performance.now() - w.__downAt);
        w.__downAt = null;
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    const arm = (source: string) =>
      page.evaluate((s) => {
        const w = globalThis as unknown as { __expect: RegExp; __downAt: number | null };
        w.__expect = new RegExp(s);
        w.__downAt = null;
      }, source);

    const opener = page.getByRole('button', { name: 'Instrument', exact: true });
    const radio = (name: string) => page.getByRole('radio', { name: new RegExp(`^${name}:`) });
    const samples = 5;
    for (let i = 0; i < samples; i++) {
      for (const [preset, label] of [
        ['Drop D', /^6\s*D$/],
        ['Standard', /^6\s*E$/]
      ] as const) {
        await opener.click();
        const dialog = page.getByRole('dialog', { name: 'Instrument' });
        await radio(preset).check();
        await arm(label.source);
        await dialog.getByRole('button', { name: 'Confirm' }).click();
        await expect(dialog).toBeHidden();
        await expect(
          page.locator('[role="grid"] .string-label').filter({ hasText: label })
        ).toHaveCount(1);
      }
    }
    const times = await page.evaluate(
      () => (globalThis as unknown as { __instrTimes: number[] }).__instrTimes
    );
    expect(times.length).toBeGreaterThanOrEqual(samples * 2);
    expect(median(times)).toBeLessThanOrEqual(300);
  });
});

test.describe('remembered preferences (SC-006, SC-008)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  const record = JSON.stringify({
    version: 1,
    tuning: 'DROP-D',
    frets: 15,
    muted: true,
    volume: 0.5,
    lastTool: 'triads',
    labels: { notes: 'interval', triads: 'name' }
  });

  test('seeded record: home usable ≤ 3 s, no AudioContext at startup, control change ≤ 100 ms', async ({
    page
  }) => {
    await page.addInitScript((r) => {
      localStorage.setItem('fretboard-master:prefs', r);
      const w = globalThis as unknown as { __ctxCount: number; AudioContext: typeof AudioContext };
      w.__ctxCount = 0;
      const Native = w.AudioContext;
      if (Native) {
        w.AudioContext = class extends Native {
          constructor(...args: ConstructorParameters<typeof AudioContext>) {
            super(...args);
            w.__ctxCount++;
          }
        };
      }
    }, record);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const start = Date.now();
    await page.goto('/');
    await page.getByRole('link', { name: /^Continue: / }).waitFor();
    expect(Date.now() - start).toBeLessThanOrEqual(3000);
    expect(
      await page.evaluate(() => (globalThis as unknown as { __ctxCount: number }).__ctxCount)
    ).toBe(0);

    // Control change (instrument Confirm) with a remembered record, measured in the page.
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await page.evaluate(() => {
      const w = globalThis as unknown as { __prefMs: number[]; __prefDown: number | null };
      w.__prefMs = [];
      w.__prefDown = null;
      document.addEventListener('pointerdown', (e) => (w.__prefDown = e.timeStamp), true);
      new MutationObserver(() => {
        if (w.__prefDown === null) return;
        w.__prefMs.push(performance.now() - w.__prefDown);
        w.__prefDown = null;
      }).observe(document.querySelector('[role="grid"]') as Element, {
        subtree: true,
        childList: true,
        characterData: true
      });
    });
    const opener = page.getByRole('button', { name: 'Instrument', exact: true });
    for (const preset of ['Standard', 'Drop D', 'Standard']) {
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Instrument' });
      await dialog.getByRole('radio', { name: new RegExp(`^${preset}:`) }).check();
      await dialog.getByRole('button', { name: 'Confirm' }).click();
      await expect(dialog).toBeHidden();
    }
    const times = await page.evaluate(
      () => (globalThis as unknown as { __prefMs: number[] }).__prefMs
    );
    expect(times.length).toBeGreaterThan(0);
    expect(median(times)).toBeLessThanOrEqual(100);
  });
});

test.describe('custom tuning latency (011 SC-007)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('string step → preview ≤ 100 ms, Confirm → applied instrument ≤ 300 ms at 4× CPU throttle', async ({
    page
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await page
      .getByRole('button', { name: /^6 strings|^Instrument/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await dialog.getByRole('radio', { name: /^Custom/ }).check();

    // Time from pointerdown until `ready()` first holds, measured in the page so Playwright
    // round-trips under throttling are not counted.
    const timeUntil = async (click: () => Promise<void>, ready: string): Promise<number> => {
      await page.evaluate((src) => {
        const w = globalThis as unknown as { __ms: number | null };
        w.__ms = null;
        const check = new Function(`return (${src})()`) as () => boolean;
        let downAt = 0;
        document.addEventListener('pointerdown', (e) => (downAt = e.timeStamp), {
          capture: true,
          once: true
        });
        const observer = new MutationObserver(() => {
          if (downAt === 0 || w.__ms !== null || !check()) return;
          w.__ms = performance.now() - downAt;
          observer.disconnect();
        });
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true
        });
      }, ready);
      await click();
      await page.waitForFunction(
        () => (globalThis as unknown as { __ms: number | null }).__ms !== null,
        undefined,
        { timeout: 5000 }
      );
      return page.evaluate(() => (globalThis as unknown as { __ms: number }).__ms);
    };

    const control: number[] = [];
    for (const label of ['D♯', 'D', 'C♯']) {
      control.push(
        await timeUntil(
          () => dialog.getByRole('button', { name: 'Lower string 6' }).click(),
          `() => {
            const labels = document.querySelectorAll('.fretboard-preview .string-label');
            return labels[labels.length - 1]?.textContent?.trim() === ${JSON.stringify(label)};
          }`
        )
      );
    }
    expect(median(control)).toBeLessThanOrEqual(100);

    const applied = await timeUntil(
      () => dialog.getByRole('button', { name: 'Confirm' }).click(),
      `() => document.querySelector('[aria-label^="Tuning:"]') !== null && !document.querySelector('dialog[open]')`
    );
    expect(applied).toBeLessThanOrEqual(300);
  });
});

test.describe('seven strings × 24 frets (US5, quickstart §4)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  test('Confirm → board ≤ 300 ms, control change ≤ 100 ms at 4× CPU throttle', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, tuning: 'AF-1', frets: 24 })
      );
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/notes');
    const board = page.getByRole('grid', { name: 'Fretboard' });
    await board.waitFor();
    await expect(board.getByRole('row')).toHaveCount(6);

    await page
      .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    // Measured in the page: Confirm pointerdown → seven rows in the DOM.
    await page.evaluate(() => {
      const w = globalThis as unknown as { __boardMs: number | null };
      w.__boardMs = null;
      let downAt = 0;
      document.addEventListener('pointerdown', (e) => (downAt = e.timeStamp), {
        capture: true,
        once: true
      });
      new MutationObserver((_, obs) => {
        if (document.querySelectorAll('[role="grid"] [role="row"]').length !== 7) return;
        w.__boardMs = performance.now() - downAt;
        obs.disconnect();
      }).observe(document.body, { subtree: true, childList: true });
    });
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForFunction(
      () => (globalThis as unknown as { __boardMs: number | null }).__boardMs !== null
    );
    const boardMs = await page.evaluate(
      () => (globalThis as unknown as { __boardMs: number }).__boardMs
    );
    expect(boardMs).toBeLessThanOrEqual(300);

    await expect(board.getByRole('row')).toHaveCount(7);
    await expect(board.locator('.cell')).toHaveCount(7 * 25);

    // Control change on the seven-string board.
    await page.evaluate(() => {
      const w = globalThis as unknown as { __selectMs: number | null; __downAt: number | null };
      w.__selectMs = null;
      w.__downAt = null;
      const grid = document.querySelector('[role="grid"]');
      document.addEventListener('pointerdown', (e) => (w.__downAt = e.timeStamp), true);
      new MutationObserver(() => {
        if (w.__downAt === null || !grid?.querySelector('.marker.highlighted')) return;
        w.__selectMs = performance.now() - w.__downAt;
        w.__downAt = null;
      }).observe(grid as Element, { subtree: true, childList: true, attributes: true });
    });
    await page
      .getByRole('group', { name: 'Choose notes' })
      .getByRole('button', { name: 'G', exact: true })
      .click();
    await page.waitForFunction(
      () => (globalThis as unknown as { __selectMs: number | null }).__selectMs !== null
    );
    const selectMs = await page.evaluate(
      () => (globalThis as unknown as { __selectMs: number }).__selectMs
    );
    expect(selectMs).toBeLessThanOrEqual(100);

    // Scroll/drag smoothness: scrolling the board across 24 frets stays inside .scroller.
    const scroller = page.locator('.scroller').first();
    const scrolled = await scroller.evaluate(async (el) => {
      const frames: number[] = [];
      let last = performance.now();
      el.scrollLeft = 0;
      for (let i = 1; i <= 20; i++) {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) * (i / 20);
        await new Promise((r) => requestAnimationFrame(r));
        const now = performance.now();
        frames.push(now - last);
        last = now;
      }
      return { worst: Math.max(...frames), moved: el.scrollLeft };
    });
    expect(scrolled.moved).toBeGreaterThan(0);
    expect(scrolled.worst).toBeLessThanOrEqual(100);
  });
});

test.describe('handedness and orientation (013 SC-006)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  const openPanel = async (page: Page) => {
    await page
      .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  /** Confirm pointerdown → first cell geometry showing `ready` appears, in the page. */
  const timeConfirm = async (page: Page, ready: 'mirrored' | 'lowest-top'): Promise<number> => {
    // No `new Function`/eval here: the app's CSP has no 'unsafe-eval'.
    await page.evaluate((kind) => {
      const w = globalThis as unknown as { __hMs: number | null };
      w.__hMs = null;
      let downAt = 0;
      document.addEventListener('pointerdown', (e) => (downAt = e.timeStamp), {
        capture: true,
        once: true
      });
      const isReady = () => {
        if (kind === 'mirrored') {
          const s = document.querySelector('.cell[data-string="1"][data-fret="0"]');
          const t = document.querySelector('.cell[data-string="1"][data-fret="1"]');
          return !!s && !!t && s.getBoundingClientRect().left > t.getBoundingClientRect().left;
        }
        const first = document.querySelector('[role="grid"] [role="row"] .cell');
        return first?.getAttribute('data-string') === '6';
      };
      const check = () => {
        if (w.__hMs !== null || !isReady()) return;
        w.__hMs = performance.now() - downAt;
        observer.disconnect(); // a later timeConfirm must not see this one's result
      };
      const observer = new MutationObserver(check);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true
      });
    }, ready);
    await page.getByRole('button', { name: 'Confirm' }).click();
    await page.waitForFunction(
      () => (globalThis as unknown as { __hMs: number | null }).__hMs !== null
    );
    return page.evaluate(() => (globalThis as unknown as { __hMs: number }).__hMs);
  };

  test('switching handedness or orientation updates the board ≤ 100 ms at 4× throttle', async ({
    page
  }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/notes');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();

    let dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: 'Left-handed' }).check();
    const handMs = await timeConfirm(page, 'mirrored');
    expect(handMs).toBeLessThanOrEqual(100);

    dialog = await openPanel(page);
    await dialog.getByRole('radio', { name: 'Lowest string on top' }).check();
    const topMs = await timeConfirm(page, 'lowest-top');
    expect(topMs).toBeLessThanOrEqual(100);
  });

  test('left-handed 7 strings × 24 frets scrolls smoothly inside .scroller', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, strings: 7, tuning: 'AF-21', frets: 24, handedness: 'left' })
      );
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/notes');
    const board = page.getByRole('grid', { name: 'Fretboard' });
    await board.waitFor();
    await expect(board.getByRole('row')).toHaveCount(7);
    const scrolled = await page
      .locator('.scroller')
      .first()
      .evaluate(async (el) => {
        const frames: number[] = [];
        let last = performance.now();
        const max = el.scrollWidth - el.clientWidth;
        el.scrollLeft = max;
        for (let i = 1; i <= 20; i++) {
          el.scrollLeft = max * (1 - i / 20);
          await new Promise((r) => requestAnimationFrame(r));
          const now = performance.now();
          frames.push(now - last);
          last = now;
        }
        return { worst: Math.max(...frames), start: max, end: el.scrollLeft };
      });
    expect(scrolled.start).toBeGreaterThan(0);
    expect(scrolled.end).toBe(0);
    expect(scrolled.worst).toBeLessThanOrEqual(100);
  });
});

test.describe('CAGED latency (014 Q27, SC-004)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP throttling is Chromium-only');

  /** Pointerdown → `text` present in the page body, measured in the page. */
  const armTimer = (page: Page, text: string) =>
    page.evaluate((t) => {
      const w = globalThis as unknown as { __cagedMs: number | null };
      w.__cagedMs = null;
      let downAt = 0;
      document.addEventListener('pointerdown', (e) => (downAt = e.timeStamp), {
        capture: true,
        once: true
      });
      new MutationObserver((_, obs) => {
        if (!document.body.textContent?.includes(t)) return;
        w.__cagedMs = performance.now() - downAt;
        obs.disconnect();
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    }, text);
  const readTimer = async (page: Page) => {
    await page.waitForFunction(
      () => (globalThis as unknown as { __cagedMs: number | null }).__cagedMs !== null
    );
    return page.evaluate(() => (globalThis as unknown as { __cagedMs: number }).__cagedMs);
  };

  test('median open CAGED ≤ 300 ms at 4× CPU throttle', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const times: number[] = [];
    // Like FR-023, a median of five: the first open also fetches the tool's chunk.
    for (let i = 0; i < 5; i++) {
      await page.goto('/');
      const card = page.getByRole('list').getByRole('link', { name: /CAGED/ });
      await card.waitFor();
      await armTimer(page, 'C major');
      await card.click();
      times.push(await readTimer(page));
      await expect(page.getByRole('region', { name: 'Fretboard' })).toBeVisible();
    }
    expect(median(times)).toBeLessThanOrEqual(300);
  });

  test('median CAGED key change ≤ 100 ms at 4× CPU throttle', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/caged');
    await expect(page.getByText('C major', { exact: true })).toBeVisible();
    const keys = page.getByRole('group', { name: 'Key' }).getByRole('button');
    const times: number[] = [];
    for (const [pc, heading] of [
      [7, 'G major'],
      [2, 'D major'],
      [9, 'A major'],
      [4, 'E major'],
      [5, 'F major']
    ] as const) {
      await armTimer(page, heading);
      await keys.nth(pc).click();
      times.push(await readTimer(page));
    }
    expect(median(times)).toBeLessThanOrEqual(100);
  });

  test('7 strings × 24 frets with nine tags: scrolling stays inside .scroller', async ({
    page
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fretboard-master:prefs',
        JSON.stringify({ version: 1, tuning: 'AF-1', frets: 24 })
      );
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/caged');
    await page
      .getByRole('button', { name: /strings · |^Tuning:|^Instrument/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: 'Instrument' });
    await dialog.getByRole('radio', { name: '7 strings' }).check();
    await page.getByRole('button', { name: 'Confirm' }).click();
    const board = page.getByRole('region', { name: 'Fretboard' });
    await expect(board.locator('.cell')).toHaveCount(7 * 25);
    await expect(board.locator('.tag.static:visible')).toHaveCount(9);

    const scroller = page.locator('.scroller').first();
    const scrolled = await scroller.evaluate(async (el) => {
      const frames: number[] = [];
      let last = performance.now();
      el.scrollLeft = 0;
      for (let i = 1; i <= 20; i++) {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) * (i / 20);
        await new Promise((r) => requestAnimationFrame(r));
        const now = performance.now();
        frames.push(now - last);
        last = now;
      }
      return { worst: Math.max(...frames), moved: el.scrollLeft };
    });
    expect(scrolled.moved).toBeGreaterThan(0);
    expect(scrolled.worst).toBeLessThanOrEqual(100);
  });
});
