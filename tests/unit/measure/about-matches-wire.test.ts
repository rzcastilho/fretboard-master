import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EVENT_TYPES,
  parseItems,
  type EventType,
  type UsageEvent
} from '../../../src/lib/measure/wire';

type Catalog = Record<string, string>;
const load = (name: string): Catalog => JSON.parse(readFileSync(`messages/${name}.json`, 'utf8'));

type Kind = 'tool' | 'device' | 'lang' | 'instrument';
interface Terms {
  events: Record<EventType, string>;
  traits: Record<Kind, string[]>;
  never: { identifiers: string; links: string; tuning: string };
}

/** Per-locale phrase that About must contain for each thing the wire carries. */
const TERMS: Record<'en' | 'pt-BR' | 'es', Terms> = {
  en: {
    events: {
      'tool-opened': 'tool opened',
      'first-interaction': 'first fretboard tap',
      'sound-played': 'sound played',
      'link-shared': 'link shared',
      'link-opened': 'link opened',
      'instrument-changed': 'instrument changed'
    },
    traits: {
      tool: ['tool'],
      device: ['device type'],
      lang: ['language'],
      instrument: ['strings', 'tuning', 'left-handed']
    },
    never: { identifiers: 'identifiers', links: 'link addresses', tuning: 'custom tuning' }
  },
  'pt-BR': {
    events: {
      'tool-opened': 'ferramenta aberta',
      'first-interaction': 'primeiro toque no braço',
      'sound-played': 'som tocado',
      'link-shared': 'link compartilhado',
      'link-opened': 'link aberto',
      'instrument-changed': 'instrumento alterado'
    },
    traits: {
      tool: ['ferramenta'],
      device: ['tipo de dispositivo'],
      lang: ['idioma'],
      instrument: ['cordas', 'afinação', 'canhoto']
    },
    never: {
      identifiers: 'identificadores',
      links: 'endereços de links',
      tuning: 'afinação personalizada'
    }
  },
  es: {
    events: {
      'tool-opened': 'herramienta abierta',
      'first-interaction': 'primer toque en el mástil',
      'sound-played': 'sonido reproducido',
      'link-shared': 'enlace compartido',
      'link-opened': 'enlace abierto',
      'instrument-changed': 'instrumento cambiado'
    },
    traits: {
      tool: ['herramienta'],
      device: ['tipo de dispositivo'],
      lang: ['idioma'],
      instrument: ['cuerdas', 'afinación', 'zurdo']
    },
    never: {
      identifiers: 'identificadores',
      links: 'direcciones de enlaces',
      tuning: 'afinación personalizada'
    }
  }
};

// Every key of a usage event, so a new field added to the wire must be added here (type-checked)
// and then grouped into a trait kind below.
const SAMPLE = {
  r: 'e',
  type: 'tool-opened',
  tool: 'notes',
  device: 'desktop',
  lang: 'en',
  strings: 6,
  tuning: 'AF-1',
  hand: 'right',
  start: true,
  secs: 0
} satisfies UsageEvent;

const STRUCTURAL = new Set(['r', 'type', 'start', 'secs']);
const KIND_OF: Record<string, Kind> = {
  tool: 'tool',
  device: 'device',
  lang: 'lang',
  strings: 'instrument',
  tuning: 'instrument',
  hand: 'instrument'
};

describe('About text matches what the wire carries (FR-016, SC-006)', () => {
  it('the sample is a valid wire item', () => {
    const opened = { ...SAMPLE, secs: undefined };
    const interaction = { ...SAMPLE, type: 'first-interaction', start: undefined };
    expect(parseItems({ v: 1, items: [opened, interaction] })).toHaveLength(2);
  });

  for (const tag of ['en', 'pt-BR', 'es'] as const) {
    describe(tag, () => {
      const cat = load(tag);
      const terms = TERMS[tag];
      const measured = (cat.about_privacy_measured ?? '').toLowerCase();

      it('term map covers exactly the wire events', () => {
        expect(Object.keys(terms.events).sort()).toEqual([...EVENT_TYPES].sort());
      });

      it('term map covers exactly the wire trait kinds', () => {
        const kinds = new Set(
          Object.keys(SAMPLE)
            .filter((k) => !STRUCTURAL.has(k))
            .map((k) => KIND_OF[k])
        );
        expect(Object.keys(terms.traits).sort()).toEqual([...kinds].sort());
        expect(Object.keys(SAMPLE).filter((k) => !STRUCTURAL.has(k) && !KIND_OF[k])).toEqual([]);
      });

      it('about_privacy_measured names every event and trait', () => {
        const phrases = [...Object.values(terms.events), ...Object.values(terms.traits).flat()];
        for (const p of phrases) expect(measured, p).toContain(p.toLowerCase());
      });

      it('about_privacy_never names identifiers, link addresses and custom tuning', () => {
        const never = (cat.about_privacy_never ?? '').toLowerCase();
        for (const p of Object.values(terms.never)) expect(never, p).toContain(p);
      });

      it('about_privacy_dnt names both signals', () => {
        const dnt = cat.about_privacy_dnt ?? '';
        expect(dnt).toContain('Do Not Track');
        expect(dnt).toContain('Global Privacy Control');
      });
    });
  }
});
