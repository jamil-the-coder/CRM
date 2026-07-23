import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No custom `output` — deploying to Vercel for now (see DEPLOY.md), which
  // builds and serves the app itself and doesn't need "standalone" output.
  // If this ever migrates to Azure App Service (see DEPLOY-AZURE.md), add
  // back `output: "standalone"` first.
};

export default nextConfig;
