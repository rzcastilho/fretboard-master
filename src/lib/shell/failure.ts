import { measure } from '$lib/measure/measure.svelte';
import type { ToolId } from './tools';

export interface FailureRecord {
  name: string;
  message: string;
  tool: ToolId | null;
}

const MAX_MESSAGE = 500;

/** Errors thrown while deriving a display model (028 R-09); anything else is a drawing failure. */
const calculationErrors = new WeakSet<object>();

/** Run a calculation; an error it throws is tagged `calculation` and rethrown unchanged. */
export function markCalculation<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (typeof error === 'object' && error !== null) calculationErrors.add(error);
    throw error;
  }
}

export function buildFailureRecord(tool: ToolId | null, error: unknown): FailureRecord {
  if (error instanceof Error) return { name: error.name, message: error.message, tool };
  return { name: 'UnknownError', message: String(error).slice(0, MAX_MESSAGE), tool };
}

/** Console, plus one anonymous report through the measurement facade (never throws). */
export function recordFailure(
  tool: ToolId | null,
  error: unknown,
  kind?: 'calculation' | 'drawing' | 'audio'
): FailureRecord {
  const record = buildFailureRecord(tool, error);
  console.error('[fretboard-master] failure', record);
  const resolved =
    kind ??
    (typeof error === 'object' && error !== null && calculationErrors.has(error)
      ? 'calculation'
      : 'drawing');
  measure.report({ kind: resolved, tool, error });
  return record;
}
