/**
 * Text of the instrument notice shown after opening a link (023 contracts/link-notices-ui §2).
 * Pure: reads only catalog messages and the notation preference. The text is built from the
 * validated tuning, never from link text.
 */
import { m } from '$lib/paraglide/messages.js';
import { noteLabel, stringSpelling } from '$lib/notation/notation';
import { tuningStrings, type StringCount } from '$lib/instrument/tunings';
import type { LinkInstrument } from '$lib/link/types';
import { tuningLabel } from './tuning-names';

/** Preset name, or the open strings of a custom tuning (lowest → highest) in the active notation. */
export function linkTuningText(link: LinkInstrument): string {
  if (link.tuning.kind === 'preset') return tuningLabel(link.tuning);
  return tuningStrings(link.tuning, link.stringCount)
    .map((pitch) => noteLabel(stringSpelling(pitch, false)))
    .join(' ');
}

/** Notice message: names the string count only when it differs from the stored instrument. */
export function linkNoticeMessage(link: LinkInstrument, storedStringCount: StringCount): string {
  const tuning = linkTuningText(link);
  return link.stringCount !== storedStringCount
    ? m.link_instrument_strings({ count: link.stringCount, tuning })
    : m.link_instrument({ tuning });
}
