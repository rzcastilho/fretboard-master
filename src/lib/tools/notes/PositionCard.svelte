<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { labelPair, spokenPair } from '$lib/notation/notation';
  import type { CardInfo } from '$lib/state/notes-model';

  interface Props {
    info: CardInfo;
    /** "See every occurrence": add the card's pitch class to the selection. */
    onaddnote: (pc: number) => void;
    /** "Triads from this note": open Triads rooted on the card's pitch class. */
    ontriads: (pc: CardInfo['pitchClass']) => void;
    /** "CAGED in this key": open CAGED in the card's pitch class. */
    oncaged: (pc: CardInfo['pitchClass']) => void;
    onclose: () => void;
  }

  let { info, onaddnote, ontriads, oncaged, onclose }: Props = $props();

  // The card always shows both spellings of an altered note, preferred first.
  const heading = $derived({
    text: labelPair(info.pitchClass),
    spoken: spokenPair(info.pitchClass)
  });
</script>

<section class="card" aria-labelledby="notes-card-title">
  <p class="eyebrow">{m.notes_card_title()}</p>
  <h3 id="notes-card-title" aria-label={heading.spoken}>{heading.text}</h3>
  <dl>
    <div>
      <dt>{m.notes_card_octave()}</dt>
      <dd>{info.octave}</dd>
    </div>
    <div>
      <dt>{m.notes_card_string()}</dt>
      <dd>{info.position.string}</dd>
    </div>
    <div>
      <dt>{m.notes_card_fret()}</dt>
      <dd>{info.position.fret === 0 ? m.notes_card_open() : info.position.fret}</dd>
    </div>
  </dl>
  <h4>{m.notes_card_unisons_heading()}</h4>
  {#if info.unisons.length === 0}
    <p>{m.notes_card_no_unison()}</p>
  {:else}
    <ul>
      {#each info.unisons as u (`${u.string}:${u.fret}`)}
        <li>{m.notes_card_unison_entry({ string: u.string, fret: u.fret })}</li>
      {/each}
    </ul>
  {/if}
  <div class="actions">
    <button type="button" onclick={() => onaddnote(info.pitchClass)}>
      {m.notes_card_see_every()}
    </button>
    <button type="button" onclick={() => ontriads(info.pitchClass)}>
      {m.notes_card_triads_from_note()}
    </button>
    <button type="button" onclick={() => oncaged(info.pitchClass)}>
      {m.notes_card_caged()}
    </button>
    <button type="button" onclick={onclose}>{m.notes_card_close()}</button>
  </div>
</section>

<style>
  .card {
    min-inline-size: 0;
  }

  .eyebrow {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-lg);
  }

  h4 {
    margin: var(--space-2) 0 var(--space-1);
    font-size: var(--font-size-md);
  }

  dl {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin: 0;
  }

  dl div {
    display: flex;
    gap: var(--space-1);
  }

  dt {
    font-weight: 600;
  }

  dt::after {
    content: ':';
  }

  dd {
    margin: 0;
  }

  ul {
    margin: 0;
    padding-inline-start: var(--space-4);
  }

  p {
    margin: 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-block-start: var(--space-3);
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
</style>
