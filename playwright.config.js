import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PW_BASE_URL ?? "http://127.0.0.1:4173/NestledBurrow/";
const port = new URL(baseURL).port || "4173";

export default defineConfig({
  testDir: "tests/e2e",
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: process.env.PW_REUSE_SERVER === "1" || !process.env.CI,
    env: { ...process.env, VITE_E2E: "1" },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], locale: "en-US" } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"], locale: "ru-RU" } },
  ],
});
