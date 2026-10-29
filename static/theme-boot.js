/* eslint-disable */
(function () {
  try {
    var r = localStorage.getItem('fretboard-master:prefs');
    if (typeof r !== 'string' || r.length > 16384) return;
    var p = JSON.parse(r),
      theme = p && typeof p === 'object' && !Array.isArray(p) ? p.theme : 0;
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
/* Provisional arrangement before first paint on the tool and About screens (mirrors
   src/lib/shell/layout.ts): without it the prerendered bar and zones are laid out wide, then
   jump once the screen measures. */
(function () {
  try {
    if (!/^\/(notes|triads|caged|about)\/?$/.test(location.pathname)) return;
    document.documentElement.dataset.arrangement = innerWidth <= 1023 ? 'reflow' : 'wide-side';
  } catch (e) {}
})();
