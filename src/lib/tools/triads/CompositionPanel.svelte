<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { intervalLabel, noteLabel, spokenNote } from '$lib/notation/notation';
  import {
    functionName,
    inversionName,
    qualityName,
    stackingName,
    type Composition,
    type NoteEntry
  } from '$lib/state/triads-model';

  interface Props {
    composition: Composition;
    /** Toggle the root spelling (suggestion button and Switch command). */
    onswitch?: () => void;
  }

  let { composition, onswitch }: Props = $props();

  const name = $derived(
    composition.name.inversion === null
      ? m.triads_name_no_inversion({
          root: noteLabel(composition.name.root),
          quality: qualityName(composition.name.quality)
        })
      : m.triads_name({
          root: noteLabel(composition.name.root),
          quality: qualityName(composition.name.quality),
          inversion: inversionName(composition.name.inversion)
        })
  );
  const spoken = (n: NoteEntry) => `${spokenNote(n.spelling)}, ${functionName(n.function)}`;
  const intervals = $derived(composition.intervals.map(intervalLabel).join(' – '));
  const lowToHigh = $derived(
    (composition.lowToHigh ?? [])
      .map((n) =>
        m.triads_low_to_high_entry({
          note: noteLabel(n.spelling),
          function: functionName(n.function)
        })
      )
      .join(', ')
  );
</script>

<section aria-labelledby="triads-composition">
  <h2 id="triads-composition">{m.triads_panel_composition()}</h2>
  <p class="name">{name}</p>
  <h3>{m.triads_panel_notes()}</h3>
  <ul aria-label={m.triads_panel_notes()}>
    {#each composition.notes as n (n.function)}
      <li aria-label={spoken(n)}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          data-function={n.function}
          aria-hidden="true"
        >
          {#if n.function === 'root'}
            <rect x="2" y="2" width="12" height="12" rx="3" />
          {:else if n.function === 'third'}
            <circle cx="8" cy="8" r="6" />
          {:else}
            <path d="M8 1 L15 8 L8 15 L1 8 Z" />
          {/if}
        </svg>
        <span aria-hidden="true">{noteLabel(n.spelling)}</span>
      </li>
    {/each}
  </ul>
  <h3>{m.triads_panel_intervals()}</h3>
  <p>{intervals}</p>
  <h3>{m.triads_panel_stacking()}</h3>
  <p>{stackingName(composition.stacking)}</p>
  {#if composition.lowToHigh !== null}
    <h3>{m.triads_panel_low_to_high()}</h3>
    <p>{lowToHigh}</p>
  {/if}
  {#if composition.symmetric}
    <p class="note">{m.triads_symmetry()}</p>
  {/if}
  {#if composition.characteristic === 'b5'}
    <p class="note">{m.triads_characteristic_flat_five()}</p>
  {/if}
  {#if composition.soundsAs.length > 0}
    <ul class="sounds-as" aria-label={m.triads_panel_sounds_as()}>
      {#each composition.soundsAs as line (line.written.letter)}
        <li
          aria-label={m.triads_sounds_as({
            written: spokenNote(line.written),
            sounds: spokenNote(line.sounds)
          })}
        >
          <span aria-hidden="true">
            {m.triads_sounds_as({
              written: noteLabel(line.written),
              sounds: noteLabel(line.sounds)
            })}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
  {#if composition.suggestion || composition.switchTo}
    <div class="spelling">
      {#if composition.suggestion}
        <button type="button" onclick={() => onswitch?.()}>
          {m.triads_suggestion({ root: noteLabel(composition.suggestion) })}
        </button>
      {/if}
      {#if composition.switchTo}
        <button type="button" onclick={() => onswitch?.()}>
          {m.triads_switch({ root: noteLabel(composition.switchTo) })}
        </button>
      {/if}
    </div>
  {/if}
</section>

<style>
  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: var(--font-size-md);
  }

  h3 {
    margin-block-start: var(--space-2);
    font-size: var(--font-size-sm, 0.875em);
  }

  .name {
    font-weight: 700;
    font-size: var(--font-size-lg, 1.125em);
  }

  ul {
    display: flex;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-weight: 600;
  }

  svg {
    fill: var(--color-text);
  }
</style>
