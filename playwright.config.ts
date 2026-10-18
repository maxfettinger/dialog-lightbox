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
    {
      // Desktop Linux and Windows show scrollbars that take room. macOS hides them, so force them on here.
      name: "chromium-scrollbars",
      use: {
        browserName: "chromium",
        launchOptions: {
          ignoreDefaultArgs: ["--hide-scrollbars"],
          args: ["--disable-features=OverlayScrollbar"],
        },
      },
    },
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
  ],
  webServer: {
    command: "bun run build:demo && bun scripts/serve.ts --port 3123",
    url: "http://localhost:3123/test/browser/",
    reuseExistingServer: !process.env.CI,
  },
});
