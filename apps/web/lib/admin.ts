// Admin allowlist: comma-separated Clerk user ids in ADMIN_USER_IDS. Gates the
// interview-approval surface (the only admin capability today).
export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}
