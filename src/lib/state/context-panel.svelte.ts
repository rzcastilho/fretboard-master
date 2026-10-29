/**
 * Context panel state (025 data-model §7). Whether zone D's details are expanded on the reflow
 * arrangement. Session only (no storage, no share link) and shared across the three tools, so
 * a choice made in one stays when the user moves to another.
 */
let expanded = $state(false);

export const contextPanel = {
  /** Default false: the reflow layout opens with the one-line summary only. */
  get expanded(): boolean {
    return expanded;
  },
  toggle(): void {
    expanded = !expanded;
  }
};

/** Test seam: back to the default (Vitest only). */
export function resetContextPanelForTests(): void {
  expanded = false;
}
