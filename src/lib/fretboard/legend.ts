/** Legend of the marker kinds drawn on the fretboard (pure, derived from the display model). */
import type { DisplayModel } from './types';

/** Catalogue order = display order. */
export const LEGEND_KINDS = [
  'root',
  'third',
  'fifth',
  'degree',
  'neutral',
  'selected',
  'octave',
  'arpeggio',
  'triadLayer',
  'extra',
  'connection',
  'comparison',
  'wideStretch',
  'alteredString'
] as const;

export type LegendKind = (typeof LEGEND_KINDS)[number];

export interface LegendGroup {
  readonly label?: string;
  readonly kinds: readonly LegendKind[];
}

/** Kinds drawn by the model at highlighted/normal/dimmed emphasis, in catalogue order. */
export function legendKinds(model: DisplayModel): readonly LegendKind[] {
  const used = new Set<LegendKind>();
  for (const mk of model.markers) {
    if (mk.emphasis === 'hidden') continue;
    if (mk.layer === 'arpeggio') used.add('arpeggio');
    else if (mk.layer === 'triad') used.add('triadLayer');
    else if (mk.function === 'neutral')
      used.add(mk.emphasis === 'highlighted' ? 'selected' : 'neutral');
    else if (mk.function === 'degree') used.add('degree');
    else used.add(mk.function);
    if (mk.extra === true) used.add('extra');
    if (mk.ring === true) used.add('connection');
    if (mk.variant === 'comparison') used.add('comparison');
    if (mk.tone !== undefined || mk.octaveBadge === true) used.add('octave');
  }
  if ((model.arrows?.length ?? 0) > 0) used.add('comparison');
  if (model.wideStretch === true) used.add('wideStretch');
  if ((model.stringMarks?.length ?? 0) > 0) used.add('alteredString');
  return LEGEND_KINDS.filter((k) => used.has(k));
}

/** model.legendGroups filtered to in-use kinds; flat single group when absent; [] when none in use. */
export function legendGroups(model: DisplayModel): readonly LegendGroup[] {
  const inUse = legendKinds(model);
  if (inUse.length === 0) return [];
  if (!model.legendGroups) return [{ kinds: inUse }];
  const placed = new Set<LegendKind>();
  const groups: LegendGroup[] = [];
  for (const g of model.legendGroups) {
    const kinds = inUse.filter((k) => g.kinds.includes(k) && !placed.has(k));
    if (kinds.length === 0) continue;
    kinds.forEach((k) => placed.add(k));
    groups.push(g.label === undefined ? { kinds } : { label: g.label, kinds });
  }
  const rest = inUse.filter((k) => !placed.has(k));
  if (rest.length > 0) groups.push({ kinds: rest });
  return groups;
}
