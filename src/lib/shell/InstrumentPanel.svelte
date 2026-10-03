<script lang="ts">
  import { pushState } from '$app/navigation';
  import { page } from '$app/state';
  import { m } from '$lib/paraglide/messages.js';
  import Fretboard from '$lib/fretboard/Fretboard.svelte';
  import { TUNING_PRESETS } from '$lib/instrument/tunings';
  import { noteLabel, spokenNoteList } from '$lib/notation/notation';
  import { instrument } from '$lib/state/instrument.svelte';
  import FretStepper from './FretStepper.svelte';
  import { takeOpener } from './instrument-opener';
  import type { ScreenId } from './screens';
  import { tuningName } from './tuning-names';

  let { screen = 'home' }: { screen?: ScreenId } = $props();

  const uid = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();
  let opener: HTMLElement | null = null;

  const pendingTuning = $derived(instrument.panel.open ? instrument.panel.pending.tuningId : null);
  const rows = $derived(
    TUNING_PRESETS.map((preset) => {
      // Stored low → high, the preset's own spelling.
      const name = tuningName(preset.id);
      return {
        id: preset.id,
        name,
        glyphs: preset.strings.map(noteLabel).join(' '),
        label: m.instrument_preset_label({ name, notes: spokenNoteList(preset.strings) })
      };
    })
  );

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (instrument.panel.open && !el.open) {
      opener = takeOpener() ?? (document.activeElement as HTMLElement | null);
      el.showModal();
      el.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
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
        <legend>{m.instrument_tuning_legend()}</legend>
        {#each rows as row (row.id)}
          <label class="preset">
            <input
              type="radio"
              name="{uid}-tuning"
              value={row.id}
              aria-label={row.label}
              checked={pendingTuning === row.id}
              onchange={() => instrument.selectTuning(row.id)}
            />
            <span class="text">
              <span class="name" aria-hidden="true">{row.name}</span>
              <span class="notes" aria-hidden="true">{row.glyphs}</span>
            </span>
          </label>
        {/each}
      </fieldset>
      <FretStepper />
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

  .preset {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-block-size: var(--target-min);
    padding-inline: var(--space-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .preset:has(input:checked) {
    background: var(--color-surface-raised);
    border-width: calc(var(--border-width) * 2);
  }

  .preset input {
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
