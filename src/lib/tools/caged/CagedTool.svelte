<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Fretboard from '$lib/fretboard/Fretboard.svelte';
  import { fixtureModel } from '$lib/fretboard/fixtures';
  import type { DisplayModel } from '$lib/fretboard/types';
  import { fixtureInstrument } from '$lib/instrument/fixtures';
  import { STANDARD_GUITAR, type Position } from '$lib/instrument/instrument';
  import { maybeFault } from '$lib/shell/fault';
  import { caged } from '$lib/state/caged.svelte';
  import { openTriadsFromCaged, openTriadsFromCagedTriad } from '$lib/state/links.svelte';
  import { instrument } from '$lib/state/instrument.svelte';
  import { playback } from '$lib/state/playback.svelte';
  import { fit } from '$lib/state/fit.svelte';
  import { print } from '$lib/state/print.svelte';
  import FitNotice from '$lib/tools/FitNotice.svelte';
  import FitToggle from '$lib/tools/FitToggle.svelte';
  import ContextZone from '$lib/tools/ContextZone.svelte';
  import SidePanels from '$lib/tools/SidePanels.svelte';
  import { notation } from '$lib/state/notation.svelte';
  import { solfegeName } from '$lib/notation/notation';
  import { preferences } from '$lib/state/preferences.svelte';
  import { isPhonePortrait } from '$lib/state/rotate-hint';
  import Notice from '$lib/shell/Notice.svelte';
  import type { CagedLabelType } from '$lib/state/caged-view';
  import { tick } from 'svelte';
  import { onMount } from 'svelte';
  import CagedControls from './CagedControls.svelte';
  import CagedFocusControls from './CagedFocusControls.svelte';
  import CagedListen from './CagedListen.svelte';
  import CagedLayerList from './CagedLayerList.svelte';
  import CagedTriadSets from './CagedTriadSets.svelte';
  import ChoiceGroup from '../ChoiceGroup.svelte';

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

  // Rotate hint (016 US4): shown once on a portrait phone, recorded the moment it appears.
  let vw = $state(0);
  let vh = $state(0);
  let hintOpen = $state(false);
  $effect(() => {
    if (!isPhonePortrait(vw, vh)) hintOpen = false;
    else if (!hintOpen && !preferences.rotateHintShown) {
      hintOpen = true;
      preferences.markRotateHintShown();
    }
  });

  // Solfège note (021 US5): shapes keep letter names; explained once, recorded the moment it appears.
  let noteOpen = $state(false);
  $effect(() => {
    if (notation.effective === 'solfege' && !preferences.cagedNoteShown) {
      noteOpen = true;
      preferences.markCagedNoteShown();
    }
  });

  const labels = $derived<readonly { value: CagedLabelType; label: string }[]>([
    { value: 'interval', label: m.caged_label_intervals() },
    { value: 'name', label: m.caged_label_note_names() }
  ]);

  async function viewInStandard() {
    caged.viewInStandard();
    await tick();
    document.getElementById('caged-zone-c')?.focus();
  }

  // Test-only hook: log activations for e2e assertions (dead code in production).
  function onactivate(p: Position) {
    caged.activate(p);
    if (__FM_FAULT_INJECTION__) (globalThis.__fmFretboardEvents ??= []).push({ ...p });
  }
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<section class="b" data-print="omit" aria-labelledby="caged-zone-b">
  <h2 id="caged-zone-b">{m.zone_main_controls()}</h2>
  <CagedControls
    state={caged.state}
    switchTo={caged.display.switchTo}
    onroot={(pc) => caged.selectRoot(pc)}
    onquality={(q) => caged.setQuality(q)}
    onswitch={() => caged.switchSpelling()}
  >
    {#snippet more()}
      <CagedFocusControls
        letter={caged.state.focus?.letter ?? null}
        drawn={caged.display.drawnLetters}
        disabled={caged.display.tuningClass === 'non-compatible'}
        onchoose={(c) => caged.chooseShape(c)}
      />
    {/snippet}
  </CagedControls>
  <CagedListen
    enabled={caged.display.listen.enabled}
    reason={caged.display.listen.reason}
    listening={caged.listening}
    onlisten={() => caged.listen()}
    tempo={caged.tempo}
    ontempo={(t) => caged.setTempo(t)}
  />
  <p class="key">{caged.display.keyName}</p>
</section>
<section class="c" aria-labelledby="caged-zone-c">
  <h2 id="caged-zone-c" tabindex="-1">{m.zone_fretboard()}</h2>
  <FitNotice />
  {#if caged.display.model || fixture}
    <Fretboard
      instrument={caged.instrument}
      model={fixture ?? caged.display.model ?? undefined}
      {onactivate}
      ontag={(id) => caged.toggleTag(id)}
      pulses={playback.pulses}
      fit={fit.effective}
      printing={print.active}
      onfit={fit.handle}
      takeAnchor={fit.takeAnchor}
    />
    {#if caged.display.fitNote}
      <p class="fit" role="status">{caged.display.fitNote}</p>
    {/if}
  {:else}
    <div class="unsupported">
      <p role="status">{caged.display.unsupportedNotice}</p>
      <div class="actions">
        <button type="button" onclick={viewInStandard}>{m.caged_view_in_standard()}</button>
        <button type="button" onclick={() => openTriadsFromCaged()}>{m.caged_go_to_triads()}</button
        >
      </div>
    </div>
  {/if}
</section>

<SidePanels>
  {#snippet actions()}
    <section class="e" data-print="omit" aria-labelledby="caged-zone-e">
      <h2 id="caged-zone-e">{m.zone_actions()}</h2>
      <FitToggle />
      <ChoiceGroup
        name={m.caged_group_labels()}
        options={labels}
        current={caged.state.labelType}
        onchoose={caged.setLabelType}
      />
      <div class="steps">
        <button
          type="button"
          class="step"
          aria-disabled={caged.display.steps.previous ? undefined : 'true'}
          onclick={() => caged.step(-1)}>{m.caged_previous_shape()}</button
        >
        <button
          type="button"
          class="step"
          aria-disabled={caged.display.steps.next ? undefined : 'true'}
          onclick={() => caged.step(1)}>{m.caged_next_shape()}</button
        >
      </div>
      {#if instrument.adjustedIn === 'caged'}
        <Notice message={m.instrument_adjusted()} ondismiss={instrument.dismissAdjusted} />
      {/if}
      {#if noteOpen}
        <Notice
          message={m.caged_solfege_note({
            c: solfegeName('C'),
            a: solfegeName('A'),
            g: solfegeName('G'),
            e: solfegeName('E'),
            d: solfegeName('D')
          })}
          ondismiss={() => (noteOpen = false)}
        />
      {/if}
      {#if hintOpen}
        <Notice message={m.caged_rotate_hint()} ondismiss={() => (hintOpen = false)} />
      {/if}
    </section>
  {/snippet}
  {#snippet details()}
    <div class="d">
      <ContextZone summary={caged.display.summary}>
        <CagedLayerList
          switches={caged.switches}
          extraSampleShown={caged.display.extraSampleShown}
          ontoggle={(layer) => caged.toggleLayer(layer)}
        />
        {#if caged.display.triad}
          <CagedTriadSets
            triad={caged.display.triad}
            onselect={(set) => caged.selectTriadSet(set)}
            onopen={() => openTriadsFromCagedTriad()}
          />
        {/if}
        <button
          type="button"
          class="conn-switch"
          role="switch"
          aria-checked={caged.state.connections}
          aria-disabled={caged.display.tuningClass === 'non-compatible' ? 'true' : undefined}
          onclick={() => {
            if (caged.display.tuningClass !== 'non-compatible')
              caged.setConnections(!caged.state.connections);
          }}
        >
          <span class="track" aria-hidden="true"><span class="thumb"></span></span>
          {m.caged_show_connections()}
          <span class="state" aria-hidden="true"
            >{caged.state.connections ? m.caged_switch_on() : m.caged_switch_off()}</span
          >
        </button>
        <button type="button" onclick={() => caged.reset()}>{m.caged_reset()}</button>
      </ContextZone>
    </div>
  {/snippet}
</SidePanels>

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

  .unsupported {
    margin: var(--space-3) 0 0;
    padding-inline: var(--space-4);
    color: var(--color-text);
  }

  .unsupported p {
    margin: 0 0 var(--space-3);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .actions button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-4);
    font: inherit;
  }

  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .step {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding-inline: var(--space-4);
    font: inherit;
  }

  .step[aria-disabled='true'] {
    color: var(--color-disabled-text);
    border-color: var(--color-disabled-border);
    cursor: not-allowed;
  }

  .conn-switch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    margin-inline-end: var(--space-3);
    padding-inline: var(--space-4);
    font: inherit;
  }

  .track {
    position: relative;
    inline-size: 2.25rem;
    block-size: 1.25rem;
    border: var(--border-width) solid currentColor;
    border-radius: 999px;
    flex: none;
  }

  .thumb {
    position: absolute;
    inset-block: 2px;
    inset-inline-start: 2px;
    inline-size: calc(1.25rem - 4px - 2 * var(--border-width));
    background: currentColor;
    border-radius: 50%;
  }

  .conn-switch[aria-checked='true'] .thumb {
    inset-inline-start: auto;
    inset-inline-end: 2px;
  }

  .conn-switch[aria-checked='true'] .track {
    background: var(--color-surface);
  }

  .state {
    font-weight: 600;
  }

  .conn-switch[aria-disabled='true'] {
    color: var(--color-disabled-text);
    border-color: var(--color-disabled-border);
    cursor: not-allowed;
  }

  h2:focus {
    outline: none;
  }

  .d {
    grid-area: d;
    padding: var(--space-4);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    min-inline-size: 0;
  }
  .e {
    grid-area: e;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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
