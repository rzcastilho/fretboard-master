import { expect, test, type Page } from '@playwright/test';

import { readAudioLog } from './support/helpers';

async function timeClickToFocus(page: Page, click: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await click();
  await page.waitForFunction(
    () => document.activeElement === document.querySelector('h1'),
    undefined,
    { timeout: 5000 }
  );
  return Date.now() - start;
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
