import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal packages ship raw TS; let Next transpile them (no build step).
  transpilePackages: ["@maven-ai/db", "@maven-ai/shared"],

  // Baseline security headers. Authed interview pages must not be framable
  // (clickjacking) or MIME-sniffed. CSP is deferred to milestone 3 once the
  // LiveKit/Clerk origins are pinned. ponytail: headers() over middleware —
  // one place, no per-request cost.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
