<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { ListenSource } from '$lib/state/caged-listen';
  import { TEMPOS, type Tempo } from '$lib/state/listen';
  import ChoiceGroup from '../ChoiceGroup.svelte';
  import { shortcuts } from '$lib/state/shortcuts.svelte';

  interface Props {
    enabled: boolean;
    /** Visible reason while disabled. */
    reason: string | null;
    /** What is playing now, else null. */
    listening: ListenSource | null;
    onlisten: () => void;
    tempo: Tempo;
    ontempo: (t: Tempo) => void;
  }

  let { enabled, reason, listening, onlisten, tempo, ontempo }: Props = $props();

  const tempoLabel = (t: Tempo): string => {
    switch (t) {
      case 'slow':
        return m.caged_tempo_slow();
      case 'fast':
        return m.caged_tempo_fast();
      default:
        return m.caged_tempo_medium();
    }
  };

  const tempoOptions = $derived(TEMPOS.map((value) => ({ value, label: tempoLabel(value) })));

  const layerName = (layer: string): string => {
    switch (layer) {
      case 'scale':
        return m.caged_layer_scale();
      case 'pentatonic':
        return m.caged_layer_pentatonic();
      case 'arpeggio':
        return m.caged_layer_arpeggio();
      case 'triad':
        return m.caged_layer_triad();
      default:
        return m.caged_layer_chord();
    }
  };

  const status = $derived(
    listening === null
      ? ''
      : listening.kind === 'all-chords'
        ? m.caged_listen_playing_all()
        : m.caged_listen_playing_layer({
            layer: layerName(listening.layer),
            shape: listening.letter
          })
  );
</script>

<div class="listen">
  <!-- aria-disabled (not disabled) keeps Listen focusable so the reason can be read. -->
  <button
    type="button"
    aria-disabled={enabled ? undefined : 'true'}
    aria-keyshortcuts={shortcuts.enabled ? 'P' : undefined}
    aria-describedby={!enabled && reason !== null ? 'caged-listen-reason' : undefined}
    onclick={() => {
      if (enabled) onlisten();
    }}>{m.caged_listen()}</button
  >
  <ChoiceGroup
    name={m.caged_tempo_label()}
    options={tempoOptions}
    current={tempo}
    onchoose={ontempo}
  />
  {#if !enabled && reason !== null}
    <span id="caged-listen-reason" class="reason">{reason}</span>
  {/if}
  <span class="status" role="status" data-listen-status>{status}</span>
</div>

<style>
  .listen {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: var(--space-1) var(--space-3);
    font: inherit;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-text);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  button[aria-disabled='true'] {
    color: var(--color-disabled-text);
    border-color: var(--color-disabled-border);
    cursor: not-allowed;
  }

  .reason {
    flex-basis: 100%;
    font-size: var(--font-size-sm, 0.875em);
  }
</style>
