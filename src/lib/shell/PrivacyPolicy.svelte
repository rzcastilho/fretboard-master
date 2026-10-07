<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
</script>

<ul>
  <li>{m.about_privacy_no_data()}</li>
  <li>{m.about_privacy_stored()}</li>
  <li>{m.about_privacy_erase()}</li>
  <li>{m.about_privacy_measured()}</li>
  <li>{m.about_privacy_errors()}</li>
  <li>{m.about_privacy_never()}</li>
  <li>{m.about_privacy_dnt()}</li>
  <li>{m.about_privacy_no_ads()}</li>
  <li>{m.about_privacy_no_permissions()}</li>
  <li>{m.about_privacy_hosting()}</li>
  <li>{m.about_privacy_share_links()}</li>
  <li>{m.about_privacy_all_ages()}</li>
</ul>

<style>
  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding-inline-start: var(--space-4);
  }
</style>
