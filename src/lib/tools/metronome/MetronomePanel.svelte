<script lang="ts">
  import { tick } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { maybeFault } from '$lib/shell/fault';
  import Notice from '$lib/shell/Notice.svelte';
  import { matchMetronomeKey } from '$lib/state/metronome-keys';
  import { metronome } from '$lib/state/metronome.svelte';
  import { toShortcutEvent } from '$lib/state/shortcuts';
  import ModeTabs from './ModeTabs.svelte';
  import CountInSettings from './CountInSettings.svelte';
  import RunControls from './RunControls.svelte';
  import StatusBox from './StatusBox.svelte';
  import RatioSettings from './RatioSettings.svelte';
  import ValueRow from './ValueRow.svelte';

  maybeFault('metronome');

  let startButton: HTMLButtonElement | undefined = $state();
  let mainButton: HTMLButtonElement | undefined = $state();

  /** The Start button leaves the page: keep keyboard focus inside the panel (on Pause). */
  async function start(): Promise<void> {
    metronome.toggle();
    await tick();
    mainButton?.focus();
  }

  async function reset(): Promise<void> {
    metronome.reset();
    await tick();
    startButton?.focus();
  }

  /** An open sound or language disclosure owns Escape (it closes itself first). */
  function disclosureOpen(): boolean {
    return document.querySelector('.app-bar [aria-expanded="true"]') !== null;
  }

  function onKeydown(event: KeyboardEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const action = matchMetronomeKey(
      {
        ...toShortcutEvent(event),
        targetActivates:
          target?.closest('button, a[href], summary, [role="button"], [role="switch"]') != null
      },
      { phase: metronome.phase, disclosureOpen: disclosureOpen() }
    );
    if (action === null) return;
    event.preventDefault();
    if (action === 'toggle') {
      if (metronome.phase === 'settings') void start();
      else metronome.toggle();
    } else void reset();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<section class="panel" data-mode={metronome.mode} data-phase={metronome.phase} data-print="omit">
  <ModeTabs mode={metronome.mode} onselect={(mode) => metronome.selectMode(mode)} />

  <div
    class="mode-panel"
    role="tabpanel"
    id="metronome-mode-panel"
    aria-labelledby="metronome-tab-{metronome.mode}"
  >
    {#if metronome.phase === 'settings'}
      <ValueRow
        id="metronome-bpm"
        label={m.metronome_bpm_label()}
        min={30}
        max={300}
        value={metronome.current.bpm}
        valuetext="{metronome.current.bpm} {m.metronome_bpm_unit()}"
        decreaseLabel={m.metronome_bpm_decrease()}
        increaseLabel={m.metronome_bpm_increase()}
        onset={(v) => metronome.setBpm(v)}
        onstep={(d) => metronome.stepBpm(d)}
      />
      <ValueRow
        id="metronome-beats"
        label={m.metronome_beats_label()}
        min={1}
        max={16}
        value={metronome.current.beats}
        valuetext={String(metronome.current.beats)}
        decreaseLabel={m.metronome_beats_decrease()}
        increaseLabel={m.metronome_beats_increase()}
        onset={(v) => metronome.setBeats(v)}
        onstep={(d) => metronome.stepBeats(d)}
      />
      <CountInSettings
        settings={metronome.current}
        repeat={metronome.mode === 'ratios'}
        onswitch={(on) => metronome.setCountIn(on)}
        oninitialset={(v) => metronome.setInitialCountIn(v)}
        oninitialstep={(d) => metronome.stepInitialCountIn(d)}
        onrepeatset={(v) => metronome.setRepeatCountIn(v)}
        onrepeatstep={(d) => metronome.stepRepeatCountIn(d)}
      />
      {#if metronome.mode === 'ratios'}
        <RatioSettings
          settings={metronome.settings}
          onswitch={(on) => metronome.setRatio(on)}
          onloop1={metronome.setSubdivision}
          onloop2={metronome.setLoop2}
        />
      {/if}
      <button type="button" class="start" bind:this={startButton} onclick={start}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
          ><path d="M7 4l13 8-13 8z" /></svg
        >
        {metronome.mode === 'plain' ? m.metronome_start_plain() : m.metronome_start()}
      </button>
    {:else}
      <StatusBox
        beat={metronome.beat}
        beats={metronome.current.beats}
        bpm={metronome.current.bpm}
        sub={metronome.sub}
        dots={metronome.dots}
        countIn={metronome.countIn}
      />
      <RunControls
        phase={metronome.phase}
        ontoggle={() => metronome.toggle()}
        onreset={reset}
        bind:main={mainButton}
      />
    {/if}
  </div>

  <div role="status" aria-live="polite" class="sr-only">{metronome.announcement}</div>

  {#if metronome.soundNotice}
    <Notice
      message={m.metronome_sound_unavailable()}
      ondismiss={() => metronome.dismissSoundNotice()}
    />
  {/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-inline-size: var(--metronome-panel-max);
    margin-inline: auto;
  }

  .mode-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .start {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    inline-size: 100%;
    min-block-size: var(--target-min);
    padding: var(--space-2) var(--space-4);
    font: inherit;
    font-weight: var(--font-weight-bold);
    color: var(--color-accent-text);
    background: var(--color-accent);
    border: var(--border-width) solid var(--color-accent);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .start svg {
    inline-size: var(--bar-icon-size);
    block-size: var(--bar-icon-size);
    fill: currentColor;
  }
</style>
