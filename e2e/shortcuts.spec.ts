import { expect, test, type Page } from '@playwright/test';

import { expandDetails, readAudioLog } from './support/helpers';

/** Feature 027 US2: single-key shortcuts mirror the on-screen controls. */

const radio = (page: Page, group: string, name: string) =>
  page.getByRole('radiogroup', { name: group }).getByRole('radio', { name, exact: true });
const checkedIn = (page: Page, group: string) =>
  page.getByRole('radiogroup', { name: group }).locator('[role="radio"][aria-checked="true"]');
const listen = (page: Page) => page.getByRole('button', { name: 'Listen', exact: true });
const notationGroup = (page: Page) => page.getByRole('group', { name: 'Note names' });

async function stepCount(page: Page): Promise<number> {
  return (await readAudioLog(page)).filter((e) => e.type === 'step').length;
}

async function erase(page: Page) {
  await page.goto('/about');
  await page.getByRole('button', { name: 'Erase my preferences' }).click();
  await page.getByRole('button', { name: 'Erase', exact: true }).click();
  await expect(page).toHaveURL('/');
}

/** A text field to type into (the app has no free-text field outside the share fallback). */
async function focusTextField(page: Page) {
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'shortcut-probe';
    document.body.append(input);
    input.focus();
  });
  await expect(page.locator('#shortcut-probe')).toBeFocused();
}

