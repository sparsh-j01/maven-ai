// Admin allowlist: comma-separated Clerk user ids in ADMIN_USER_IDS. Gates the
// interview-approval surface (the only admin capability today).
//
// Server-only: reads process.env. Imported via the "@maven-ai/shared/admin"
// subpath so it never lands in a client bundle. A page that needs to *show*
// something to admins computes this server-side and passes down a boolean —
// never the list, and never the raw env var.
//
// Lives here rather than in apps/web because apps/web has no test runner, and
// this is the one function standing between a normal user and spending API
// credits. See admin.test.ts.
export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}
