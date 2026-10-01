import { expect, test, type Page } from '@playwright/test';

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
