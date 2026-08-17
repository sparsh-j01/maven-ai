// The one public contact address — legal, privacy, security, refunds, deletion.
// Set NEXT_PUBLIC_SUPPORT_EMAIL to a role alias (support@ / privacy@) once a domain
// exists: a personal inbox routing GDPR and account-deletion requests has no team
// visibility, no backup, and no audit trail.
//
// The fallback is a real, monitored inbox on purpose. An earlier version threw at build
// time instead, on the grounds that a hardcoded default ships green and hides the
// misconfiguration — sound reasoning, but it trades a silently-wrong address for a
// failed deploy, and the placeholder it fell back to (support@localhost) is not an
// address anyone can receive mail at. A real address means the legal pages are always
// reachable, and the only cost of forgetting the env var is that mail lands here rather
// than at the alias.
//
// `||`, not `??`: a declared-but-blank var is "", and ?? would pass it straight through
// — leaving `mailto:` with no address on every legal page. That's the shape a
// half-filled Vercel project has. `.trim()` covers the whitespace-only variant.
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "sparshjjwala.work@gmail.com";

export const mailto = (subject?: string, body?: string) => {
  const q = new URLSearchParams();
  if (subject) q.set("subject", subject);
  if (body) q.set("body", body);
  const qs = q.toString();
  return `mailto:${SUPPORT_EMAIL}${qs ? `?${qs}` : ""}`;
};
