/**
 * Trailing-edge debounce for address-bar writes (specs/022 contracts/link-api §3, A4).
 * Plain TypeScript: timers and the write are injected, so no framework or browser global is read.
 */
export interface AddressSync {
  /** Remember `href` and write it `delayMs` after the last call. */
  schedule(href: string): void;
  /** Write the pending href now, if any. */
  flush(): void;
  /** Drop the pending href without writing. */
  cancel(): void;
}

export interface AddressSyncOptions {
  write: (href: string) => void;
  delayMs: number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export function createAddressSync(opts: AddressSyncOptions): AddressSync {
  let pending: string | null = null;
  let handle: unknown = null;

  function clear(): void {
    if (handle !== null) opts.clearTimer(handle);
    handle = null;
  }

  function emit(): void {
    clear();
    if (pending === null) return;
    const href = pending;
    pending = null;
    try {
      opts.write(href);
    } catch {
      // A failed write must never reach the UI (FR-016); the binding decides whether to retry.
    }
  }

  return {
    schedule(href) {
      pending = href;
      clear();
      handle = opts.setTimer(emit, opts.delayMs);
    },
    flush: emit,
    cancel() {
      clear();
      pending = null;
    }
  };
}
