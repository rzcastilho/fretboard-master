<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Fretboard from '$lib/fretboard/Fretboard.svelte';
  import { fixtureModel } from '$lib/fretboard/fixtures';
  import type { DisplayModel } from '$lib/fretboard/types';
  import { STANDARD_GUITAR, type Instrument, type Position } from '$lib/instrument/instrument';
  import { playback } from '$lib/state/playback.svelte';
  import { print } from '$lib/state/print.svelte';
  import { onMount } from 'svelte';
  import { maybeFault } from './fault';
  import type { ToolId } from './tools';

  let { tool, instrument = STANDARD_GUITAR }: { tool: ToolId; instrument?: Instrument } = $props();

  // Test-only hook: throws during render so the boundary can be exercised (dead code in production).
  const guard = () => maybeFault(tool);
  guard();

  // Test-only hook: render a named fixture model once on mount (dead code in production).
  let model: DisplayModel | undefined = $state();
  onMount(() => {
    if (__FM_FAULT_INJECTION__) model = fixtureModel(globalThis.__fmFretboardFixture);
  });

  // US4-4: changing the instrument stops playback (not on first run).
  let previousInstrument: Instrument | undefined;
  $effect(() => {
    const current = instrument;
    if (previousInstrument !== undefined && previousInstrument !== current) {
      playback.stop('instrument');
    }
    previousInstrument = current;
  });

  // Test-only hook: log activations for e2e assertions (dead code in production).
  function onactivate(p: Position) {
    playback.note(p, instrument);
    if (__FM_FAULT_INJECTION__) (globalThis.__fmFretboardEvents ??= []).push({ ...p });
  }
</script>

<section class="b" aria-labelledby="zone-b">
  <h2 id="zone-b">{m.zone_main_controls()}</h2>
  <p>{m.placeholder_main_controls()}</p>
</section>
<section class="c" aria-labelledby="zone-c">
  <h2 id="zone-c">{m.zone_fretboard()}</h2>
  <Fretboard {instrument} {model} {onactivate} pulses={playback.pulses} printing={print.active} />
</section>
<section class="d" aria-labelledby="zone-d">
  <h2 id="zone-d">{m.zone_context_panel()}</h2>
  <p>{m.placeholder_context_panel()}</p>
</section>
<section class="e" aria-labelledby="zone-e">
  <h2 id="zone-e">{m.zone_actions()}</h2>
  <p>{m.placeholder_actions()}</p>
</section>

<style>
  section {
    padding: var(--space-4);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    min-inline-size: 0;
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-md);
  }

  p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .b {
    grid-area: b;
  }
  .c {
    grid-area: c;
    padding-inline: var(--zone-fretboard-padding-inline);
  }

  .c h2 {
    padding-inline: var(--space-4);
  }
  .d {
    grid-area: d;
  }
  .e {
    grid-area: e;
  }
</style>
