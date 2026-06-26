import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal packages ship raw TS; let Next transpile them (no build step).
  transpilePackages: ["@maven-ai/db", "@maven-ai/shared"],
};

export default nextConfig;
