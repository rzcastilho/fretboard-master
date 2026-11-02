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
   src/lib/shell/layout.ts arrangementFor and geometry.ts naturalWidth): without it the
   prerendered bar and zones are laid out wide, then jump once the screen measures. The neck's
   natural width is 4.25rem + 3rem per fret (label 1.5, open 2.75, frets 3.25 -> 2.75); the fret
   count comes from the link's `fr`, else the stored `frets`, else 22. */
(function () {
  try {
    if (!/^\/(notes|triads|caged|about)\/?$/.test(location.pathname)) return;
    var root = document.documentElement;
    if (innerWidth <= 1023) {
      root.dataset.arrangement = 'reflow';
      return;
    }
    var ok = function (n) {
      return typeof n === 'number' && n % 1 === 0 && n >= 12 && n <= 24;
    };
    var frets = 22;
    try {
      var r = localStorage.getItem('fretboard-master:prefs');
      var p = typeof r === 'string' && r.length <= 16384 ? JSON.parse(r) : 0;
      if (p && ok(p.frets)) frets = p.frets;
    } catch (e) {}
    var m = /[?&]fr=(\d+)(?:&|$)/.exec(location.search || '');
    if (m && ok(+m[1])) frets = +m[1];
    var px = 16;
    try {
      px = parseFloat(getComputedStyle(root).fontSize) || 16;
    } catch (e) {}
    var border = 1;
    try {
      if (matchMedia('(prefers-contrast: more)').matches) border = 2;
    } catch (e) {}
    var left = ((innerWidth - 3 * px) * 3) / 4 - 2 * border;
    root.dataset.arrangement = (4.25 + 3 * frets) * px <= left ? 'wide-side' : 'wide-stacked';
  } catch (e) {}
})();
