import * as Sentry from "@sentry/nextjs";

// Middleware/edge routes run in their own runtime and need their own client.
// Same contract as sentry.server.config: no DSN set means init is a no-op.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
