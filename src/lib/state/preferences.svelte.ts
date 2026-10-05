/**
 * Preferences runes store (contracts/preferences-api.md §4, data-model §4). Orchestrates the
 * plain-TS session and pushes loaded values into the other stores through their `restore*`
 * methods. The only importer of `$lib/prefs/*`.
 */
import { startSession, type PreferencesPatch, type PrefsSession } from '$lib/prefs/session';
import { TOOL_IDS, tuningOfPreferences } from '$lib/prefs/schema';
import type { StorageLike } from '$lib/prefs/storage';
import type { ToolId } from '$lib/shell/tools';
import { instrument } from './instrument.svelte';
import { notes } from './notes.svelte';
import { playback } from './playback.svelte';
import { triads } from './triads.svelte';

let session: PrefsSession | null = null;
let lastTool = $state<ToolId | null>(null);
let noticeVisible = $state(false);
/** Rotate hint (016): recorded value, or set for this load when storage is unavailable. */
let rotateHintShown = $state(false);
/** Set once, on the first unavailable start; never reset during the session (FR-012). */
let noticeShown = false;

export const preferences = {
  get lastTool(): ToolId | null {
    return lastTool;
  },
  get noticeVisible(): boolean {
    return noticeVisible;
  },
  get rotateHintShown(): boolean {
    return rotateHintShown;
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
    lastTool = p.lastTool;
    rotateHintShown = p.rotateHintShown;
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
  markRotateHintShown(): void {
    if (rotateHintShown) return;
    rotateHintShown = true;
    session?.remember({ rotateHintShown: true });
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
    }
    lastTool = null;
    rotateHintShown = false;
  },

  remember(patch: PreferencesPatch): void {
    session?.remember(patch);
  }
};

/** Test seam: forget the session and the notice flag (Vitest only). */
export function resetPreferencesForTests(): void {
  session = null;
  lastTool = null;
  rotateHintShown = false;
  noticeVisible = false;
  noticeShown = false;
}
