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
  <div class="chips">
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
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
  }
</style>
