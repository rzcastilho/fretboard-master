<script lang="ts" generics="T extends string">
  interface Props {
    /** Group name: visible label and accessible name. */
    name: string;
    options: readonly {
      value: T;
      label: string;
      ariaLabel?: string;
      disabled?: boolean;
      /** Id of an element explaining this option (e.g. why it is disabled). */
      describedby?: string;
    }[];
    current: T;
    onchoose: (value: T) => void;
    /** Greyed and inert but still focusable and announced (aria-disabled, never `disabled`). */
    disabled?: boolean;
    /** Id of a hint element describing why the group is disabled. */
    describedby?: string;
    /** Arrows, Home and End move focus onto disabled options too; only enabled ones are chosen. */
    reachDisabled?: boolean;
    /** Keys that act on this group from anywhere (aria-keyshortcuts); omitted when undefined. */
    keyshortcuts?: string;
  }

  let {
    name,
    options,
    current,
    onchoose,
    disabled = false,
    describedby,
    reachDisabled = false,
    keyshortcuts
  }: Props = $props();

  const NEXT: Readonly<Record<string, number>> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1
  };

  // Roving tabindex: arrows move focus and select (wrapping); Tab is left alone.
  function onkey(e: KeyboardEvent) {
    if (disabled) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const radios = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
      '[role="radio"]'
    );
    const focused = radios ? Array.from(radios).indexOf(e.currentTarget as HTMLElement) : -1;
    const index =
      reachDisabled && focused >= 0 ? focused : options.findIndex((o) => o.value === current);
    const n = options.length;
    const enabled = (i: number) => reachDisabled || !options[i].disabled;
    let next = -1;
    if (e.key in NEXT) {
      // Arrows skip disabled options (wrapping); none enabled → stay put.
      for (let step = 1; step <= n; step++) {
        const i = (((index + NEXT[e.key] * step) % n) + n) % n;
        if (enabled(i)) {
          next = i;
          break;
        }
      }
    } else if (e.key === 'Home') next = options.findIndex((_, i) => enabled(i));
    else if (e.key === 'End') next = options.findLastIndex((_, i) => enabled(i));
    else return;
    e.preventDefault();
    if (next < 0) return;
    if (!options[next].disabled) onchoose(options[next].value);
    radios?.[next]?.focus();
  }
</script>

<div
  class="group"
  role="radiogroup"
  aria-label={name}
  aria-keyshortcuts={keyshortcuts}
  aria-disabled={disabled ? 'true' : undefined}
  aria-describedby={disabled ? describedby : undefined}
>
  <span class="name" aria-hidden="true">{name}</span>
  {#each options as o (o.value)}
    <button
      type="button"
      class="option"
      role="radio"
      aria-checked={current === o.value}
      aria-label={o.ariaLabel}
      aria-describedby={o.describedby}
      aria-disabled={disabled || o.disabled ? 'true' : undefined}
      tabindex={current === o.value ? 0 : -1}
      onclick={() => {
        if (!disabled && !o.disabled && current !== o.value) onchoose(o.value);
      }}
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

  :global([data-arrangement='narrow']) .group {
    gap: var(--space-1);
  }

  .name {
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
  }
</style>
