<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import HomeScreen from '$lib/shell/HomeScreen.svelte';
  import Notice from '$lib/shell/Notice.svelte';

  // R-03: show "/" in the address bar without adding a history entry; the notice stays rendered.
  // SvelteKit's replaceState() keeps `sveltekit:pageurl` pointing at the unknown path, so Back to
  // this entry would re-render the 404 view (and its notice). Rewrite the entry natively and
  // point its page URL at "/" so returning here shows plain home. Deferred: the router is not
  // ready while the page hydrates.
  onMount(() => {
    const id = setTimeout(() => {
      const home = new URL('/', location.href).href;
      history.replaceState({ ...history.state, 'sveltekit:pageurl': home }, '', home);
    }, 0);
    return () => clearTimeout(id);
  });
</script>

<HomeScreen>
  {#snippet notice()}
    <Notice message={m.notice_not_found()} ondismiss={() => {}} />
  {/snippet}
</HomeScreen>
