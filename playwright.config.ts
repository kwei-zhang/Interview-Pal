import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
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
    url: "http://127.0.0.1:3100", reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {NEXT_PUBLIC_BASE_PATH: "", NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", OPENAI_API_KEY: ""},
  },
});
