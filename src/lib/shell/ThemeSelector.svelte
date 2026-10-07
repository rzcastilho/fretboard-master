<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { theme, type ThemeChoice } from '$lib/state/theme.svelte';

  const uid = $props.id();
  const name = `theme-${uid}`;

  const CHOICES: readonly ThemeChoice[] = ['device', 'light', 'dark'];
  const LABELS: Readonly<Record<ThemeChoice, () => string>> = {
    device: () => m.theme_device(),
    light: () => m.theme_light(),
    dark: () => m.theme_dark()
  };

  function pick(event: Event & { currentTarget: HTMLInputElement }): void {
    theme.choose(event.currentTarget.value as ThemeChoice);
  }
</script>

<fieldset class="theme" data-print="omit">
  <legend>{m.theme_label()}</legend>
  <div class="options">
    {#each CHOICES as value (value)}
      <label>
        <input type="radio" {name} {value} checked={theme.choice === value} onchange={pick} />
        <span>{LABELS[value]()}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
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
