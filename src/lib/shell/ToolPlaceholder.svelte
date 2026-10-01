<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { maybeFault } from './fault';
  import type { ToolId } from './tools';

  let { tool }: { tool: ToolId } = $props();

  // Test-only hook: throws during render so the boundary can be exercised (dead code in production).
  const guard = () => maybeFault(tool);
  guard();
</script>

<section class="b" aria-labelledby="zone-b">
  <h2 id="zone-b">{m.zone_main_controls()}</h2>
  <p>{m.placeholder_main_controls()}</p>
</section>
<section class="c" aria-labelledby="zone-c">
  <h2 id="zone-c">{m.zone_fretboard()}</h2>
  <p>{m.placeholder_fretboard()}</p>
</section>
<section class="d" aria-labelledby="zone-d">
  <h2 id="zone-d">{m.zone_context_panel()}</h2>
  <p>{m.placeholder_context_panel()}</p>
</section>
<section class="e" aria-labelledby="zone-e">
  <h2 id="zone-e">{m.zone_actions()}</h2>
  <p>{m.placeholder_actions()}</p>
</section>

<style>
  section {
    padding: var(--space-4);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    min-inline-size: 0;
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-md);
  }

  p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .b {
    grid-area: b;
  }
  .c {
    grid-area: c;
  }
  .d {
    grid-area: d;
  }
  .e {
    grid-area: e;
  }
</style>
