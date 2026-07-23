import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produces a self-contained .next/standalone build (its own
  // node_modules subset + a server.js entrypoint) — the leanest deploy
  // artifact for Azure App Service's Node runtime (Phase 35), since it
  // doesn't need `npm install` to run in production, only to build.
  output: "standalone",
};

export default nextConfig;
