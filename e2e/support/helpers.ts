import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type Request } from '@playwright/test';

export type ToolId = 'notes' | 'triads';

/** Make the next `count` renders of a tool's zones B–E throw (test builds only). */
export async function injectFault(page: Page, tool: ToolId, count: number): Promise<void> {
  await page.addInitScript(
    ([t, c]) => {
      // JSON serialisation turns Infinity into null; restore it.
      globalThis.__fmFault = { ...globalThis.__fmFault, [t as ToolId]: c ?? Infinity };
    },
    [tool, Number.isFinite(count) ? count : null] as const
  );
}

/** Records every request issued after the page's `load` event. */
export function trackRequests(page: Page): { requests: Request[]; start: () => void } {
  const requests: Request[] = [];
  let tracking = false;
  page.on('load', () => {
    tracking = true;
  });
  page.on('request', (request) => {
    if (tracking) requests.push(request);
  });
  return {
    requests,
    start: () => {
      tracking = true;
    }
  };
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** R-14: zero axe violations across WCAG 2.0/2.1/2.2 A and AA rules. */
export async function runAxe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}
