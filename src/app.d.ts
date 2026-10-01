declare global {
  const __APP_VERSION__: string;
  const __FM_FAULT_INJECTION__: boolean;

  var __fmFault: Partial<Record<'notes' | 'triads', number>> | undefined;

  /** Test-only (`__FM_FAULT_INJECTION__`): name of the fixture the fretboard zone should render. */
  var __fmFretboardFixture:
    'all-markers' | 'labels-spelled' | 'highlight-far' | 'highlight-split' | 'empty' | undefined;
  /** Test-only (`__FM_FAULT_INJECTION__`): log of fretboard position activations. */
  var __fmFretboardEvents: { string: number; fret: number }[] | undefined;

  /** Test-only (`__FM_FAULT_INJECTION__`): forces the audio engine to fail at 'context' or 'synth'. */
  var __fmAudioFault: 'context' | 'synth' | undefined;
  /** Test-only (`__FM_FAULT_INJECTION__`): log of audio engine events. */
  var __fmAudioLog: import('$lib/audio/types').AudioLogEntry[] | undefined;

  namespace App {}
}

export {};
