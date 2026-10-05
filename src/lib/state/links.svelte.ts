/**
 * Tool links orchestrator (contracts/links-api.md §2, ADR 0011).
 * Carry is applied in the activating control's handler, never from the URL, history or storage.
 * The only navigation is the single `goto` in each shortcut (FR-015).
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { PitchClass } from '$lib/theory/pitch';
import type { ScreenId } from '$lib/shell/screens';
import type { ToolId } from '$lib/shell/tools';
import { caged } from './caged.svelte';
import { carryFromDetected, carryFromNotes, carryFromTriads } from './links';
import { notes } from './notes.svelte';
import { triads } from './triads.svelte';

export type LinkedTool = ToolId;

/** Apply the carry for a user switch `from → to` (nav link). No-op if `from === to`. */
export function linkTools(from: ScreenId, to: LinkedTool): void {
  if (from === to || from === 'caged' || to === 'caged') return;
  if (from === 'notes' && to === 'triads') {
    const ctx = carryFromNotes(notes.state);
    if (ctx?.kind === 'root') triads.carryRoot(ctx.rootPc);
  } else if (from === 'triads' && to === 'notes') {
    const ctx = carryFromTriads(triads.state);
    if (ctx.kind === 'notes') notes.carrySelection(ctx.selection);
  }
}

/** Notes "View as triad": carry the detected triad, then open Triads (one history entry). */
export async function viewAsTriad(): Promise<void> {
  const d = notes.display.detected;
  if (d === null) return;
  const ctx = carryFromDetected({ rootPc: d.rootPc, quality: d.quality });
  if (ctx.kind !== 'triad') return;
  triads.carryTriad(ctx.rootPc, ctx.quality, ctx.spelling);
  await goto(resolve('/triads'));
}

/** Position card "Triads from this note": carry the pitch class as root, then open Triads. */
export async function openTriadsFromNote(pc: PitchClass): Promise<void> {
  triads.carryRoot(pc);
  await goto(resolve('/triads'));
}

/** CAGED non-compatible notice "Go to Triads": no musical context carried, preferred tuning kept. */
export async function openTriadsFromCaged(): Promise<void> {
  await goto(resolve('/triads'));
}

/**
 * CAGED "Open in Triads": carry the drawn triad (root, quality, inversion, set, occurrence) into
 * Triads, then open it. CAGED state is untouched; no handoff (no triad, temporary view) is a no-op.
 */
export async function openTriadsFromCagedTriad(): Promise<void> {
  const h = caged.display.triad?.handoff ?? null;
  if (h === null) return;
  triads.carryCagedTriad(h);
  await goto(resolve('/triads'));
}

/** Reset the given tool's store (failure-view Reset tool, EC-1.3). */
export function resetTool(tool: LinkedTool): void {
  if (tool === 'notes') notes.reset();
  else if (tool === 'triads') triads.reset();
  else caged.reset();
}
