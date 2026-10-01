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
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        interactive: ['error', { maxNumericValue: 3000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }]
      }
    }
  }
};
