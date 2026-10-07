/**
 * Error-message sanitizing and the report de-duplication key (specs/028 R-08).
 * Shared with the Pages Function: relative imports only.
 */
import type { FailureReport } from './wire';

const MAX_MESSAGE = 200;
const ABSOLUTE_URL = /https?:\/\/\S+/g;
const APP_PATH_WITH_QUERY = /(?:^|\s)\/[^\s?#]*[?#]\S*/g;

/** Mask URLs (which can carry a shared view) with `<url>`, then cap at 200 characters. */
export function sanitizeMessage(raw: string): string {
  return raw
    .replace(ABSOLUTE_URL, '<url>')
    .replace(APP_PATH_WITH_QUERY, '<url>')
    .slice(0, MAX_MESSAGE);
}

/** `kind|tool|name|msg` for errors, `kind|tool|key` for missing text. */
export function reportKey(r: FailureReport): string {
  return r.kind === 'missing-text'
    ? `${r.kind}|${r.tool}|${r.key ?? ''}`
    : `${r.kind}|${r.tool}|${r.name ?? ''}|${r.msg ?? ''}`;
}
