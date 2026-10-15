import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3123",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    // Most tests check end states; the animation tests switch motion back on.
    reducedMotion: "reduce",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "bun scripts/serve.ts --port 3123",
    url: "http://localhost:3123/test/browser/",
    reuseExistingServer: !process.env.CI,
  },
});
