import { m } from '$lib/paraglide/messages.js';

export type ScreenId = 'home' | 'notes' | 'triads' | 'about';

export interface Screen {
  id: ScreenId;
  path: '/' | '/notes' | '/triads' | '/about';
  heading: () => string;
}

export const SCREENS: readonly Screen[] = [
  { id: 'home', path: '/', heading: () => m.app_name() },
  { id: 'notes', path: '/notes', heading: () => m.tool_notes_name() },
  { id: 'triads', path: '/triads', heading: () => m.tool_triads_name() },
  { id: 'about', path: '/about', heading: () => m.about_heading() }
];

export const KNOWN_PATHS = SCREENS.map((s) => s.path) as readonly Screen['path'][];

/** Document title: product name on home, "<Screen name> — Fretboard Master" elsewhere. */
export function screenTitle(id: ScreenId): string {
  if (id === 'home') return m.app_name();
  const names: Record<Exclude<ScreenId, 'home'>, () => string> = {
    notes: () => m.tool_notes_name(),
    triads: () => m.tool_triads_name(),
    about: () => m.nav_about()
  };
  return m.title_screen({ screen: names[id]() });
}