test.describe('keyboard shortcuts (US2)', () => {
  test('US2-1: P starts Listen in Triads, Notes and CAGED', async ({ page }) => {
    await page.goto('/triads');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    expect(await stepCount(page)).toBe(0);
    await page.keyboard.press('p');
    await expect.poll(() => stepCount(page)).toBeGreaterThan(0);

    await page.goto('/caged');
    await expandDetails(page);
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    expect(await stepCount(page)).toBe(0);
    await page.keyboard.press('P');
    await expect.poll(() => stepCount(page)).toBeGreaterThan(0);

    await page.goto('/notes');
    await expandDetails(page);
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    // Same enabled state as the button: only fires when the control would.
    const enabled = (await listen(page).getAttribute('aria-disabled')) !== 'true';
    await page.keyboard.press('p');
    if (enabled) await expect.poll(() => stepCount(page)).toBeGreaterThan(0);
    else expect(await stepCount(page)).toBe(0);
  });

  test('US2-2: . and , move the triad inversion with wrap', async ({ page }) => {
    await page.goto('/triads');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(checkedIn(page, 'Inversion')).toHaveText('Root position');
    for (const next of ['1st inversion', '2nd inversion', 'Root position']) {
      await page.keyboard.press('.');
      await expect(checkedIn(page, 'Inversion')).toHaveText(next);
    }
    for (const prev of ['2nd inversion', '1st inversion', 'Root position']) {
      await page.keyboard.press(',');
      await expect(checkedIn(page, 'Inversion')).toHaveText(prev);
    }
  });

  test('US2-3: . and , step CAGED shapes and stop at the ends', async ({ page }) => {
    await page.goto('/caged');
    await expandDetails(page);
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    // Stepping needs a focused shape.
    const shapeTag = page
      .getByRole('region', { name: 'Fretboard' })
      .getByRole('button', { name: /^E shape · roots on strings 6, 4, 1$/ })
      .first();
    await shapeTag.click();
    await expect(shapeTag).toHaveAttribute('aria-pressed', 'true');
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const prev = page.getByRole('button', { name: 'Previous shape' });
    const next = page.getByRole('button', { name: 'Next shape' });
    // Walk to the start, then to the end; no wrap at either end.
    for (let i = 0; i < 8 && (await prev.getAttribute('aria-disabled')) !== 'true'; i++) {
      await page.keyboard.press(',');
    }
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press(',');
    await expect(prev).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('.');
    await expect(prev).not.toHaveAttribute('aria-disabled', 'true');
    for (let i = 0; i < 8 && (await next.getAttribute('aria-disabled')) !== 'true'; i++) {
      await page.keyboard.press('.');
    }
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('.');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(prev).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('US2-4/9: L cycles Notes labels, N toggles notation everywhere, both persist', async ({
    page
  }) => {
    await page.goto('/notes');
    await expandDetails(page);
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(checkedIn(page, 'Label')).toHaveText('Name');
    for (const label of ['Octave', 'No label', 'Name']) {
      await page.keyboard.press('l');
      await expect(checkedIn(page, 'Label')).toHaveText(label);
    }
    await page.keyboard.press('l');
    await expect(checkedIn(page, 'Label')).toHaveText('Octave');

    await expect(notationGroup(page).getByRole('button', { name: 'C D E' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.keyboard.press('n');
    await expect(notationGroup(page).getByRole('button', { name: 'Do Re Mi' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.reload();
    await expect(notationGroup(page).getByRole('button', { name: 'Do Re Mi' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // N also works on Home (no toggle there: check on About) and on About itself.
    await page.goto('/');
    await page.keyboard.press('n');
    await page.getByRole('banner').getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await page.getByRole('button', { name: 'Language and appearance', exact: true }).click();
    const solfege = page.getByRole('radio', { name: 'Solfège' });
    await expect(solfege).not.toBeChecked();
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press('n');
    await expect(solfege).toBeChecked();
  });

  test('US2-5: nothing fires in a text field or with Ctrl/Alt/Meta', async ({ page }) => {
    await page.goto('/triads');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await focusTextField(page);
    for (const key of ['p', '.', ',', 'l', 'n']) await page.keyboard.press(key);
    await expect(checkedIn(page, 'Inversion')).toHaveText('Root position');
    await expect(notationGroup(page).getByRole('button', { name: 'C D E' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(await stepCount(page)).toBe(0);

    await page.locator('#shortcut-probe').blur();
    for (const mod of ['Control', 'Alt', 'Meta']) {
      for (const key of ['p', '.', ',', 'l', 'n']) await page.keyboard.press(`${mod}+${key}`);
    }
    await expect(checkedIn(page, 'Inversion')).toHaveText('Root position');
    await expect(notationGroup(page).getByRole('button', { name: 'C D E' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(await stepCount(page)).toBe(0);
  });

  test('US2-7: switch off disables every shortcut, persists, Erase turns it on', async ({
    page
  }) => {
    await page.goto('/about');
    const sw = page.getByRole('switch', { name: 'Keyboard shortcuts' });
    await expect(sw).toBeChecked();
    await sw.click();
    await expect(sw).not.toBeChecked();

    await page.goto('/triads');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(page.locator('[aria-keyshortcuts]')).toHaveCount(0);
    for (const key of ['p', '.', ',', 'l', 'n']) await page.keyboard.press(key);
    await expect(checkedIn(page, 'Inversion')).toHaveText('Root position');
    await expect(notationGroup(page).getByRole('button', { name: 'C D E' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(await stepCount(page)).toBe(0);

    await page.reload();
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await page.keyboard.press('.');
    await expect(checkedIn(page, 'Inversion')).toHaveText('Root position');

    await erase(page);
    await page.goto('/about');
    await expect(page.getByRole('switch', { name: 'Keyboard shortcuts' })).toBeChecked();
    await page.goto('/triads');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await page.keyboard.press('.');
    await expect(checkedIn(page, 'Inversion')).toHaveText('1st inversion');
  });

  test('US2-8: inversion wraps, CAGED shapes do not (already covered above)', async ({ page }) => {
    await page.goto('/triads');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await page.keyboard.press(',');
    await expect(checkedIn(page, 'Inversion')).toHaveText('2nd inversion');
    await page.keyboard.press('.');
    await expect(checkedIn(page, 'Inversion')).toHaveText('Root position');
  });

  test('aria-keyshortcuts present while on; focus does not move; no-op keys are not prevented', async ({
    page
  }) => {
    await page.goto('/triads');
    await page.getByRole('grid', { name: 'Fretboard' }).waitFor();
    await expect(page.getByRole('radiogroup', { name: 'Inversion' })).toHaveAttribute(
      'aria-keyshortcuts',
      '. ,'
    );
    await expect(listen(page)).toHaveAttribute('aria-keyshortcuts', 'P');
    await radio(page, 'Quality', 'minor').focus();
    await page.keyboard.press('.');
    await expect(radio(page, 'Quality', 'minor')).toBeFocused();

    // A key outside the table, and a handled key on a screen where it does nothing.
    const prevented = await page.evaluate(() => {
      const send = (key: string) => {
        const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        document.body.dispatchEvent(e);
        return e.defaultPrevented;
      };
      return { unknown: send('x'), handled: send('.') };
    });
    expect(prevented.unknown).toBe(false);
    expect(prevented.handled).toBe(true);

    await page.goto('/about');
    const noop = await page.evaluate(() => {
      const e = new KeyboardEvent('keydown', { key: '.', bubbles: true, cancelable: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(noop).toBe(false);
  });
});
