import { afterEach, describe, expect, it } from 'vitest';
import { STANDARD_GUITAR } from '../../../src/lib/instrument/instrument';
import { AF_4 } from '../../../src/lib/instrument/fixtures';
import { overwriteGetLocale } from '../../../src/lib/paraglide/runtime.js';
import { buildCagedModel } from '../../../src/lib/state/caged-model';
import { initialCagedView, setFocus } from '../../../src/lib/state/caged-view';
import { buildTriadsModel } from '../../../src/lib/state/triads-model';
import { initialTriadsView } from '../../../src/lib/state/triads-view';

afterEach(() => overwriteGetLocale(() => 'en'));

describe('fragment concatenation is gone (FR-016, R-07)', () => {
  const caged = (tag: 'en' | 'pt-BR' | 'es') => {
    overwriteGetLocale(() => tag);
    const d = buildCagedModel(initialCagedView(), STANDARD_GUITAR, {
      tuningName: 'Standard',
      temporary: false
    });
    return d.model?.description ?? '';
  };

  it('CAGED layer counts read as one message per layer', () => {
    expect(caged('en')).toMatch(/\d+ chord notes/);
    expect(caged('pt-BR')).toMatch(/\d+ notas do acorde/);
    expect(caged('es')).toMatch(/\d+ notas del acorde/);
  });

  it('CAGED pentatonic count agrees with its noun in pt-BR and es', () => {
    const view = initialCagedView();
    const on = setFocus(
      { ...view, layers: { ...view.layers, pentatonic: true } },
      { letter: 'E', ordinal: 0 }
    );
    overwriteGetLocale(() => 'pt-BR');
    const pt = buildCagedModel(on, STANDARD_GUITAR, { tuningName: 'x', temporary: false });
    expect(pt.model?.description).toMatch(/\d+ notas da pentatônica/);
    overwriteGetLocale(() => 'es');
    const es = buildCagedModel(on, STANDARD_GUITAR, { tuningName: 'x', temporary: false });
    expect(es.model?.description).toMatch(/\d+ notas de la pentatónica/);
  });

  it('Triads chain tags and description put the wide-stretch suffix inside one message', () => {
    const run = (tag: 'en' | 'pt-BR' | 'es') => {
      overwriteGetLocale(() => tag);
      const v = { ...initialTriadsView(AF_4), stringSet: 6 as const, view: 'full-neck' as const };
      return buildTriadsModel(v, AF_4);
    };
    const wide = (tag: 'en' | 'pt-BR' | 'es') => {
      const d = run(tag);
      const tags = d.model.tags ?? [];
      return { tags: tags.map((t) => t.name), description: d.model.description ?? '' };
    };
    const en = wide('en');
    expect(en.tags.some((n) => n?.endsWith('wide stretch'))).toBe(true);
    const pt = wide('pt-BR');
    expect(pt.tags.some((n) => n?.endsWith('abertura grande'))).toBe(true);
    expect(pt.description).toContain('abertura grande');
    const es = wide('es');
    expect(es.tags.some((n) => n?.endsWith('apertura grande'))).toBe(true);
    expect(es.description).toContain('apertura grande');
    expect(pt.description).not.toContain('wide stretch');
  });
});
