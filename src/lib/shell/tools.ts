import { m } from '$lib/paraglide/messages.js';

export type ToolId = 'notes' | 'triads';

export interface Tool {
  id: ToolId;
  path: '/notes' | '/triads';
  name: () => string;
  question: () => string;
}

/** Display order is also navigation order. */
export const TOOLS: readonly Tool[] = [
  {
    id: 'notes',
    path: '/notes',
    name: () => m.tool_notes_name(),
    question: () => m.tool_notes_question()
  },
  {
    id: 'triads',
    path: '/triads',
    name: () => m.tool_triads_name(),
    question: () => m.tool_triads_question()
  }
];
