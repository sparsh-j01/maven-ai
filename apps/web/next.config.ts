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
    /* fall through */
  }
  // connect-src is now derived from this too, not just script-src and frame-src. So a
  // key that's missing or unparseable at BUILD time no longer degrades one directive —
  // it points all three at the wrong Clerk origin and takes auth out entirely, with no
  // build error and nothing but console CSP violations to explain it. Fail loudly.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing or unparseable — refusing to build a CSP that would silently break Clerk auth.",
    );
  }
  return "*.clerk.accounts.dev";
}

// The four origins the BROWSER actually opens a connection to. Sentry is not among
// them — it runs server + edge only (there is no sentry.client.config), so it needs
// no connect-src entry.
//
// livekit.cloud stays a wildcard on purpose. LiveKit Cloud fetches region settings
// over HTTPS and then hands the signalling socket to a REGIONAL node whose hostname
// is not the project URL, so pinning NEXT_PUBLIC_LIVEKIT_URL alone would break every
// interview in the regions that redirect. Same reason *.i.posthog.com is a wildcard:
// PostHog loads assets from a sibling host (us-assets.i.…) of the configured api host.
function connectSrc(clerk: string, dev: boolean): string {
  // `||`, not `??`: a blank env var is blank, not absent — see lib/contact.ts.
  const posthog =
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
  const livekit = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();
  const origins = [
    "'self'",
    `https://${clerk}`,
    "https://clerk-telemetry.com",
    "https://challenges.cloudflare.com",
    "https://*.livekit.cloud",
    "wss://*.livekit.cloud",
    "https://*.i.posthog.com",
    posthog,
    ...(livekit ? [livekit] : []),
    ...(dev ? ["ws:"] : []),
  ];
  return `connect-src ${[...new Set(origins)].join(" ")}`;
}

// 'unsafe-inline' scripts is a deliberate tradeoff (inline theme + Clerk boot scripts, no
// XSS sinks). Move to nonce + strict-dynamic if a raw-HTML sink ever lands.
function contentSecurityPolicy(): string {
  const clerk = clerkHost();
  const dev = process.env.NODE_ENV !== "production";
  const directives = [
    "default-src 'self'",
    // Monaco is self-hosted (public/monaco, staged by scripts/copy-monaco.mjs), so
    // 'self' covers both its loader and the worker's importScripts — no CDN needed.
    // *.i.posthog.com is here as well as in connect-src: posthog-js lazy-loads
    // recorder.js / surveys.js as SCRIPT tags from the assets host, and those are
    // enabled by a toggle in the PostHog dashboard, not by a code change — so without
    // this the CSP is fine right up until someone flips session replay on.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://${clerk} https://challenges.cloudflare.com https://*.i.posthog.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Was 'self' https: wss:, which let any injected script phone home to any host —
    // and script-src allows 'unsafe-inline', so that mattered. VERIFY ON A PREVIEW
    // DEPLOY: a missing origin here fails in the browser console, not the build.
    connectSrc(clerk, dev),
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
  // Next 16 dropped the per-flag form (appIsrStatus/buildActivity); `false` is the
  // replacement for turning it off entirely.
  devIndicators: false,

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
