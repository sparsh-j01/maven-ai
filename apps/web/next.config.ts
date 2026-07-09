import type { NextConfig } from "next";

// Clerk serves its JS from a host base64-encoded in the publishable key; decode it
// so the CSP can allow exactly that origin instead of a blanket https:.
function clerkHost(): string {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const b64 = pk.replace(/^pk_(test|live)_/, "");
  try {
    const host = Buffer.from(b64, "base64").toString("utf8").replace(/\$+$/, "").trim();
    if (/^[a-z0-9.-]+$/i.test(host)) return host;
  } catch {
    /* fall through to the dev wildcard */
  }
  return "*.clerk.accounts.dev";
}

// 'unsafe-inline' scripts is a deliberate tradeoff (inline theme + Clerk boot scripts, no
// XSS sinks). Move to nonce + strict-dynamic if a raw-HTML sink ever lands.
function contentSecurityPolicy(): string {
  const clerk = clerkHost();
  const dev = process.env.NODE_ENV !== "production";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://${clerk} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https: wss:${dev ? " ws:" : ""}`,
    "worker-src 'self' blob:",
    `frame-src 'self' https://${clerk} https://challenges.cloudflare.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

const nextConfig: NextConfig = {
  // Hide the Next.js dev indicator (the "N"/route-status badge in the corner).
  devIndicators: { appIsrStatus: false, buildActivity: false },

  transpilePackages: ["@maven-ai/db", "@maven-ai/shared"],

  // unpdf (pdf.js) runs in the résumé-parse worker, not the Next bundle — keep it
  // external and trace the worker + unpdf into the serverless function.
  serverExternalPackages: ["unpdf"],
  outputFileTracingIncludes: {
    "/api/resumes/parse": ["./lib/pdf-worker.mjs", "../../node_modules/.pnpm/unpdf@*/**"],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
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
