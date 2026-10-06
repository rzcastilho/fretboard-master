<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import {
    ACCIDENTAL_POLICIES,
    NOTATIONS,
    type AccidentalPolicy,
    type Notation
  } from '$lib/notation/policy';
  import { notation } from '$lib/state/notation.svelte';

  const uid = $props.id();
  const name = `notation-${uid}`;

  const LABELS: Readonly<Record<Notation, () => string>> = {
    letters: () => m.notation_letters(),
    solfege: () => m.notation_solfege()
  };

  const ACCIDENTAL_LABELS: Readonly<Record<AccidentalPolicy, () => string>> = {
    sharps: () => m.accidentals_sharps(),
    flats: () => m.accidentals_flats(),
    both: () => m.accidentals_both()
  };

  const accidentalsName = `accidentals-${uid}`;

  function pickAccidentals(event: Event & { currentTarget: HTMLInputElement }): void {
    notation.chooseAccidentals(event.currentTarget.value as AccidentalPolicy);
  }

  function pick(event: Event & { currentTarget: HTMLInputElement }): void {
    notation.choose(event.currentTarget.value as Notation);
  }
</script>

<fieldset>
  <legend>{m.notation_label()}</legend>
  <div class="options">
    {#each NOTATIONS as value (value)}
      <label>
        <input type="radio" {name} {value} checked={notation.effective === value} onchange={pick} />
        <span>{LABELS[value]()}</span>
      </label>
    {/each}
  </div>
</fieldset>

<fieldset>
  <legend>{m.accidentals_label()}</legend>
  <div class="options">
    {#each ACCIDENTAL_POLICIES as value (value)}
      <label>
        <input
          type="radio"
          name={accidentalsName}
          {value}
          checked={notation.accidentals === value}
          onchange={pickAccidentals}
        />
        <span>{ACCIDENTAL_LABELS[value]()}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  fieldset + fieldset {
    margin-block-start: var(--space-3);
  }

  fieldset {
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-block-end: var(--space-1);
    color: var(--color-text);
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    color: var(--color-text);
    cursor: pointer;
  }

  input {
    margin: 0;
    accent-color: var(--color-accent);
  }
</style>
