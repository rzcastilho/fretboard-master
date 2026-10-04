<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Fretboard from '$lib/fretboard/Fretboard.svelte';
  import { fixtureModel } from '$lib/fretboard/fixtures';
  import type { DisplayModel } from '$lib/fretboard/types';
  import { fixtureInstrument } from '$lib/instrument/fixtures';
  import { STANDARD_GUITAR, type Position } from '$lib/instrument/instrument';
  import { maybeFault } from '$lib/shell/fault';
  import { caged } from '$lib/state/caged.svelte';
  import { playback } from '$lib/state/playback.svelte';
  import { onMount } from 'svelte';
  import CagedControls from './CagedControls.svelte';

  // Test-only hook: throws during render so the boundary can be exercised (dead code in production).
  const guard = () => maybeFault('caged');
  guard();

  // Test-only hooks: render on a named fixture instrument or board model (dead code in production).
  let fixture: DisplayModel | undefined = $state();
  onMount(() => {
    if (__FM_FAULT_INJECTION__) {
      const inst = fixtureInstrument(globalThis.__fmInstrument);
      if (inst !== STANDARD_GUITAR) caged.useInstrument(inst);
      fixture = fixtureModel(globalThis.__fmFretboardFixture);
    }
  });

  // Test-only hook: log activations for e2e assertions (dead code in production).
  function onactivate(p: Position) {
    caged.activate(p);
    if (__FM_FAULT_INJECTION__) (globalThis.__fmFretboardEvents ??= []).push({ ...p });
  }
</script>

<section class="b" aria-labelledby="caged-zone-b">
  <h2 id="caged-zone-b">{m.zone_main_controls()}</h2>
  <CagedControls
    state={caged.state}
    switchTo={caged.display.switchTo}
    onroot={(pc) => caged.selectRoot(pc)}
    onquality={(q) => caged.setQuality(q)}
    onswitch={() => caged.switchSpelling()}
  />
  <p class="key">{caged.display.keyName}</p>
</section>
<section class="c" aria-labelledby="caged-zone-c">
  <h2 id="caged-zone-c">{m.zone_fretboard()}</h2>
  {#if caged.display.model || fixture}
    <Fretboard
      instrument={caged.instrument}
      model={fixture ?? caged.display.model ?? undefined}
      {onactivate}
      pulses={playback.pulses}
    />
    {#if caged.display.fitNote}
      <p class="fit" role="status">{caged.display.fitNote}</p>
    {/if}
  {:else}
    <p class="unavailable" role="status">{m.caged_tuning_unavailable()}</p>
  {/if}
</section>

<div class="d">
  <button type="button" onclick={() => caged.reset()}>{m.caged_reset()}</button>
</div>

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

  .key {
    margin: var(--space-3) 0 0;
    font-size: var(--font-size-lg, var(--font-size-md));
    font-weight: 600;
  }

  .fit {
    margin: var(--space-3) 0 0;
    padding-inline: var(--space-4);
  }

  .unavailable {
    margin: var(--space-3) 0 0;
    padding-inline: var(--space-4);
    color: var(--color-text-muted);
  }

  .d {
    grid-area: d;
    padding: var(--space-4);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    min-inline-size: 0;
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
</style>
