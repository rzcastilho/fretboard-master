/** Fire-and-forget delivery (specs/028 contracts/client-api.md §3). The result is never read. */

/** Global Privacy Control or Do Not Track asks us not to measure at all. */
export function trackingRefused(): boolean {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.globalPrivacyControl === true || navigator.doNotTrack === '1';
  } catch {
    // Reading the signals failed: treat as no signal; measurement must never throw into the app.
    return false;
  }
}

export function createTransport(endpoint: string): (body: string) => void {
  return (body) => {
    try {
      if (
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }))
      ) {
        return;
      }
      void fetch(endpoint, {
        method: 'POST',
        body,
        keepalive: true,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store'
      }).catch(() => {
        // Measurement is best-effort: a failed send is dropped, never retried or reported.
      });
    } catch {
      // Measurement is best-effort: a synchronous failure must never reach the user.
    }
  };
}
