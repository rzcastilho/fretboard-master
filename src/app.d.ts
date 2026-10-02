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

  /** Test-only (`__FM_FAULT_INJECTION__`): allow-listed instrument the Notes and Triads tools use instead of the default. */
  var __fmInstrument:
    'AF-7' | 'AF-21' | 'AF-4' | 'AF-1-12' | 'NC-UNISON' | 'AF-8' | 'SHORT-7' | undefined;

  namespace App {}
}

export {};
