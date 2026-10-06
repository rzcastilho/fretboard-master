import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { recordFailure } from '$lib/shell/failure';
import { opening } from '$lib/state/opening.svelte';
import { preferences } from '$lib/state/preferences.svelte';

/**
 * Read the remembered record once, synchronously, before hydration (010 R-04, FR-005), then apply
 * a received link on top of it so the first rendered frame is the shared view (023 O1).
 */
export const init: ClientInit = () => {
  preferences.start();
  opening.start(location.href);
};

export const handleError: HandleClientError = ({ error }) => {
  recordFailure(null, error);
};
