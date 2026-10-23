const shared = {
  'categories:performance': ['error', { minScore: 0.7 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  'total-blocking-time': ['warn', { maxNumericValue: 200 }]
};

module.exports = {
  ci: {
    collect: {
      // Host-like routing (clean URLs, 404.html); lhci's own static server has no clean URLs.
      startServerCommand: 'node scripts/serve-build.mjs build 4174',
      startServerReadyPattern: 'serve-build:',
      url: ['/', '/notes', '/triads', '/about'].map((p) => `http://localhost:4174${p}`),
      numberOfRuns: 3,
      // Lighthouse defaults to mobile emulation; "mobile" is not a valid preset.
      settings: { throttlingMethod: 'simulate' }
    },
    // Constitution VI (1.12.0): Home and About usable ≤ 4.5 s, tool screens ≤ 5 s.
    assert: {
      assertMatrix: [
        { matchingUrlPattern: '.*', assertions: shared },
        {
          matchingUrlPattern: ':4174/(about)?$',
          assertions: { interactive: ['error', { maxNumericValue: 4500 }] }
        },
        {
          matchingUrlPattern: ':4174/(notes|triads)$',
          assertions: { interactive: ['error', { maxNumericValue: 5000 }] }
        }
      ]
    }
  }
};
