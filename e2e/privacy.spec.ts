import { expect, test, type Page } from '@playwright/test';

import { expandDetails } from './support/helpers';

/** 027 US3: the privacy claims hold on a real first-load walk through every screen. */

type PermissionGlobals = { __permissionCalls: Record<string, number> };

const SPIED = [
  'getUserMedia',
  'getCurrentPosition',
  'watchPosition',
  'requestPermission',
  'permissionsQuery',
  'requestMIDIAccess'
] as const;

async function spyOnPermissionApis(page: Page): Promise<void> {
  await page.addInitScript((names) => {
    const g = window as unknown as PermissionGlobals;
    g.__permissionCalls = Object.fromEntries(names.map((n) => [n, 0]));
    const count = (name: string) => {
      g.__permissionCalls[name] += 1;
    };
    const wrap = (target: object | undefined, prop: string, name: string) => {
      if (!target) return;
      Object.defineProperty(target, prop, {
        configurable: true,
        writable: true,
        value: () => {
          count(name);
          return Promise.reject(new DOMException('blocked by test spy', 'NotAllowedError'));
        }
      });
    };
    wrap(navigator.mediaDevices, 'getUserMedia', 'getUserMedia');
    wrap(navigator.geolocation, 'getCurrentPosition', 'getCurrentPosition');
    wrap(navigator.geolocation, 'watchPosition', 'watchPosition');
    wrap(window.Notification, 'requestPermission', 'requestPermission');
    wrap(navigator.permissions, 'query', 'permissionsQuery');
    wrap(navigator, 'requestMIDIAccess', 'requestMIDIAccess');
  }, SPIED);
}

const IDENTITY_INPUTS = 'input[type=email],input[type=password],input[type=tel]';

test.describe('privacy: first-load walk (FR-019)', () => {
  test('makes no third-party request, permission call, cookie or foreign storage key', async ({
    page,
    context,
    baseURL
  }) => {
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    const origins = new Set<string>();
    context.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return;
      origins.add(new URL(url).origin);
    });
    page.on('dialog', (dialog) => {
      void dialog.dismiss();
      throw new Error(`unexpected dialog: ${dialog.message()}`);
    });
    await spyOnPermissionApis(page);

    const identityInputs: Record<string, number> = {};
    const countIdentityInputs = async (path: string) => {
      identityInputs[path] = await page.locator(IDENTITY_INPUTS).count();
    };

    await page.goto('/');
    await countIdentityInputs('/');

    await page.goto('/notes');
    await expandDetails(page);
    await page
      .getByRole('group', { name: 'Choose notes' })
      .getByRole('button', { name: 'A', exact: true })
      .click();
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await countIdentityInputs('/notes');

    await page.goto('/triads');
    await expandDetails(page);
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.getByRole('banner').getByRole('button', { name: 'Share', exact: true }).click();
    // Either the clipboard accepted the link or the manual-copy fallback appeared; no prompt.
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Link copied' })
        .or(page.getByText('Copy this address'))
    ).toBeVisible();
    await countIdentityInputs('/triads');

    await page.goto('/caged');
    await expandDetails(page);
    await page.getByRole('button', { name: 'Listen', exact: true }).click();
    await page.getByRole('button', { name: /strings · |^Tuning:|^Instrument/ }).click();
    await expect(page.getByRole('dialog', { name: 'Instrument' })).toBeVisible();
    await page.keyboard.press('Escape');
    await countIdentityInputs('/caged');

    await page.goto('/about');
    await page.getByRole('button', { name: 'Language and appearance', exact: true }).click();
    await page.getByRole('radio', { name: 'Español' }).check();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await page.getByRole('switch', { name: 'Atajos de teclado' }).click();
    await countIdentityInputs('/about');

    expect([...origins].filter((o) => o !== origin)).toEqual([]);

    const calls = await page.evaluate(
      () => (window as unknown as PermissionGlobals).__permissionCalls
    );
    expect(calls).toEqual(Object.fromEntries(SPIED.map((n) => [n, 0])));

    expect(await context.cookies()).toEqual([]);

    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key.startsWith('fretboard-master:')).toBe(true);

    expect(identityInputs).toEqual({ '/': 0, '/notes': 0, '/triads': 0, '/caged': 0, '/about': 0 });
  });
});
