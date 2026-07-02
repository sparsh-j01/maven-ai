import * as Sentry from "@sentry/nextjs";

// Server-side error + performance monitoring. With no DSN set, init is a no-op,
// so this is safe in dev/CI/preview. ponytail: server only for now — browser
// error capture needs a NEXT_PUBLIC_ DSN + client config; add in M9 if wanted.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
