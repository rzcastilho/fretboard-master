import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { recordFailure } from '$lib/shell/failure';
import { preferences } from '$lib/state/preferences.svelte';

/** Read the remembered record once, synchronously, before hydration (010 R-04, FR-005). */
export const init: ClientInit = () => {
  preferences.start();
};

export const handleError: HandleClientError = ({ error }) => {
  recordFailure(null, error);
};
