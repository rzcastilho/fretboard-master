import type { ToolId } from './tools';

export interface FailureRecord {
  name: string;
  message: string;
  tool: ToolId | null;
}

const MAX_MESSAGE = 500;

export function buildFailureRecord(tool: ToolId | null, error: unknown): FailureRecord {
  if (error instanceof Error) return { name: error.name, message: error.message, tool };
  return { name: 'UnknownError', message: String(error).slice(0, MAX_MESSAGE), tool };
}

/** Console only: no URL, user agent, storage, or network. */
export function recordFailure(tool: ToolId | null, error: unknown): FailureRecord {
  const record = buildFailureRecord(tool, error);
  console.error('[fretboard-master] failure', record);
  return record;
}
