// Umbrales provisionales de laboratorio. Solo evalúan /login compilado y sin sesión.
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      isSinglePageApplication: true,
      url: ['http://localhost/login'],
      numberOfRuns: 3,
      settings: {
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
        maxWaitForLoad: 30000,
        // Runner efímero con sitio local de prueba; Chrome no dispone de sandbox Linux.
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.65 }],
        'categories:accessibility': ['warn', { minScore: 0.80 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 3500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 7000 }],
        'total-blocking-time': ['error', { maxNumericValue: 1500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.25 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.qa/lighthouse',
    },
  },
};
