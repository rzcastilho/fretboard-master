<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Fretboard from '$lib/fretboard/Fretboard.svelte';
  import { fixtureModel } from '$lib/fretboard/fixtures';
  import { fixtureInstrument } from '$lib/instrument/fixtures';
  import { STANDARD_GUITAR } from '$lib/instrument/instrument';
  import type { DisplayModel } from '$lib/fretboard/types';
  import type { Position } from '$lib/instrument/instrument';
  import { defaultSpelling, noteList } from '$lib/notation/notation';
  import Notice from '$lib/shell/Notice.svelte';
  import NoteSelector from '$lib/tools/NoteSelector.svelte';
  import DetectedTriad from '$lib/tools/notes/DetectedTriad.svelte';
  import NotesActions from '$lib/tools/notes/NotesActions.svelte';
  import RegionFilter from '$lib/tools/notes/RegionFilter.svelte';
  import StringFilter from '$lib/tools/notes/StringFilter.svelte';
  import PositionCard from '$lib/tools/notes/PositionCard.svelte';
  import { maybeFault } from '$lib/shell/fault';
  import { openTriadsFromNote, viewAsTriad } from '$lib/state/links.svelte';
  import { notes } from '$lib/state/notes.svelte';
  import { playback } from '$lib/state/playback.svelte';
  import { onMount } from 'svelte';

  // Test-only hook: throws during render so the boundary can be exercised (dead code in production).
  const guard = () => maybeFault('notes');
  guard();

  // Test-only hook: render a named fixture model once on mount (dead code in production).
  let fixture: DisplayModel | undefined = $state();
  onMount(() => {
    if (__FM_FAULT_INJECTION__) {
      fixture = fixtureModel(globalThis.__fmFretboardFixture);
      const inst = fixtureInstrument(globalThis.__fmInstrument);
      if (inst !== STANDARD_GUITAR) {
        notes.useInstrument(inst);
        notes.reset(); // fresh view for the fixture instrument (all of its strings active)
      }
    }
  });

  const model = $derived(fixture ?? notes.display.model);

  // Region notice: shown while selected notes fall outside the filters (FR-015). Dismissal holds
  // until the condition goes false, so it reappears the next time it becomes true.
  const missing = $derived(notes.display.missing);
  let noticeDismissed = $state(false);
  $effect(() => {
    if (missing.length === 0) noticeDismissed = false;
  });
  const noticeMessage = $derived(
    missing.length > 3
      ? m.notes_notice_missing_count({ count: missing.length })
      : m.notes_notice_missing({ notes: noteList(missing.map(defaultSpelling)) })
  );

  let board: { focusPosition(p: Position): void } | undefined = $state();

  // Activation plays the note and opens the card; focus stays on the tapped cell.
  function onactivate(p: Position) {
    notes.activate(p);
    if (__FM_FAULT_INJECTION__) (globalThis.__fmFretboardEvents ??= []).push({ ...p });
  }

  function closeCard() {
    const card = notes.state.card;
    if (card === null) return;
    notes.closeCard();
    board?.focusPosition(card);
  }

  // Scoped to zones C and D (no global Escape listener, R-10).
  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || e.defaultPrevented || notes.state.card === null) return;
    e.preventDefault();
    closeCard();
  }
</script>

<section class="b" aria-labelledby="notes-zone-b">
  <h2 id="notes-zone-b">{m.notes_zone_selector()}</h2>
  <NoteSelector selected={notes.state.selection} ontoggle={notes.toggleNote} />
  <DetectedTriad detected={notes.display.detected} onview={viewAsTriad} />
</section>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions (Escape closes the card; cells are the interactive stops) -->
<section class="c" aria-labelledby="notes-zone-c" {onkeydown}>
  <h2 id="notes-zone-c">{m.notes_zone_fretboard()}</h2>
  {#if missing.length > 0 && !noticeDismissed}
    <Notice
      message={noticeMessage}
      ondismiss={() => (noticeDismissed = true)}
      action={{ label: m.notes_notice_widen(), onclick: notes.widenRegion }}
    />
  {/if}
  {#if notes.display.emptyGuidance}
    <Notice message={m.notes_notice_empty()} />
  {/if}
  <Fretboard
    bind:this={board}
    instrument={notes.instrument}
    {model}
    {onactivate}
    pulses={playback.pulses}
  />
</section>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions (Escape closes the card) -->
<section class="d" aria-labelledby="notes-zone-d" {onkeydown}>
  <h2 id="notes-zone-d">{m.notes_zone_details()}</h2>
  {#if notes.display.cardInfo}
    <PositionCard
      info={notes.display.cardInfo}
      onaddnote={notes.addNote}
      ontriads={openTriadsFromNote}
      onclose={closeCard}
    />
  {/if}
  <StringFilter
    instrument={notes.instrument}
    active={notes.state.activeStrings}
    ontoggle={notes.toggleString}
  />
  <RegionFilter
    fretCount={notes.instrument.fretCount}
    region={notes.state.region}
    onstart={notes.setRegionStart}
    onend={notes.setRegionEnd}
    onshortcut={notes.setRegionShortcut}
  />
</section>
<section class="e" aria-labelledby="notes-zone-e">
  <h2 id="notes-zone-e">{m.notes_zone_actions()}</h2>
  <NotesActions
    background={notes.state.background}
    labelType={notes.state.labelType}
    onbackground={notes.setBackground}
    onlabeltype={notes.setLabelType}
    hideNames={notes.state.hideNames}
    listen={notes.display.listen}
    onhidenames={notes.setHideNames}
    onlisten={notes.listen}
    onclear={notes.clear}
    onreset={notes.reset}
  />
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
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .d h2 {
    margin: 0;
  }
  .e {
    grid-area: e;
  }
</style>
