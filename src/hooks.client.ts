import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { recordFailure } from '$lib/shell/failure';
import { registerOffline } from '$lib/offline/register';
import { measure } from '$lib/measure/measure.svelte';
import { opening } from '$lib/state/opening.svelte';
import { preferences } from '$lib/state/preferences.svelte';

/**
 * Read the remembered record once, synchronously, before hydration (010 R-04, FR-005), then apply
 * a received link on top of it so the first rendered frame is the shared view (023 O1).
 */
export const init: ClientInit = () => {
  preferences.start();
  opening.start(location.href);
  // After preference restore and link open, so baseline traits are what the visitor sees.
  measure.start();
  // After first paint's critical work: the worker registers on `load` (040 R-08).
  registerOffline(window, import.meta.env.DEV);
};

export const handleError: HandleClientError = ({ error }) => {
  recordFailure(null, error);
};
