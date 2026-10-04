import { defineConfig, devices } from "@playwright/test";

// Dev servers (Convex local + Vite) are run by Portly; set E2E_BASE_URL to test another target.
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  workers: 1, // tests share the dev deployment data
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5180/",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium" } }],
});
