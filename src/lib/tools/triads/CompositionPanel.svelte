<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { intervalLabel, noteLabel, spokenNote } from '$lib/notation/notation';
  import {
    functionName,
    inversionName,
    qualityName,
    stackingName,
    type Composition,
    type NoteEntry,
    type TriadFunction
  } from '$lib/state/triads-model';

  interface Props {
    composition: Composition;
    /** Toggle the root spelling (suggestion button and Switch command). */
    onswitch?: () => void;
  }

  let { composition, onswitch }: Props = $props();

  const nameOf = (c: Composition): string =>
    c.name.inversion === null
      ? m.triads_name_no_inversion({
          root: noteLabel(c.name.root),
          quality: qualityName(c.name.quality)
        })
      : m.triads_name({
          root: noteLabel(c.name.root),
          quality: qualityName(c.name.quality),
          inversion: inversionName(c.name.inversion)
        });
  const name = $derived(nameOf(composition));
  const second = $derived(composition.comparison);
  const changed = $derived<ReadonlySet<TriadFunction>>(new Set(composition.changed));
  const SEP = ' – ';
  const FUNCTION_AT = ['root', 'third', 'fifth'] as const;
  const isChanged = (f: TriadFunction) => changed.has(f);
  const spoken = (n: NoteEntry, mark: boolean) =>
    `${spokenNote(n.spelling)}, ${functionName(n.function)}${
      mark && isChanged(n.function) ? `, ${m.triads_compare_changed()}` : ''
    }`;
  const lowToHigh = (c: Composition) =>
    (c.lowToHigh ?? [])
      .map((n) =>
        m.triads_low_to_high_entry({
          note: noteLabel(n.spelling),
          function: functionName(n.function)
        })
      )
      .join(', ');
</script>

{#snippet glyph(n: NoteEntry)}
  <svg width="16" height="16" viewBox="0 0 16 16" data-function={n.function} aria-hidden="true">
    {#if n.function === 'root'}
      <rect x="2" y="2" width="12" height="12" rx="3" />
    {:else if n.function === 'third'}
      <circle cx="8" cy="8" r="6" />
    {:else}
      <path d="M8 1 L15 8 L8 15 L1 8 Z" />
    {/if}
  </svg>
{/snippet}

{#snippet column(c: Composition, mark: boolean)}
  <h3>{m.triads_panel_notes()}</h3>
  <ul aria-label={m.triads_panel_notes()}>
    {#each c.notes as n (n.function)}
      <li aria-label={spoken(n, mark)}>
        {@render glyph(n)}
        {#if mark && isChanged(n.function)}
          <strong aria-hidden="true">{noteLabel(n.spelling)}</strong>
          <span class="changed-tag" aria-hidden="true">{m.triads_compare_changed()}</span>
        {:else}
          <span aria-hidden="true">{noteLabel(n.spelling)}</span>
        {/if}
      </li>
    {/each}
  </ul>
  <h3>{m.triads_panel_intervals()}</h3>
  {#if mark}
    <p class="interval-list">
      {#each c.intervals as id, k (k)}{#if k > 0}{SEP}{/if}{#if isChanged(FUNCTION_AT[k])}<strong
            >{intervalLabel(id)}</strong
          >
          <span class="changed-tag">{m.triads_compare_changed()}</span>{:else}<span
            >{intervalLabel(id)}</span
          >{/if}{/each}
    </p>
  {:else}
    <p>{c.intervals.map(intervalLabel).join(SEP)}</p>
  {/if}
  <h3>{m.triads_panel_stacking()}</h3>
  <p>{stackingName(c.stacking)}</p>
  {#if c.lowToHigh !== null}
    <h3>{m.triads_panel_low_to_high()}</h3>
    <p>{lowToHigh(c)}</p>
  {/if}
  {#if c.symmetric}
    <p class="note">{m.triads_symmetry()}</p>
  {/if}
  {#if c.characteristic === 'b5'}
    <p class="note">{m.triads_characteristic_flat_five()}</p>
  {/if}
  {#if c.soundsAs.length > 0}
    <ul class="sounds-as" aria-label={m.triads_panel_sounds_as()}>
      {#each c.soundsAs as line (line.written.letter)}
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
{/snippet}

<section aria-labelledby="triads-composition">
  <h2 id="triads-composition">{m.triads_panel_composition()}</h2>
  {#if second}
    <div class="columns">
      <div class="column" role="group" aria-label={name}>
        <p class="name">{name}</p>
        {@render column(composition, true)}
      </div>
      <div class="column" role="group" aria-label={nameOf(second)}>
        <p class="name">
          <svg class="swatch" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="2" y="2" width="12" height="12" rx="3" />
          </svg>
          {nameOf(second)}
        </p>
        {@render column(second, true)}
      </div>
    </div>
  {:else}
    <p class="name">{name}</p>
    {@render column(composition, false)}
  {/if}
  {#if composition.suggestion || composition.switchTo}
    <div class="spelling">
      {#if composition.suggestion}
        <button type="button" class="btn" onclick={() => onswitch?.()}>
          {m.triads_suggestion({ root: noteLabel(composition.suggestion) })}
        </button>
      {/if}
      {#if composition.switchTo}
        <button type="button" class="btn" onclick={() => onswitch?.()}>
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

  h3 {
    margin-block-start: var(--space-2);
    font-size: var(--font-size-sm);
  }

  .name {
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-lg);
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-weight: var(--font-weight-medium);
  }

  svg {
    fill: var(--color-text);
  }

  .columns {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--panel-column-min)), 1fr));
  }

  .column {
    min-inline-size: 0;
  }

  .swatch {
    vertical-align: middle;
    fill: none;
    stroke: var(--color-text);
    stroke-width: var(--marker-stroke);
    stroke-dasharray: var(--marker-dash) var(--marker-dash-gap);
  }

  .changed-tag {
    white-space: nowrap;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-normal);
    padding-inline: var(--space-1);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  strong {
    font-weight: var(--font-weight-bold);
  }
</style>
