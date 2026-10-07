// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { language, resetLanguageForTests } from '../../src/lib/state/language.svelte';
import PrivacyPolicy from '../../src/lib/shell/PrivacyPolicy.svelte';
import en from '../../messages/en.json';
import ptBR from '../../messages/pt-BR.json';
import es from '../../messages/es.json';

const KEYS = [
  'about_privacy_no_data',
  'about_privacy_stored',
  'about_privacy_erase',
  'about_privacy_measured',
  'about_privacy_errors',
  'about_privacy_never',
  'about_privacy_dnt',
  'about_privacy_no_ads',
  'about_privacy_no_permissions',
  'about_privacy_hosting',
  'about_privacy_share_links',
  'about_privacy_all_ages'
] as const;

afterEach(() => {
  document.body.innerHTML = '';
  resetLanguageForTests();
});

describe('PrivacyPolicy', () => {
  for (const [tag, cat] of [
    ['en', en],
    ['pt-BR', ptBR],
    ['es', es]
  ] as const) {
    it(`renders twelve statements in order in ${tag}`, () => {
      language.start(null);
      language.restore(tag);
      const { container } = render(PrivacyPolicy);
      const items = [...container.querySelectorAll('ul > li')];
      expect(items).toHaveLength(12);
      expect(items.map((li) => li.textContent?.trim())).toEqual(KEYS.map((k) => cat[k]));
    });
  }

  it('no longer claims "nothing is measured"', () => {
    const { container } = render(PrivacyPolicy);
    expect(container.textContent).not.toContain('Nothing is measured');
  });

  it('renders text, never HTML', () => {
    const { container } = render(PrivacyPolicy);
    expect(container.querySelectorAll('li *')).toHaveLength(0);
  });
});
