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
