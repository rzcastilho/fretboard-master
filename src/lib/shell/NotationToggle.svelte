<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { solfegeName } from '$lib/notation/notation';
  import { NOTATIONS, type Notation } from '$lib/notation/policy';
  import { notation } from '$lib/state/notation.svelte';
  import { shortcuts } from '$lib/state/shortcuts.svelte';
  import BarIcon from './BarIcon.svelte';

  /** Each option previews its own notation, whichever one is active. */
  const SAMPLE: Readonly<Record<Notation, () => string>> = {
    letters: () => 'C D E',
    solfege: () => `${solfegeName('C')} ${solfegeName('D')} ${solfegeName('E')}`
  };
</script>

<div
  class="toggle"
  data-print="omit"
  role="group"
  aria-label={m.notation_label()}
  aria-keyshortcuts={shortcuts.enabled ? 'N' : undefined}
>
  {#each NOTATIONS as value (value)}
    <button
      type="button"
      class="option"
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
</style>
