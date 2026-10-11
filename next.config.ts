import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
if (basePath && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath)) {
  throw new Error("NEXT_PUBLIC_BASE_PATH must be empty or a path such as /interview, without a trailing slash.");
}
const nextConfig: NextConfig = {
  basePath,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Confirmation URLs contain one-time credentials. Keep them out of dev logs.
  logging: {incomingRequests: {ignore: [/\/auth\/confirm/]}},
  async headers() {
    return [{source: "/:path*", headers: [
      {key: "X-Content-Type-Options", value: "nosniff"},
      {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},
      {key: "Permissions-Policy", value: "camera=(), microphone=(self)"},
      {key: "X-Frame-Options", value: "DENY"},
    ]}, {source: "/auth/confirm", headers: [
      {key: "Referrer-Policy", value: "no-referrer"},
      {key: "Cache-Control", value: "no-store"},
    ]}];
  },
};
export default nextConfig;
