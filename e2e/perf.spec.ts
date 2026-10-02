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
