// Line coverage of the app's own scripts, collected from Chromium's V8 coverage.
module.exports = {
  name: 'Fifteen coverage',
  outputDir: './coverage',
  reports: ['console-details', 'html', 'lcovonly'],
  // app.js, plus the real tasks.js (not the stand-in lists some tests serve).
  entryFilter: (entry) => {
    const file = new URL(entry.url).pathname;
    if (file.endsWith('/app.js')) return true;
    return file.endsWith('/tasks.js') && entry.source.includes("'morning-pages'");
  },
  // The same files are served at / and /test/; count them once.
  sourcePath: (filePath) => filePath.replace(/^localhost-\d+\/(test\/)?/, 'app/'),
};
