import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import { m } from '../../src/lib/paraglide/messages.js';
import AboutPage from '../../src/routes/about/+page.svelte';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version: string;
};

describe('app version', () => {
  it('__APP_VERSION__ is semver and equals package.json version', () => {
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+$/);
    expect(__APP_VERSION__).toBe(pkg.version);
  });

  it('About page shows the version message', () => {
    render(AboutPage);
    expect(screen.getByText(m.about_version({ version: __APP_VERSION__ }))).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: m.about_heading() })).toBeTruthy();
    expect(screen.getByText(m.about_description())).toBeTruthy();
  });

  it('About application bar contains the sound control', () => {
    render(AboutPage);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('group', { name: 'Sound' })).toBeTruthy();
  });
});
