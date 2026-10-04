<script lang="ts">
  import { pushState } from '$app/navigation';
  import { page } from '$app/state';
  import { tick } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import Fretboard from '$lib/fretboard/Fretboard.svelte';
  import { HANDEDNESS, ORIENTATIONS } from '$lib/instrument/instrument';
  import { offsetsOfTuning, type StringCount } from '$lib/instrument/tunings';
  import { noteLabel, pitchLabel, spokenNote, spokenNoteList } from '$lib/notation/notation';
  import { invertedStrings, type StringNumber } from '$lib/instrument/custom-tuning';
  import { instrument } from '$lib/state/instrument.svelte';
  import FretStepper from './FretStepper.svelte';
  import { takeOpener } from './instrument-opener';
  import type { ScreenId } from './screens';
  import { tuningLabel, tuningName } from './tuning-names';

  let { screen = 'home' }: { screen?: ScreenId } = $props();

  // Visual glyphs only; the accessible names come from the catalog.
  const GLYPH_LOWER = '−';
  const GLYPH_RAISE = '+';

  const uid = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();
  let opener: HTMLElement | null = null;

  const selected = $derived(instrument.selectedRadio);
  const stringRows = $derived(
    instrument.rows.map((row) => ({
      ...row,
      label: pitchLabel(row.pitch, row.pitch.octave),
      noteName: m.instrument_string_note({
        string: row.string,
        note: spokenNote(row.pitch),
        octave: row.pitch.octave
      })
    }))
  );
  const COUNTS: readonly StringCount[] = [6, 7];
  const outOfOrder = $derived(
    instrument.panel.open &&
      invertedStrings(
        offsetsOfTuning(instrument.panel.pending.tuning, instrument.panel.pending.stringCount)
      )
  );
  const rows = $derived(
    instrument.presets.map(({ id, strings }) => {
      // Stored low → high, the preset's own spelling.
      const name = tuningName(id);
      return {
        id,
        name,
        // Seven-string rows carry octaves (B1 E2 …); 6-string rows stay as before (FR-019).
        glyphs: strings
          .map((p) => (strings.length === 7 ? pitchLabel(p, p.octave) : noteLabel(p)))
          .join(' '),
        label: m.instrument_preset_label({ name, notes: spokenNoteList(strings) })
      };
    })
  );

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (instrument.panel.open && !el.open) {
      opener = takeOpener() ?? (document.activeElement as HTMLElement | null);
      el.showModal();
      el.querySelector<HTMLInputElement>('input[name$="-tuning"]:checked')?.focus();
    } else if (!instrument.panel.open && el.open) {
      el.close();
    }
  });

  // R-07: a shallow history entry lets Back close the panel; every other close removes it again,
  // so net history is unchanged and the URL never changes.
  let entryPushed = false;
  let entrySeen = false;
  $effect(() => {
    const open = instrument.panel.open;
    const flagged = page.state.instrumentPanel === true;
    if (open && !entryPushed) {
      entryPushed = true;
      entrySeen = false;
      pushState('', { instrumentPanel: true });
    } else if (open) {
      if (flagged) entrySeen = true;
      else if (entrySeen) {
        // Back popped the entry: discard.
        entryPushed = false;
        entrySeen = false;
        instrument.cancel();
      }
    } else if (entryPushed) {
      entryPushed = false;
      entrySeen = false;
      history.back();
    }
  });

  /** Every close path (Escape, Close, backdrop, Confirm) ends here: return focus to the opener. */
  function onClose(): void {
    instrument.cancel();
    const target = opener;
    opener = null;
    if (target?.isConnected) target.focus();
  }

  function onBackdrop(event: MouseEvent): void {
    if (event.target === dialog) instrument.cancel();
  }

  /** FR-023: a focused step button that just became disabled hands focus to its row's note button. */
  async function step(event: MouseEvent, string: StringNumber, delta: 1 | -1): Promise<void> {
    const button = event.currentTarget as HTMLButtonElement;
    // Read before the update: browsers blur a focused button as soon as it becomes disabled.
    const hadFocus = document.activeElement === button;
    if (instrument.stepString(string, delta)) instrument.playString(string);
    await tick();
    if (button.disabled && hadFocus) {
      button.closest('.string-row')?.querySelector<HTMLElement>('.note')?.focus();
    }
  }

  function confirm(): void {
    instrument.confirm(screen);
  }
