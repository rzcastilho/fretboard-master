<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Fretboard from '$lib/fretboard/Fretboard.svelte';
  import { fixtureModel } from '$lib/fretboard/fixtures';
  import type { DisplayModel } from '$lib/fretboard/types';
  import { fixtureInstrument } from '$lib/instrument/fixtures';
  import { STANDARD_GUITAR, type Position } from '$lib/instrument/instrument';
  import { maybeFault } from '$lib/shell/fault';
  import { playback } from '$lib/state/playback.svelte';
  import { triads } from '$lib/state/triads.svelte';
  import { onMount } from 'svelte';
  import CompositionPanel from './CompositionPanel.svelte';
  import TriadsGuidance from './TriadsGuidance.svelte';
  import TriadsControls from './TriadsControls.svelte';
  import TriadsSecondary from './TriadsSecondary.svelte';
  import WideStretchMark from './WideStretchMark.svelte';

  // Test-only hook: throws during render so the boundary can be exercised (dead code in production).
  const guard = () => maybeFault('triads');
  guard();

  // Test-only hooks: render on a named fixture instrument, or a named fixture board model, once
  // on mount (dead code in production).
  let fixture: DisplayModel | undefined = $state();
  onMount(() => {
    if (__FM_FAULT_INJECTION__) {
      const inst = fixtureInstrument(globalThis.__fmInstrument);
      if (inst !== STANDARD_GUITAR) triads.useInstrument(inst);
      fixture = fixtureModel(globalThis.__fmFretboardFixture);
    }
  });

  // Test-only hook: log activations for e2e assertions (dead code in production).
  function onactivate(p: Position) {
    triads.activate(p);
    if (__FM_FAULT_INJECTION__) (globalThis.__fmFretboardEvents ??= []).push({ ...p });
  }
</script>

<section class="b" aria-labelledby="triads-zone-b">
  <h2 id="triads-zone-b">{m.zone_main_controls()}</h2>
  <TriadsControls
    state={triads.state}
    instrument={triads.instrument}
    onroot={triads.selectRoot}
    onquality={triads.setQuality}
    oninversion={triads.setInversion}
    onstringset={triads.setStringSet}
  />
</section>
<section class="c" aria-labelledby="triads-zone-c">
  <h2 id="triads-zone-c">{m.zone_fretboard()}</h2>
  <Fretboard
    instrument={triads.instrument}
    model={fixture ?? triads.display.model}
    {onactivate}
    pulses={playback.pulses}
  />
  <TriadsGuidance
    shape={triads.display.shape}
    anotherSet={triads.display.anotherSet}
    onanotherset={triads.anotherSet}
  />
  {#if triads.display.shape.kind === 'shown' && triads.display.shape.wideStretch}
    <WideStretchMark />
  {/if}
</section>
<div class="d">
  <CompositionPanel composition={triads.display.composition} onswitch={triads.switchSpelling} />
</div>
<section class="e" aria-labelledby="triads-zone-e">
  <h2 id="triads-zone-e">{m.zone_actions()}</h2>
  <TriadsSecondary
    labelType={triads.state.labelType}
    onlabeltype={triads.setLabelType}
    octave={triads.display.octave}
    onoctaveup={triads.octaveUp}
    onoctavedown={triads.octaveDown}
    listen={triads.display.listen}
    onlisten={triads.listen}
  />
</section>

<style>
  section,
  .d {
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
