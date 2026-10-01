declare global {
  const __APP_VERSION__: string;
  const __FM_FAULT_INJECTION__: boolean;

  var __fmFault: Partial<Record<'notes' | 'triads', number>> | undefined;

  /** Test-only (`__FM_FAULT_INJECTION__`): name of the fixture the fretboard zone should render. */
  var __fmFretboardFixture:
    'all-markers' | 'labels-spelled' | 'highlight-far' | 'highlight-split' | 'empty' | undefined;
  /** Test-only (`__FM_FAULT_INJECTION__`): log of fretboard position activations. */
  var __fmFretboardEvents: { string: number; fret: number }[] | undefined;

  namespace App {}
}

export {};
