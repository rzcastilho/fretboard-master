<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { SHORTCUTS, type ShortcutAction } from '$lib/state/shortcuts';
  import { shortcuts } from '$lib/state/shortcuts.svelte';

  const ACTIONS: Record<ShortcutAction, () => string> = {
    listen: m.shortcuts_listen,
    next: m.shortcuts_next,
    previous: m.shortcuts_previous,
    labels: m.shortcuts_labels,
    notation: m.shortcuts_notation
  };

  const SPOKEN: Partial<Record<string, () => string>> = {
    '.': m.shortcuts_key_period,
    ',': m.shortcuts_key_comma
  };
</script>

<dl>
  {#each SHORTCUTS as shortcut (shortcut.key)}
    {@const spoken = SPOKEN[shortcut.key]}
    <div>
      <dt>
        {#if spoken}
          <kbd
            ><span aria-hidden="true">{shortcut.key}</span><span class="sr-only">{spoken()}</span
            ></kbd
          >
        {:else}
          <kbd>{shortcut.key}</kbd>
        {/if}
      </dt>
      <dd>{ACTIONS[shortcut.action]()}</dd>
    </div>
  {/each}
</dl>

<label class="toggle-row">
  <input
    type="checkbox"
    role="switch"
    checked={shortcuts.enabled}
    onchange={(event) => shortcuts.choose(event.currentTarget.checked)}
  />
  <span>{m.shortcuts_switch()}</span>
</label>
<p class="hint">{m.shortcuts_switch_hint()}</p>

<style>
  dl {
    display: grid;
    gap: var(--space-2);
    margin: 0 0 var(--space-3);
  }

  dl div {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2) var(--space-3);
  }

  dt {
    min-inline-size: var(--space-6);
  }

  dd {
    margin: 0;
  }

  kbd {
    display: inline-block;
    min-inline-size: var(--space-5);
    padding: var(--space-1) var(--space-2);
    font: inherit;
    font-weight: var(--font-weight-medium);
    text-align: center;
    border: var(--border-width) solid currentColor;
    border-radius: var(--radius-md);
  }

  .toggle-row {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: var(--target-min);
    cursor: pointer;
  }

  .toggle-row input {
    inline-size: var(--space-5);
    block-size: var(--space-5);
    margin: 0;
  }

  .hint {
    margin: var(--space-1) 0 0;
  }
</style>
