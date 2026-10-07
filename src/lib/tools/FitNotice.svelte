<script lang="ts">
  import { tick } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { fit } from '$lib/state/fit.svelte';
  import Notice from '$lib/shell/Notice.svelte';

  /** Accept: comfortable size, tapped position centred; focus follows to that fretboard cell. */
  async function accept() {
    const position = fit.notice?.position;
    fit.acceptNotice();
    if (!position) return;
    await tick();
    document
      .querySelector<SVGElement>(
        `.fretboard .cell[data-string="${position.string}"][data-fret="${position.fret}"]`
      )
      ?.focus({ preventScroll: true });
  }
</script>

{#if fit.notice}
  <Notice
    message={m.fit_small_notice()}
    ondismiss={() => fit.dismissNotice()}
    actions={[{ label: m.fit_use_comfortable(), onclick: accept }]}
  />
{/if}
