import type { HandleClientError } from '@sveltejs/kit';
import { recordFailure } from '$lib/shell/failure';

export const handleError: HandleClientError = ({ error }) => {
  recordFailure(null, error);
};
