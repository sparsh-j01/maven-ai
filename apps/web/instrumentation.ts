import * as Sentry from "@sentry/nextjs";

// Next.js 15 calls register() once at server start and onRequestError on any
// uncaught error in a route/server component — the native hook, so no Sentry
// build plugin is required.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  // Middleware and edge routes run in a separate runtime with its own Sentry
  // client — without this, onRequestError captures nothing for them.
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
