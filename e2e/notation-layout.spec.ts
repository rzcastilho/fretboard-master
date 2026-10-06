import { expect, test } from '@playwright/test';

import { expectNoTruncationOrOverlap, setTextScale } from './support/helpers';

const PREFS_KEY = 'fretboard-master:prefs';

const LANGUAGES = [
  { tag: 'pt-BR', locale: 'pt-BR' },
  { tag: 'es', locale: 'es-ES' }
] as const;
const POLICIES = ['flats', 'both'] as const;
const TOOLS = [
  { name: 'Notes', path: '/notes' },
  { name: 'Triads', path: '/triads' },
  { name: 'CAGED', path: '/caged' }
] as const;

test.use({ viewport: { width: 320, height: 640 } });

for (const { tag, locale } of LANGUAGES) {
  for (const accidentals of POLICIES) {
    test.describe(`solfège ${tag} / ${accidentals}`, () => {
      test.use({ locale });
      for (const tool of TOOLS) {
        test(`${tool.name} at 200% text: no truncation or overlap (US4-5, SC-007)`, async ({
          page
        }) => {
          await page.addInitScript(
            ([key, value]) => localStorage.setItem(key as string, value as string),
            [
              PREFS_KEY,
              JSON.stringify({
                version: 1,
                tuning: 'AF-1',
                frets: 22,
                language: tag,
                notation: 'solfege',
                accidentals
              })
            ]
          );
          await page.goto(tool.path);
          await expect(page.locator('html')).toHaveAttribute('lang', tag);
          await page.waitForLoadState('networkidle');
          await setTextScale(page, 200);
          await expectNoTruncationOrOverlap(page);
          const pageScrolls = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
          );
          expect(pageScrolls).toBe(false);
        });
      }
    });
  }
}
