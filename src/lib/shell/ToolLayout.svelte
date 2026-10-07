<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import AppNav from './AppNav.svelte';
  import InstrumentButton from './InstrumentButton.svelte';
  import LanguagePanel from './LanguagePanel.svelte';
  import NotationToggle from './NotationToggle.svelte';
  import Notice from './Notice.svelte';
  import ShareButton from './ShareButton.svelte';
  import ShareFallback from './ShareFallback.svelte';
  import TuningBadge from './TuningBadge.svelte';
  import FailureView from './FailureView.svelte';
  import { recordFailure } from './failure';
  import NotesTool from '$lib/tools/notes/NotesTool.svelte';
  import TriadsTool from '$lib/tools/triads/TriadsTool.svelte';
  import CagedTool from '$lib/tools/caged/CagedTool.svelte';
  import { resetTool } from '$lib/state/links.svelte';
  import { openToolAddress, scheduleAddress } from '$lib/state/address.svelte';
  import { currentLink, share } from '$lib/state/share.svelte';
  import { instrument } from '$lib/state/instrument.svelte';
  import { opening } from '$lib/state/opening.svelte';
  import { startViewport, viewport } from '$lib/state/viewport.svelte';
  import { linkNoticeMessage } from './link-notice';
  import { screenTitle } from './screens';
  import SoundControl from './SoundControl.svelte';
  import StopButton from './StopButton.svelte';
  import ToolPlaceholder from './ToolPlaceholder.svelte';
  import { TOOLS, type ToolId } from './tools';

  let { tool }: { tool: ToolId } = $props();

  const landscape = $derived(viewport.arrangement === 'landscape');

  const name = $derived(TOOLS.find((t) => t.id === tool)?.name() ?? '');

  // A received link on another instrument than the stored one (023): offer Use mine / Adopt.
  const instrumentNotice = $derived(instrument.overrideNoticeFor(tool));

  // The notice and its buttons leave the page: hand focus to the tool heading.
  function resolveInstrument(choose: () => void): void {
    choose();
    document.querySelector<HTMLElement>('h1')?.focus();
  }

  // The manual-copy panel shows one link: close it as soon as the view no longer matches.
  $effect(() => {
    share.viewChanged(currentLink(tool));
  });

  // FR-014: the address bar follows the view. Opening the screen replaces it with the canonical
  // link; later changes are debounced. Only the store is read here, never `url.searchParams`.
  onMount(() => openToolAddress(tool));

  // 025: track the window so `data-arrangement` follows it. Absent at prerender (media-query
  // fallback in tokens.css), written once mounted.
  onMount(() => startViewport());
  $effect(() => {
    scheduleAddress(currentLink(tool));
  });

  // Leaving the tool (or the layout) closes it without stealing focus from the new screen.
  $effect(() => () => share.dismissFallback());
</script>

<svelte:head>
  <title>{screenTitle(tool)}</title>
</svelte:head>

<header aria-label={m.zone_app_bar()} data-landscape={landscape ? '' : undefined}>
  <AppNav current={tool} />
  <ShareButton {tool} />
  <InstrumentButton />
  <TuningBadge {tool} />
  <StopButton />
  <SoundControl />
  <NotationToggle />
  <LanguagePanel />
</header>

{#if instrumentNotice !== null}
  <div class="share-notice" data-print="omit">
    <Notice
      message={linkNoticeMessage(instrumentNotice.link, instrument.active.stringCount)}
      actions={[
        { label: m.link_use_mine(), onclick: () => resolveInstrument(() => instrument.useMine()) },
        { label: m.link_adopt(), onclick: () => resolveInstrument(() => instrument.adopt()) }
      ]}
      ondismiss={() => instrument.dismissOverrideNotice()}
    />
  </div>
{/if}

{#if opening.incomplete?.screen === tool}
  <div class="share-notice" data-print="omit">
    <Notice message={m.link_incomplete()} ondismiss={() => opening.dismissIncomplete()} />
  </div>
{/if}

{#if share.notice !== null}
  {#key share.notice.id}
    <div class="share-notice" data-print="omit">
      <Notice message={m.share_copied()} ondismiss={() => share.dismissNotice()} />
    </div>
  {/key}
{/if}

{#if share.fallback !== null}
  <div class="share-notice" data-print="omit">
    <ShareFallback href={share.fallback.href} />
  </div>
{/if}

<main>
  <h1 tabindex="-1" class:sr-only={landscape} data-print="show">{name}</h1>
  <div class="grid" data-arrangement={viewport.arrangement}>
    <svelte:boundary onerror={(e) => recordFailure(tool, e)}>
      {#if tool === 'notes'}
        <NotesTool />
      {:else if tool === 'triads'}
        <TriadsTool />
      {:else if tool === 'caged'}
        <CagedTool />
      {:else}
        <ToolPlaceholder {tool} />
      {/if}
      {#snippet failed(_error, boundaryReset)}
        <FailureView
          reset={() => {
            resetTool(tool);
            boundaryReset();
          }}
        />
      {/snippet}
    </svelte:boundary>
  </div>
</main>

<style>
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-2) var(--space-4);
  }

  .share-notice {
    padding: var(--space-2) var(--space-4) 0;
  }

  main {
    padding: var(--space-4);
  }

  h1 {
    margin: 0 0 var(--space-4);
    font-size: var(--font-size-xl);
  }

  .grid {
    display: grid;
    grid-template-areas: var(--tool-grid-areas);
    grid-template-columns: var(--tool-grid-columns);
    grid-template-rows: var(--tool-grid-rows);
    gap: var(--space-4);
  }
</style>
