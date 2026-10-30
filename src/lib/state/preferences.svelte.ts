/**
 * Preferences runes store (contracts/preferences-api.md §4, data-model §4). Orchestrates the
 * plain-TS session and pushes loaded values into the other stores through their `restore*`
 * methods. The only importer of `$lib/prefs/*`.
 */
import { startSession, type PreferencesPatch, type PrefsSession } from '$lib/prefs/session';
import { DEFAULT_PREFERENCES, TOOL_IDS, tuningOfPreferences } from '$lib/prefs/schema';
import type { StorageLike } from '$lib/prefs/storage';
import type { ToolId } from '$lib/shell/tools';
import { caged } from './caged.svelte';
import { instrument } from './instrument.svelte';
import { metronome } from './metronome.svelte';
import { language } from './language.svelte';
import { notation } from './notation.svelte';
import { notes } from './notes.svelte';
import { playback } from './playback.svelte';
import { shortcuts } from './shortcuts.svelte';
import { theme } from './theme.svelte';
import { triads } from './triads.svelte';

let session: PrefsSession | null = null;
let lastTool = $state<ToolId | null>(null);
let noticeVisible = $state(false);
/** CAGED solfège note (021): recorded value, or set for this load when storage is unavailable. */
let cagedNoteShown = $state(false);
/** Set once, on the first unavailable start; never reset during the session (FR-012). */
let noticeShown = false;

export const preferences = {
  get lastTool(): ToolId | null {
    return lastTool;
  },
  get noticeVisible(): boolean {
    return noticeVisible;
  },
  get cagedNoteShown(): boolean {
    return cagedNoteShown;
  },

  /** Read once, apply, never write. Idempotent. */
  start(storage?: StorageLike | null): void {
    if (session) return;
    session = startSession(storage);
    const p = session.current;
    instrument.restore({
      stringCount: p.stringCount,
      tuning: tuningOfPreferences(p),
      fretCount: p.fretCount,
      handedness: p.handedness,
      orientation: p.orientation
    });
    playback.restore({ muted: p.muted, volume: p.volume });
    notes.restoreLabelType(p.labels.notes);
    triads.restoreLabelType(p.labels.triads);
    caged.restoreLabelType(p.labels.caged);
    caged.restoreTempo(p.tempo);
    language.start(p.language);
    notation.start({ notation: p.notation, accidentals: p.accidentals });
    theme.start(p.theme);
    shortcuts.start(p.shortcuts);
    metronome.restoreSettings(p.metronome.ratios);
    lastTool = p.lastTool;
    cagedNoteShown = p.cagedNoteShown;
    if (!session.available && !noticeShown) {
      noticeShown = true;
      noticeVisible = true;
    }
  },

  toolOpened(id: ToolId): void {
    if (!(TOOL_IDS as readonly string[]).includes(id)) return;
    lastTool = id;
    session?.remember({ lastTool: id });
  },

  /** Idempotent, fire-and-forget; the in-load flag holds even when storage is unavailable. */
  markCagedNoteShown(): void {
    if (cagedNoteShown) return;
    cagedNoteShown = true;
    session?.remember({ cagedNoteShown: true });
  },

  dismissNotice(): void {
    noticeVisible = false;
  },

  /** A real screen change hides the notice. */
  screenChanged(): void {
    noticeVisible = false;
  },

  /** FR-017: remove stored keys and return to defaults. Writes nothing, never raises the notice. */
  erase(): void {
    playback.stop();
    session?.erase();
    const d = session?.current;
    if (d) {
      instrument.restore({
        stringCount: d.stringCount,
        tuning: tuningOfPreferences(d),
        fretCount: d.fretCount,
        handedness: d.handedness,
        orientation: d.orientation
      });
      playback.restore({ muted: d.muted, volume: d.volume });
      notes.restoreLabelType(d.labels.notes);
      triads.restoreLabelType(d.labels.triads);
      caged.restoreLabelType(d.labels.caged);
      caged.restoreTempo(d.tempo);
    }
    language.restore(null);
    notation.restore(null, 'sharps');
    theme.restore(null);
    shortcuts.restore(true);
    metronome.restoreSettings(
      session ? session.current.metronome.ratios : DEFAULT_PREFERENCES.metronome.ratios
    );
    lastTool = null;
    cagedNoteShown = false;
  },

  remember(patch: PreferencesPatch): void {
    session?.remember(patch);
  }
};

/** Test seam: forget the session and the notice flag (Vitest only). */
export function resetPreferencesForTests(): void {
  session = null;
  lastTool = null;
  cagedNoteShown = false;
  noticeVisible = false;
  noticeShown = false;
}
