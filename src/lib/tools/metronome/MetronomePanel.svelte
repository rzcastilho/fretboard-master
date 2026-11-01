<script lang="ts">
  import { tick } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { maybeFault } from '$lib/shell/fault';
  import Notice from '$lib/shell/Notice.svelte';
  import { matchMetronomeKey } from '$lib/state/metronome-keys';
  import { metronome } from '$lib/state/metronome.svelte';
  import { toShortcutEvent } from '$lib/state/shortcuts';
  import { shortcuts } from '$lib/state/shortcuts.svelte';
  import AtTargetSelect from './AtTargetSelect.svelte';
  import ModeTabs from './ModeTabs.svelte';
  import CountInSettings from './CountInSettings.svelte';
  import RunControls from './RunControls.svelte';
  import StatusBox from './StatusBox.svelte';
  import SubdivisionSelect from './SubdivisionSelect.svelte';
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

  /** Focus Start Training when a Stop run ends, never on mount (plan.md note 5). */
  let seenFinished = metronome.finished;
  $effect(() => {
    const n = metronome.finished;
    if (n === seenFinished) return;
    seenFinished = n;
    void tick().then(() => startButton?.focus());
  });

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
      {
        phase: metronome.phase,
        disclosureOpen: disclosureOpen(),
        mode: metronome.mode,
        shortcuts: shortcuts.enabled
      }
    );
    if (action === null) return;
    event.preventDefault();
    if (action === 'tap') metronome.tapTempo();
    else if (action === 'toggle') {
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
      {#if metronome.mode !== 'speed'}
        <ValueRow
          id="metronome-bpm"
          label={m.metronome_bpm_label()}
          min={30}
          max={300}
          value={metronome.bpm}
          valuetext="{metronome.bpm} {m.metronome_bpm_unit()}"
          decreaseLabel={m.metronome_bpm_decrease()}
          increaseLabel={m.metronome_bpm_increase()}
          onset={(v) => metronome.setBpm(v)}
          onstep={(d) => metronome.stepBpm(d)}
          tap={metronome.mode === 'plain' ? () => metronome.tapTempo() : undefined}
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
        {#if metronome.mode === 'plain'}
          <SubdivisionSelect
            id="metronome-plain-subdivision"
            label={m.metronome_plain_subdivision_label()}
            value={metronome.plain.subdivision}
            options={[1, 2, 3, 4]}
            onchange={metronome.setPlainSubdivision}
          />
        {/if}
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
      {/if}
      {#if metronome.mode === 'speed'}
        <ValueRow
          id="metronome-start-bpm"
          label={m.metronome_start_bpm_label()}
          min={30}
          max={300}
          value={metronome.speed.startBpm}
          valuetext="{metronome.speed.startBpm} {m.metronome_bpm_unit()}"
          decreaseLabel={m.metronome_start_bpm_decrease()}
          increaseLabel={m.metronome_start_bpm_increase()}
          onset={(v) => metronome.setStartBpm(v)}
          onstep={(d) => metronome.stepStartBpm(d)}
        />
        <ValueRow
          id="metronome-target-bpm"
          label={m.metronome_target_bpm_label()}
          min={30}
          max={300}
          floor={metronome.speed.startBpm}
          value={metronome.speed.targetBpm}
          valuetext="{metronome.speed.targetBpm} {m.metronome_bpm_unit()}"
          decreaseLabel={m.metronome_target_bpm_decrease()}
          increaseLabel={m.metronome_target_bpm_increase()}
          onset={(v) => metronome.setTargetBpm(v)}
          onstep={(d) => metronome.stepTargetBpm(d)}
        />
        <ValueRow
          id="metronome-increment"
          label={m.metronome_increment_label()}
          min={1}
          max={20}
          value={metronome.speed.increment}
          valuetext="{metronome.speed.increment} {m.metronome_bpm_unit()}"
          decreaseLabel={m.metronome_increment_decrease()}
          increaseLabel={m.metronome_increment_increase()}
          onset={(v) => metronome.setIncrement(v)}
          onstep={(d) => metronome.stepIncrement(d)}
        />
        <ValueRow
          id="metronome-loops"
          label={m.metronome_loops_label()}
          min={1}
          max={16}
          value={metronome.speed.loops}
          valuetext={String(metronome.speed.loops)}
          decreaseLabel={m.metronome_loops_decrease()}
          increaseLabel={m.metronome_loops_increase()}
          onset={(v) => metronome.setLoops(v)}
          onstep={(d) => metronome.stepLoops(d)}
        />
        <ValueRow
          id="metronome-beats"
          label={m.metronome_beats_label()}
          min={1}
          max={16}
          value={metronome.speed.beats}
          valuetext={String(metronome.speed.beats)}
          decreaseLabel={m.metronome_beats_decrease()}
          increaseLabel={m.metronome_beats_increase()}
          onset={(v) => metronome.setBeats(v)}
          onstep={(d) => metronome.stepBeats(d)}
        />
        <CountInSettings
          settings={metronome.speed}
          repeat={true}
          onswitch={(on) => metronome.setCountIn(on)}
          oninitialset={(v) => metronome.setInitialCountIn(v)}
          oninitialstep={(d) => metronome.stepInitialCountIn(d)}
          onrepeatset={(v) => metronome.setRepeatCountIn(v)}
          onrepeatstep={(d) => metronome.stepRepeatCountIn(d)}
        />
        <AtTargetSelect
          value={metronome.speed.atTarget}
          onchange={(v) => metronome.setAtTarget(v)}
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
        bpm={metronome.bpm}
        sub={metronome.sub}
        dots={metronome.dots}
        countIn={metronome.countIn}
        speed={metronome.speedStatus}
        tap={metronome.mode === 'plain' ? () => metronome.tapTempo() : undefined}
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
