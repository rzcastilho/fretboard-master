declare global {
  const __APP_VERSION__: string;
  const __FM_FAULT_INJECTION__: boolean;

  var __fmFault: Partial<Record<'notes' | 'triads', number>> | undefined;

  namespace App {}
}

export {};
