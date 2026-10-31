import { m } from '$lib/paraglide/messages.js';

export type FretboardToolId = 'notes' | 'triads' | 'caged';
export type ToolId = FretboardToolId | 'metronome';

export interface Tool {
  id: ToolId;
  path: '/notes' | '/triads' | '/caged' | '/metronome';
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
  },
  {
    id: 'caged',
    path: '/caged',
    name: () => m.tool_caged_name(),
    question: () => m.tool_caged_question()
  },
  {
    id: 'metronome',
    path: '/metronome',
    name: () => m.tool_metronome_name(),
    question: () => m.tool_metronome_question()
  }
];