</script>

<dialog
  bind:this={dialog}
  class="instrument-panel"
  aria-labelledby="{uid}-title"
  oncancel={() => instrument.cancel()}
  onclose={onClose}
  onclick={onBackdrop}
>
  {#if instrument.panel.open}
    <div class="body">
      <h2 id="{uid}-title">{m.instrument_panel_title()}</h2>
      <fieldset>
        <legend>{m.instrument_strings_legend()}</legend>
        {#each COUNTS as count (count)}
          <label class="count-option">
            <input
              type="radio"
              name="{uid}-strings"
              value={count}
              checked={instrument.stringCount === count}
              onchange={() => instrument.setStringCount(count)}
            />
            <span class="text">{m.instrument_strings_option({ count })}</span>
          </label>
        {/each}
      </fieldset>
      <fieldset>
        <legend>{m.instrument_tuning_legend()}</legend>
        {#each rows as row (row.id)}
          <label class="preset">
            <input
              type="radio"
              name="{uid}-tuning"
              value={row.id}
              aria-label={row.label}
              checked={selected === row.id}
              onchange={() => instrument.selectTuning(row.id)}
            />
            <span class="text">
              <span class="name" aria-hidden="true">{row.name}</span>
              <span class="notes" aria-hidden="true">{row.glyphs}</span>
            </span>
          </label>
        {/each}
        <label class="preset">
          <input
            type="radio"
            name="{uid}-tuning"
            value="custom"
            aria-label={m.instrument_custom_label()}
            checked={selected === 'custom'}
            onchange={() => instrument.chooseCustom()}
          />
          <span class="text">
            <span class="name" aria-hidden="true">{m.tuning_custom()}</span>
          </span>
        </label>
      </fieldset>
      {#if instrument.customOpen}
        <p class="tuning-name" role="status" aria-live="polite">
          {instrument.panel.open ? tuningLabel(instrument.panel.pending.tuning) : ''}
          {#if outOfOrder}
            <span class="order-note">{m.instrument_tuning_order()}</span>
          {/if}
        </p>
        <div class="strings" role="group" aria-label={m.instrument_custom_strings()}>
          {#each stringRows as row (row.string)}
            <div class="string-row">
              <button
                type="button"
                class="step"
                aria-label={m.instrument_string_lower({ string: row.string })}
                disabled={!row.canLower}
                onclick={(e) => step(e, row.string, -1)}
              >
                <span aria-hidden="true">{GLYPH_LOWER}</span>
              </button>
              <button
                type="button"
                class="note"
                aria-label={row.noteName}
                onclick={() => instrument.playString(row.string)}>{row.label}</button
              >
              <button
                type="button"
                class="step"
                aria-label={m.instrument_string_raise({ string: row.string })}
                disabled={!row.canRaise}
                onclick={(e) => step(e, row.string, 1)}
              >
                <span aria-hidden="true">{GLYPH_RAISE}</span>
              </button>
            </div>
          {/each}
        </div>
      {/if}
      <FretStepper />
      <fieldset>
        <legend>{m.instrument_handedness_legend()}</legend>
        {#each HANDEDNESS as value (value)}
          <label class="count-option">
            <input
              type="radio"
              name="{uid}-handedness"
              {value}
              checked={instrument.panel.open && instrument.panel.pending.handedness === value}
              onchange={() => instrument.setHandedness(value)}
            />
            <span class="text"
              >{value === 'left'
                ? m.instrument_handedness_left_option()
                : m.instrument_handedness_right_option()}</span
            >
          </label>
        {/each}
      </fieldset>
      <fieldset>
        <legend>{m.instrument_orientation_legend()}</legend>
        {#each ORIENTATIONS as value (value)}
          <label class="count-option">
            <input
              type="radio"
              name="{uid}-orientation"
              {value}
              checked={instrument.panel.open && instrument.panel.pending.orientation === value}
              onchange={() => instrument.setOrientation(value)}
            />
            <span class="text"
              >{value === 'lowest-top'
                ? m.instrument_orientation_lowest()
                : m.instrument_orientation_highest()}</span
            >
          </label>
        {/each}
      </fieldset>
      {#if instrument.preview}
        <figure class="preview">
          <figcaption>{m.instrument_preview_label()}</figcaption>
          <Fretboard instrument={instrument.preview} variant="preview" />
        </figure>
      {/if}
      <div class="actions">
        <button type="button" onclick={() => instrument.restoreDefault()}>
          {m.instrument_restore_default()}
        </button>
        <button type="button" class="primary" onclick={confirm}>{m.instrument_confirm()}</button>
        <button type="button" onclick={() => instrument.cancel()}>{m.instrument_close()}</button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  .instrument-panel {
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-border);
    padding: 0;
    overflow: auto;
    /* Bottom sheet below 1024px. */
    inline-size: 100%;
    max-inline-size: 100%;
    max-block-size: var(--instrument-sheet-max-block-size);
    inset: auto 0 0 0;
    margin: 0;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  @media (min-width: 1024px) {
    .instrument-panel {
      inline-size: var(--instrument-panel-width);
      max-inline-size: 100%;
      block-size: 100dvh;
      max-block-size: 100dvh;
      inset: 0 0 0 auto;
      border-radius: 0;
    }
  }

  @keyframes sheet-in {
    from {
      translate: 0 100%;
    }
  }

  @keyframes side-in {
    from {
      translate: 100% 0;
    }
  }

  /* Slide-in only when motion is welcome; reduced motion shows the panel instantly. */
  @media (prefers-reduced-motion: no-preference) {
    .instrument-panel[open] {
      animation: sheet-in var(--duration-short) ease-out;
    }
  }

  @media (prefers-reduced-motion: no-preference) and (min-width: 1024px) {
    .instrument-panel[open] {
      animation-name: side-in;
    }
  }

  .instrument-panel::backdrop {
    background: var(--color-backdrop);
  }

  .body {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  h2 {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  fieldset {
    display: grid;
    gap: var(--space-2);
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-block-end: var(--space-2);
    font-weight: var(--font-weight-bold);
  }

  .preset,
  .count-option {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-block-size: var(--target-min);
    padding-inline: var(--space-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .preset:has(input:checked),
  .count-option:has(input:checked) {
    background: var(--color-surface-raised);
    border-width: calc(var(--border-width) * 2);
  }

  .preset input,
  .count-option input {
    flex: none;
    inline-size: var(--space-5);
    block-size: var(--space-5);
    accent-color: var(--color-accent);
  }

  .text {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--space-3);
    min-inline-size: 0;
  }

  .name {
    font-weight: var(--font-weight-bold);
  }

  .notes {
    font-family: var(--font-family-notes);
    color: var(--color-text-muted);
  }

  .tuning-name {
    margin: 0;
    font-weight: var(--font-weight-bold);
  }

  .order-note {
    display: block;
    font-weight: var(--font-weight-normal);
    color: var(--color-text-muted);
  }

  .strings {
    display: grid;
    gap: var(--space-2);
  }

  .string-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .string-row button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-3);
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .string-row .note {
    min-inline-size: calc(var(--target-min) * 2);
    font-family: var(--font-family-notes);
    font-weight: var(--font-weight-bold);
  }

  .string-row button:disabled {
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  .preview {
    margin: 0;
  }

  figcaption {
    margin-block-end: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .actions button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-4);
    font: inherit;
    color: var(--color-text);
    background: transparent;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .actions .primary {
    font-weight: var(--font-weight-bold);
    background: var(--color-surface-raised);
  }
</style>
