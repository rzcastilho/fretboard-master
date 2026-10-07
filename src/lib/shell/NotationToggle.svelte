<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { solfegeName } from '$lib/notation/notation';
  import { NOTATIONS, type Notation } from '$lib/notation/policy';
  import { notation } from '$lib/state/notation.svelte';
  import BarIcon from './BarIcon.svelte';

  /** Each option previews its own notation, whichever one is active. */
  const SAMPLE: Readonly<Record<Notation, () => string>> = {
    letters: () => 'C D E',
    solfege: () => `${solfegeName('C')} ${solfegeName('D')} ${solfegeName('E')}`
  };
</script>

<div class="toggle" role="group" aria-label={m.notation_label()}>
  {#each NOTATIONS as value (value)}
    <button
      type="button"
      aria-pressed={notation.effective === value}
      onclick={() => notation.choose(value)}
      ><BarIcon name={value} /><span class="bar-label">{SAMPLE[value]()}</span></button
    >
  {/each}
</div>

<style>
  .toggle {
    display: inline-flex;
    gap: var(--space-1);
  }

  button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text);
    font: inherit;
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    background: var(--color-surface-raised);
    font-weight: 600;
  }

  button:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: 2px;
  }
</style>
