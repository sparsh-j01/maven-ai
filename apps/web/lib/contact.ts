// The one public contact address — legal, privacy, security, refunds, deletion.
// Set NEXT_PUBLIC_SUPPORT_EMAIL to a role alias (support@ / privacy@) once a domain
// exists: a personal inbox routing GDPR and account-deletion requests has no team
// visibility, no backup, and no audit trail.
//
// There is deliberately NO production fallback. A hardcoded default is worse than a
// broken build: it ships green and quietly routes every legal, privacy and deletion
// request to whoever happened to be in the source, and nothing anywhere reports it.
// `next build` runs with NODE_ENV=production and every legal page is prerendered, so an
// unset var fails the deploy instead — which is the only moment anyone would notice.
// CI writes a dummy for the same reason it writes a dummy Clerk key (ci.yml).
//
// `||`, not `??`: a declared-but-blank var is "", and ?? would pass it straight through
// — leaving `mailto:` with no address on every legal page. That's the shape a half-filled
// Vercel project has, so it must land on the throw, not slip past it.
const configured = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

if (!configured && process.env.NODE_ENV === "production") {
  throw new Error(
    "NEXT_PUBLIC_SUPPORT_EMAIL is unset — the legal pages would ship with no contact " +
      "address. Set it in the deployment environment.",
  );
}

export const SUPPORT_EMAIL = configured || "support@localhost";

export const mailto = (subject?: string, body?: string) => {
  const q = new URLSearchParams();
  if (subject) q.set("subject", subject);
  if (body) q.set("body", body);
  const qs = q.toString();
  return `mailto:${SUPPORT_EMAIL}${qs ? `?${qs}` : ""}`;
};
