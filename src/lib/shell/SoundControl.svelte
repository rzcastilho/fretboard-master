<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Notice from '$lib/shell/Notice.svelte';
  import { playback } from '$lib/state/playback.svelte';

  let root: HTMLElement | undefined = $state();
  let settingsButton: HTMLButtonElement | undefined = $state();
  let muteButton: HTMLButtonElement | undefined = $state();
  let open = $state(false);

  const controlState = $derived(playback.controlState);
  const unavailable = $derived(controlState === 'unavailable');
  const statusText = $derived(
    controlState === 'on'
      ? m.sound_state_on()
      : controlState === 'muted'
        ? m.sound_state_muted()
        : m.sound_state_unavailable()
  );

  function toggleMute(): void {
    if (unavailable) return;
    playback.setMuted(!playback.muted);
  }

  function dismissNotice(): void {
    playback.dismissNotice();
    muteButton?.focus();
  }

  function onVolume(event: Event): void {
    playback.setVolume(Number((event.currentTarget as HTMLInputElement).value));
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open && root?.contains(event.target as Node)) {
      open = false;
      settingsButton?.focus();
    }
  }

  function onWindowPointerdown(event: PointerEvent): void {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} onkeydown={onKeydown} />

<div class="sound" role="group" aria-label={m.sound_group_label()} bind:this={root}>
  <button
    type="button"
    class="mute"
    aria-pressed={unavailable ? undefined : playback.muted ? 'true' : 'false'}
    aria-disabled={unavailable ? 'true' : undefined}
    aria-describedby="sound-status"
    bind:this={muteButton}
    onclick={toggleMute}
  >
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9h3l5-4v14l-5-4H4z" />
      {#if controlState === 'on'}
        <path data-icon="on" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
      {:else if controlState === 'muted'}
        <path data-icon="muted" d="M16 9l5 6M21 9l-5 6" />
      {:else}
        <path data-icon="unavailable" d="M4 20L20 4" />
      {/if}
    </svg>
    <span class="sr-only">{unavailable ? m.sound_unavailable_label() : m.sound_mute()}</span>
  </button>

  <button
    type="button"
    class="settings"
    aria-expanded={open ? 'true' : 'false'}
    aria-controls="sound-panel"
    bind:this={settingsButton}
    onclick={() => (open = !open)}
  >
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2.5" fill="currentColor" />
      <circle cx="15" cy="17" r="2.5" fill="currentColor" />
    </svg>
    <span class="sr-only">{m.sound_settings()}</span>
  </button>

  <span id="sound-status" class="status sr-only">{statusText}</span>

  <div id="sound-panel" class="panel" hidden={!open}>
    <label for="sound-volume">{m.sound_volume()}</label>
    <input
      id="sound-volume"
      type="range"
      min="0"
      max="100"
      step="5"
      value={playback.volume}
      aria-valuetext={m.sound_volume_value({ value: playback.volume })}
      disabled={unavailable}
      oninput={onVolume}
    />
    <p class="help-title">{m.sound_help_title()}</p>
    <ul>
      <li>{m.sound_help_silent_mode()}</li>
      <li>{m.sound_help_app_volume()}</li>
    </ul>
  </div>

  <!-- Always present so assistive tech registers the live region before content arrives. -->
  <div class="notice-slot" role="status" aria-live="polite">
    {#if playback.noticeVisible}
      <Notice message={m.sound_unavailable_notice()} ondismiss={dismissNotice} />
    {/if}
  </div>
</div>

<style>
  .sound {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-inline-size: 0;
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--target-min);
    min-inline-size: var(--target-min);
    padding: 0;
    color: var(--color-text);
    background: transparent;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    background: var(--color-surface-raised);
  }

  button[aria-disabled='true'] {
    color: var(--color-text-muted);
    cursor: default;
  }

  .icon {
    inline-size: var(--icon-size);
    block-size: var(--icon-size);
  }

  .panel {
    flex-basis: 100%;
    display: grid;
    gap: var(--space-2);
    min-inline-size: min(100%, var(--sound-panel-width));
    padding: var(--space-3);
    background: var(--color-surface-raised);
    border: var(--border-width) solid var(--color-sound-panel-border);
    border-radius: var(--radius-md);
  }

  .panel[hidden] {
    display: none;
  }

  input[type='range'] {
    inline-size: 100%;
    min-block-size: var(--target-min);
    accent-color: var(--color-accent);
  }

  .help-title {
    margin: 0;
    font-weight: var(--font-weight-bold);
  }

  ul {
    margin: 0;
    padding-inline-start: var(--space-4);
  }

  .notice-slot {
    flex-basis: 100%;
  }

  .notice-slot:empty {
    display: none;
  }
</style>
