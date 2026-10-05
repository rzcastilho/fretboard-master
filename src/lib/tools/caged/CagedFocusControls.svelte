<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { CagedFocus } from '$lib/state/caged-view';
  import type { FocusChoice } from '$lib/state/caged-focus';
  import ChoiceGroup from '../ChoiceGroup.svelte';

  type CagedShapeId = CagedFocus['letter'];

  interface Props {
    /** The focused letter, or null for "See all". */
    letter: CagedShapeId | null;
    /** Letters with a drawn occurrence; the others are aria-disabled. */
    drawn: ReadonlySet<CagedShapeId>;
    /** Whole group inert (non-compatible tuning). */
    disabled?: boolean;
    onchoose: (c: FocusChoice) => void;
  }

  let { letter, drawn, disabled = false, onchoose }: Props = $props();

  // Letters are literal parameters in every language (never translated).
  const LETTERS: readonly CagedShapeId[] = ['C', 'A', 'G', 'E', 'D'];

  const options = $derived([
    ...LETTERS.map((value) => ({
      value: value as FocusChoice,
      label: value,
      disabled: !drawn.has(value)
    })),
    { value: 'all' as FocusChoice, label: m.caged_shape_all(), disabled: false }
  ]);
</script>

<ChoiceGroup
  name={m.caged_group_shape()}
  {options}
  current={(letter ?? 'all') as FocusChoice}
  {onchoose}
  {disabled}
/>
