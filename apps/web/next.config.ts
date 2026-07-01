import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal packages ship raw TS; let Next transpile them (no build step).
  transpilePackages: ["@maven-ai/db", "@maven-ai/shared"],

  // unpdf (pdf.js) is loaded at runtime by the résumé-parse worker, not the Next
  // bundle — keep it external so it's resolved from node_modules, and trace the
  // worker file + unpdf into the serverless function. ponytail: needed only for
  // a Vercel deploy; harmless locally. Verify the trace when deployment lands.
  serverExternalPackages: ["unpdf"],
  outputFileTracingIncludes: {
    "/api/resumes/parse": ["./lib/pdf-worker.mjs", "../../node_modules/.pnpm/unpdf@*/**"],
  },

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
