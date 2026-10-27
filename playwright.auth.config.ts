import { defineConfig, devices } from "@playwright/test";
const basePath = process.env.TEST_BASE_PATH || "";
export default defineConfig({
  outputDir: basePath ? "test-results/auth-path" : "test-results/auth-root",
  testDir: "./tests/auth-e2e", fullyParallel: false, workers: 1, retries: 0,
  timeout: 120000, expect: {timeout: 15000}, reporter: "list",
  use: {...devices["Desktop Chrome"], channel: "chrome", baseURL: "http://127.0.0.1:3102", trace: "retain-on-failure"},
  webServer: [
    {command: "node --import tsx tests/helpers/auth-server.ts", url: "http://127.0.0.1:54329/health", timeout: 60000, gracefulShutdown: {signal: "SIGTERM", timeout: 10000}, env: {TEST_BASE_PATH: basePath}},
    {command: "npm run test:auth:server", url: `http://127.0.0.1:3102${basePath}/login`, timeout: 180000,
      env: {NEXT_DIST_DIR: basePath ? ".next-auth-path-e2e" : ".next-auth-e2e", NEXT_PUBLIC_BASE_PATH: basePath, DATABASE_URL: "postgresql://interview_test@127.0.0.1:54328/postgres", NEON_AUTH_BASE_URL: "http://127.0.0.1:54329/auth", NEON_AUTH_COOKIE_SECRET: "test-cookie-secret-minimum-thirty-two-characters", AUTH_SITE_URL: `https://interview.example.test${basePath}`, OPENAI_API_KEY: ""}},
  ],
});
