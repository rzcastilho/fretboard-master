<script lang="ts">
  let {
    id,
    label,
    min,
    max,
    floor,
    value,
    valuetext,
    decreaseLabel,
    increaseLabel,
    onset,
    onstep
  }: {
    id: string;
    label: string;
    min: number;
    max: number;
    /** The − button is disabled at `value <= floor`; defaults to `min`. */
    floor?: number;
    value: number;
    valuetext: string;
    decreaseLabel: string;
    increaseLabel: string;
    onset: (v: number) => void;
    onstep: (dir: 1 | -1) => void;
  } = $props();

  const MINUS = '−';
  const PLUS = '+';

  let input: HTMLInputElement | undefined = $state();

  /** Commit, then snap the slider back to the prop when the store clamped the value (R-07). */
  function commit(v: number): void {
    onset(v);
    if (input && Number(input.value) !== value) input.value = String(value);
  }

  /** PageUp/PageDown move by 10 (clamped by the store); Home/End stay native. */
  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'PageUp' && event.key !== 'PageDown') return;
    event.preventDefault();
    commit(value + (event.key === 'PageUp' ? 10 : -10));
  }
</script>

<div class="row">
  <label for={id}>{label}</label>
  <input
    {id}
    bind:this={input}
    type="range"
    {min}
    {max}
    step="1"
    {value}
    aria-valuetext={valuetext}
    oninput={(e: Event) => commit(Number((e.currentTarget as HTMLInputElement).value))}
    onkeydown={onKeydown}
  />
  <div class="pill">
    <button
      type="button"
      class="btn step"
      aria-label={decreaseLabel}
      title={decreaseLabel}
      disabled={value <= (floor ?? min)}
      onclick={() => onstep(-1)}>{MINUS}</button
    >
    <output aria-live="off" for={id}>{value}</output>
    <button
      type="button"
      class="btn step"
      aria-label={increaseLabel}
      title={increaseLabel}
      disabled={value >= max}
      onclick={() => onstep(1)}>{PLUS}</button
    >
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr) minmax(var(--pill-min-inline), max-content);
    align-items: center;
    gap: var(--space-3);
  }

  /* Narrow or zoomed: the slider drops to its own row so the pill never overflows. */
  @media (max-width: 30rem) {
    .row {
      grid-template-columns: minmax(0, 1fr) max-content;
    }

    input {
      grid-row: 2;
      grid-column: 1 / -1;
    }
  }

  label {
    font-weight: var(--font-weight-bold);
  }

  input {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--target-min);
    accent-color: var(--color-accent);
  }

  .pill {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-1);
    min-inline-size: var(--pill-min-inline);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
  }

  output {
    min-inline-size: 3ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .step {
    padding: 0;
    background: transparent;
    border-color: transparent;
  }
</style>
