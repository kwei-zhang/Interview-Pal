import { defineConfig, devices } from "@playwright/test";
const basePath = process.env.TEST_BASE_PATH || "";
export default defineConfig({
  testDir: "./tests/auth-e2e", fullyParallel: false, workers: 1, retries: 0,
  timeout: 120000, expect: {timeout: 15000}, reporter: "list",
  use: {...devices["Desktop Chrome"], channel: "chrome", baseURL: "http://127.0.0.1:3102", trace: "retain-on-failure"},
  webServer: [
    {command: "node --import tsx tests/helpers/auth-server.ts", url: "http://127.0.0.1:54329/health", timeout: 60000},
    {command: "npm run test:auth:server", url: `http://127.0.0.1:3102${basePath}/login`, timeout: 180000,
      env: {NEXT_DIST_DIR: basePath ? ".next-auth-path-e2e" : ".next-auth-e2e", NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public-key", AUTH_SITE_URL: `https://interview.example.test${basePath}`, OPENAI_API_KEY: ""}},
  ],
});
