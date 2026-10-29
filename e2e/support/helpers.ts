import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type Request } from '@playwright/test';

import type { AudioLogEntry } from '../../src/lib/audio/types';

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

/** Test-build audio log (`__fmAudioLog`, data-model §8). Empty before any entry is written. */
export async function readAudioLog(page: Page): Promise<AudioLogEntry[]> {
  return page.evaluate(() => globalThis.__fmAudioLog ?? []);
}

/** Make the audio engine fail at `cause` on its first unlock (test builds only). */
export async function injectAudioFault(page: Page, cause: 'context' | 'synth'): Promise<void> {
  await page.addInitScript((c) => {
    globalThis.__fmAudioFault = c;
  }, cause);
}

/** R-11: emulate a root text-size setting (tokens are rem-based). */
export async function setTextScale(page: Page, pct: number): Promise<void> {
  await page.evaluate((p) => {
    document.documentElement.style.fontSize = `${p}%`;
  }, pct);
}

/**
 * R-11 / SC-004: no clipped or ellipsised text, no overlapping interactive controls, no page-level
 * horizontal scroll. The fretboard scroller is the only intentional scroll container and is skipped.
 */
export async function expectNoTruncationOrOverlap(page: Page): Promise<void> {
  const problems = await page.evaluate(() => {
    const found: string[] = [];
    const describe = (el: Element): string => {
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `<${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}> "${text}"`;
    };
    const visible = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false; // visually hidden helpers
      const style = getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none';
    };
    // An open modal dialog covers the page behind it: only the dialog is on screen to the user.
    const dialog = Array.from(document.querySelectorAll('dialog[open], [role="dialog"]')).find(
      (el) => visible(el)
    );
    const inScroller = (el: Element): boolean =>
      el.closest('.scroller') !== null || (dialog !== undefined && !dialog.contains(el));

    for (const el of document.body.querySelectorAll('*')) {
      if (!visible(el) || inScroller(el)) continue;
      const hasOwnText = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''
      );
      if (!hasOwnText) continue;
      const style = getComputedStyle(el);
      if (style.textOverflow === 'ellipsis') found.push(`ellipsis: ${describe(el)}`);
      const clipsX = style.overflowX !== 'visible';
      const clipsY = style.overflowY !== 'visible';
      if (clipsX && el.scrollWidth > el.clientWidth + 1) found.push(`clipped-x: ${describe(el)}`);
      if (clipsY && el.scrollHeight > el.clientHeight + 1) found.push(`clipped-y: ${describe(el)}`);
    }

    // Containers that scroll or clip must not hide translated text (non-text-owning wrappers too).
    for (const el of document.body.querySelectorAll('[role="radiogroup"], nav, header, section')) {
      if (!visible(el) || inScroller(el)) continue;
      const style = getComputedStyle(el);
      if (style.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) {
        found.push(`scrolls-x: ${describe(el)}`);
      }
    }

    const controls = Array.from(
      document.querySelectorAll('a[href], button, input, select, textarea, [role="radio"]')
    ).filter((el) => visible(el) && !inScroller(el));
    const boxes = controls.map((el) => el.getBoundingClientRect());
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
        const a = boxes[i];
        const b = boxes[j];
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) {
          found.push(`overlap: ${describe(controls[i])} ∩ ${describe(controls[j])}`);
        }
      }
    }

    const pageOverflow = document.documentElement.scrollWidth - window.innerWidth;
    if (pageOverflow > 0) found.push(`page-x-overflow: ${pageOverflow}px`);
    return found;
  });
  expect(problems).toEqual([]);
}

/**
 * Reflow screens collapse zone D behind a "Show details" button (025). Open it when present, so
 * a test can read zone D at any width; a no-op where D is always visible or on other screens.
 */
export async function expandDetails(page: Page): Promise<void> {
  const arranged = await page
    .locator('main .grid[data-arrangement]')
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!arranged) return;
  const show = page.getByRole('button', { name: 'Show details' });
  if ((await show.count()) > 0) await show.click();
}
