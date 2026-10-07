<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { LANGUAGES, type LanguageTag } from '$lib/i18n/languages';
  import { language } from '$lib/state/language.svelte';

  const uid = $props.id();
  const name = `language-${uid}`;

  function pick(event: Event & { currentTarget: HTMLInputElement }): void {
    language.choose(event.currentTarget.value as LanguageTag);
  }
</script>

<fieldset data-print="omit">
  <legend>{m.language_label()}</legend>
  <div class="options">
    {#each LANGUAGES as { tag } (tag)}
      <label lang={tag}>
        <input type="radio" {name} value={tag} checked={language.current === tag} onchange={pick} />
        <span>{m.language_autonym({}, { locale: tag })}</span>
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
