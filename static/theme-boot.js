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
    var w = innerWidth,
      h = innerHeight;
    document.documentElement.dataset.arrangement =
      h <= 499 && w > h ? 'landscape' : w <= 599 ? 'narrow' : w <= 1023 ? 'medium' : 'wide-side';
  } catch (e) {}
})();
