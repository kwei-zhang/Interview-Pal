import { defineConfig, devices } from "@playwright/test";
const basePath = process.env.TEST_BASE_PATH || "";
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: basePath ? "test-results/workspace-path" : "test-results/workspace-root",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"], channel: "chrome",
    baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: `http://127.0.0.1:3100${basePath}`, reuseExistingServer: false,
    timeout: 120000,
    env: {NEXT_PUBLIC_BASE_PATH: basePath, NEXT_DIST_DIR: basePath ? ".next-path-e2e" : ".next-e2e", DATABASE_URL: "", NEON_AUTH_BASE_URL: "", NEON_AUTH_COOKIE_SECRET: "", OPENAI_API_KEY: ""},
  },
});
