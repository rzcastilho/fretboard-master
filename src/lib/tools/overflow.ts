/**
 * Svelte action for a zone B control row (025 contracts/ui.md §6). Sets `data-overflow` while
 * the row's content is wider than the row (`start`, `end` or `both`: where more content lies),
 * and removes it otherwise. The attribute drives the edge-fade cue in global.css. The row
 * scrolls on its own; no menu is introduced.
 */
export function overflow(node: HTMLElement): { destroy(): void } {
  function update(): void {
    const max = node.scrollWidth - node.clientWidth;
    if (max <= 1) {
      node.removeAttribute('data-overflow');
      return;
    }
    // scrollLeft is negative in right-to-left; the offset from the start is its magnitude.
    const offset = Math.abs(node.scrollLeft);
    const atStart = offset <= 1;
    const atEnd = offset >= max - 1;
    node.setAttribute('data-overflow', atStart ? 'end' : atEnd ? 'start' : 'both');
  }

  update();
  node.addEventListener('scroll', update, { passive: true });
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
  observer?.observe(node);
  for (const child of Array.from(node.children)) observer?.observe(child);
  // Relabelling (notation, language) changes widths without resizing the row itself.
  const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(update);
  mutations?.observe(node, { childList: true, subtree: true, characterData: true });

  return {
    destroy() {
      node.removeEventListener('scroll', update);
      observer?.disconnect();
      mutations?.disconnect();
    }
  };
}
