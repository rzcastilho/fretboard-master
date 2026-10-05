<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { defaultSpelling, flatSpelling, noteLabel, spokenNote } from '$lib/notation/notation';

  interface Props {
    /** Selected pitch classes (0–11, C = 0). */
    selected: readonly number[];
    ontoggle: (pc: number) => void;
    /** Group name; defaults to the Notes label. */
    label?: string;
  }

  let { selected, ontoggle, label }: Props = $props();

  const notes = Array.from({ length: 12 }, (_, pc) => {
    const sharp = defaultSpelling(pc);
    const altered = sharp.accidental !== 0;
    const flat = flatSpelling(pc);
    return {
      pc,
      altered,
      label: altered ? `${noteLabel(sharp)} / ${noteLabel(flat)}` : noteLabel(sharp),
      name: altered
        ? m.notes_selector_altered_spoken({ sharp: spokenNote(sharp), flat: spokenNote(flat) })
        : spokenNote(sharp)
    };
  });
</script>

<div class="selector" role="group" aria-label={label ?? m.notes_selector_label()}>
  {#each notes as n (n.pc)}
    <button
      type="button"
      class:natural={!n.altered}
      class:altered={n.altered}
      aria-pressed={selected.includes(n.pc)}
      aria-label={n.name}
      onclick={() => ontoggle(n.pc)}
    >
      {n.label}
    </button>
  {/each}
</div>

<style>
  /* Track floor is rem-based, so it grows with the user's text size: at 100 % six keys fit a
     320 px row; at 200 % they wrap to more rows instead of overlapping (US4). */
  .selector {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(2.2rem, 1fr));
    gap: var(--space-2);
  }

  button {
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: var(--space-1);
    font: inherit;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
    color: var(--color-text);
    border: var(--border-width) solid var(--color-text);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  button.natural {
    background: var(--color-surface);
  }

  button.altered {
    background: transparent;
    border-style: dashed;
    font-size: var(--font-size-sm);
  }

  button[aria-pressed='true'] {
    background: var(--color-note-highlight);
    color: var(--color-note-highlight-label);
    border-style: solid;
  }
</style>
