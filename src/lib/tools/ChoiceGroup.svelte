<script lang="ts" generics="T extends string">
  interface Props {
    /** Group name: visible label and accessible name. */
    name: string;
    options: readonly { value: T; label: string; ariaLabel?: string }[];
    current: T;
    onchoose: (value: T) => void;
  }

  let { name, options, current, onchoose }: Props = $props();

  const NEXT: Readonly<Record<string, number>> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1
  };

  // Roving tabindex: arrows move focus and select (wrapping); Tab is left alone.
  function onkey(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const index = options.findIndex((o) => o.value === current);
    let next: number;
    if (e.key in NEXT) next = (index + NEXT[e.key] + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    onchoose(options[next].value);
    const radios = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
      '[role="radio"]'
    );
    radios?.[next]?.focus();
  }
</script>

<div class="group" role="radiogroup" aria-label={name}>
  <span class="name" aria-hidden="true">{name}</span>
  {#each options as o (o.value)}
    <button
      type="button"
      role="radio"
      aria-checked={current === o.value}
      aria-label={o.ariaLabel}
      tabindex={current === o.value ? 0 : -1}
      onclick={() => onchoose(o.value)}
      onkeydown={onkey}
    >
      {o.label}
    </button>
  {/each}
</div>

<style>
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }

  .name {
    font-weight: 600;
    color: var(--color-text);
  }

  button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: var(--space-1) var(--space-3);
    font: inherit;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface);
    border: var(--border-width) solid var(--color-text);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  button[aria-checked='true'] {
    background: var(--color-note-highlight);
    color: var(--color-note-highlight-label);
  }
</style>
