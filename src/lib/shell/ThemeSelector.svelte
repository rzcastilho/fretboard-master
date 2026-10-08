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
  <div class="chips">
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
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
  }
</style>
