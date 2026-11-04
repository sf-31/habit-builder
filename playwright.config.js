const { defineConfig, devices } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  globalSetup: require.resolve('./tests/coverage-setup.js'),
  globalTeardown: require.resolve('./tests/coverage-teardown.js'),
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Keep the Google Fonts request from slowing tests or making them flaky.
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tests/server.js',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
