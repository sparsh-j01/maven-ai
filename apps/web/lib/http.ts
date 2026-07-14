// Turning a failed Response into something the user can actually read.
//
// Two traps, both of which end with the user staring at a button that just stopped:
//   1. An empty body makes `new Error("")`, whose message is falsy — so the UI's
//      `{error ? … : null}` renders nothing at all.
//   2. A crashed route answers with an HTML 500 page, and dumping that into a
//      <span> is worse than saying nothing.
// Routes signal real, user-facing failures in text/plain. Trust only that.
export async function errorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  const text = res.headers.get("content-type")?.startsWith("text/plain")
    ? (await res.text()).trim().slice(0, 200)
    : "";
  return text || fallback;
}
