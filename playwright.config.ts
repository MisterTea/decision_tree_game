import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  timeout: 60000,
  outputDir: process.env.QA_DIR || 'qa/final',
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:5173/decision_tree_game/',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
    video: 'on',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', testIgnore: '**/phone-layout.spec.ts', use: { viewport: { width: 1440, height: 1000 }, video: { mode: 'on', size: { width: 1440, height: 1000 } } } },
    { name: 'mobile', testIgnore: '**/phone-layout.spec.ts', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, defaultBrowserType: 'chromium', video: { mode: 'on', size: { width: 390, height: 844 } } } },
    ...[
      { width: 320, height: 480 }, { width: 320, height: 568 },
      { width: 360, height: 640 }, { width: 375, height: 667 },
      { width: 390, height: 844 }, { width: 412, height: 915 },
      { width: 568, height: 320 }, { width: 667, height: 375 },
      { width: 844, height: 390 },
    ].map(size => ({ name: `phone-${size.width}x${size.height}`, testMatch: '**/phone-layout.spec.ts', use: { ...devices['iPhone 13'], viewport: size, defaultBrowserType: 'chromium' as const, video: { mode: 'on' as const, size } } })),
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run build && npm run preview -- --port 5173',
    url: 'http://127.0.0.1:5173/decision_tree_game/',
    reuseExistingServer: true,
  },
});
