<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
</script>

<p class="wide-stretch">
  <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true" focusable="false">
    <path d="M1 8 H19 M4 4 L1 8 L4 12 M16 4 L19 8 L16 12" />
  </svg>
  <span>{m.triads_wide_stretch()}</span>
</p>

<style>
  .wide-stretch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2) 0 0;
    font-weight: 600;
  }

  svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
