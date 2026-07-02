import * as Sentry from "@sentry/nextjs";

// Next.js 15 calls register() once at server start and onRequestError on any
// uncaught error in a route/server component — the native hook, so no Sentry
// build plugin is required.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
