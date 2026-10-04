<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { preferences } from '$lib/state/preferences.svelte';
  import Notice from './Notice.svelte';
</script>

{#if preferences.noticeVisible}
  <Notice message={m.prefs_not_remembered()} ondismiss={() => preferences.dismissNotice()} />
{/if}
