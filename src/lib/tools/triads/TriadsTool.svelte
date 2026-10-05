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
  import { noteLabel } from '$lib/notation/notation';
  import { qualityName } from '$lib/state/triads-model';
  import { instrument } from '$lib/state/instrument.svelte';
  import Notice from '$lib/shell/Notice.svelte';
  import { onMount } from 'svelte';
  import CompositionPanel from './CompositionPanel.svelte';
  import TriadsGuidance from './TriadsGuidance.svelte';
  import TriadsCompare from './TriadsCompare.svelte';
  import TriadsControls from './TriadsControls.svelte';
  import TriadsSecondary from './TriadsSecondary.svelte';
  import WideStretchMark from './WideStretchMark.svelte';

  function omittedMessage(notes: readonly Parameters<typeof noteLabel>[0][]): string {
    const list = notes.map(noteLabel).join(', ');
    return notes.length === 1
      ? m.triads_compare_omitted_one({ notes: list })
      : m.triads_compare_omitted_other({ notes: list });
  }

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

  // R-05: the tool's own notice wins and clears the adjustment notice.
  $effect(() => {
    if (triads.notice !== null && instrument.adjustedIn === 'triads') instrument.dismissAdjusted();
  });
</script>

<section class="b" aria-labelledby="triads-zone-b">
  <h2 id="triads-zone-b">{m.zone_main_controls()}</h2>
  <TriadsControls
    state={triads.state}
    instrument={triads.instrument}
    controls={triads.display.controls}
    onview={triads.setView}
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
    ontag={(id) => triads.selectTag(id)}
    pulses={playback.pulses}
  />
  <TriadsGuidance
    shape={triads.display.shape}
    anotherSet={triads.display.anotherSet}
    onanotherset={triads.anotherSet}
    seeAllNotes={triads.display.seeAllNotes}
    onseeallnotes={triads.seeAllNotes}
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
  {#if instrument.adjustedIn === 'triads' && triads.notice === null}
    <Notice message={m.instrument_adjusted()} ondismiss={instrument.dismissAdjusted} />
  {/if}
  {#if triads.notice?.kind === 'compare-swapped'}
    {#key triads.notice}
      <Notice
        message={m.triads_compare_swapped({ quality: qualityName(triads.notice.quality) })}
        ondismiss={triads.dismissNotice}
      />
    {/key}
  {/if}
  {#if triads.notice?.kind === 'compare-off-for-shape'}
    {#key triads.notice}
      <Notice message={m.triads_notice_compare_off_for_shape()} ondismiss={triads.dismissNotice} />
    {/key}
  {/if}
  {#if triads.notice?.kind === 'compare-omitted'}
    {#key triads.notice}
      <Notice message={omittedMessage(triads.notice.notes)} ondismiss={triads.dismissNotice} />
    {/key}
  {/if}
  <TriadsCompare
    compare={triads.display.compare}
    onsetcompare={triads.setCompare}
    oncomparequality={triads.setCompareQuality}
  />
  <TriadsSecondary
    labelType={triads.state.labelType}
    onlabeltype={triads.setLabelType}
    octave={triads.display.octave}
    onoctaveup={triads.octaveUp}
    onoctavedown={triads.octaveDown}
    listen={triads.display.listen}
    onlisten={triads.listen}
    compareOn={triads.display.compare.on && triads.display.compare.offered}
    listenComparison={triads.display.listenComparison}
    onlistencomparison={triads.listenComparison}
    onreset={triads.reset}
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
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .e h2 {
    margin: 0;
  }

  /* The flex gap already spaces the zone's children. */
  .e :global(.notice) {
    margin-block-end: 0;
  }
</style>
