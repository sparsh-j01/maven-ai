// The one public contact address — legal, privacy, security, refunds, deletion.
// Set NEXT_PUBLIC_SUPPORT_EMAIL to a role alias (support@ / privacy@) once a domain
// exists: a personal inbox routing GDPR and account-deletion requests has no team
// visibility, no backup, and no audit trail. The fallback keeps dev/preview working.
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "sparshjjwala.work@gmail.com";

export const mailto = (subject?: string, body?: string) => {
  const q = new URLSearchParams();
  if (subject) q.set("subject", subject);
  if (body) q.set("body", body);
  const qs = q.toString();
  return `mailto:${SUPPORT_EMAIL}${qs ? `?${qs}` : ""}`;
};
