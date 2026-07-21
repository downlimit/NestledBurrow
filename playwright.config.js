import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173/NestledBurrow/",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/NestledBurrow/",
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, VITE_E2E: "1" },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], locale: "en-US" } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"], locale: "ru-RU" } },
  ],
});
