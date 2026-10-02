/**
 * jsdom has no Web Animations API, which Svelte transitions call through `element.animate`.
 * This minimal stand-in finishes every animation on a microtask, so intros and outros complete
 * (and outroed nodes are removed) as in a browser, but before an awaited `tick()`/`rerender()`
 * returns, which keeps DOM assertions deterministic.
 */
if (typeof Element !== 'undefined' && !('animate' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value() {
      const animation = {
        currentTime: 0,
        playState: 'running',
        finished: Promise.resolve(),
        onfinish: null as (() => void) | null,
        cancel() {
          animation.playState = 'idle';
        }
      };
      queueMicrotask(() => {
        if (animation.playState === 'idle') return;
        animation.playState = 'finished';
        animation.onfinish?.();
      });
      return animation;
    }
  });
}
