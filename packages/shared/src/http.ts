// Turning a failed Response into something the user can actually read.
//
// Two traps, both of which end with the user staring at a button that just stopped:
//   1. An empty body makes `new Error("")`, whose message is falsy — so the UI's
//      `{error ? … : null}` renders nothing at all.
//   2. A crashed route answers with an HTML 500 page, and dumping that into a
//      <span> is worse than saying nothing.
//
// The routes signal real, user-facing failures as `new Response("some message", …)`.
// That is text/plain — but only because the Response constructor defaults a bare
// string to text/plain;charset=UTF-8. Nobody declares it. Switch a route to the more
// idiomatic `Response.json({ error })` and its content-type becomes application/json,
// this guard stops trusting the body, and the message silently degrades to the
// fallback. http.test.ts pins that, so the day it changes a test fails instead of the
// error text quietly going vague.
export async function errorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  if (!res.headers.get("content-type")?.startsWith("text/plain")) {
    // Release the stream we're deliberately not reading. This helper funnels five
    // call sites now, so the unread bodies would otherwise sit open until GC.
    void res.body?.cancel();
    return fallback;
  }
  return (await res.text()).trim().slice(0, 200) || fallback;
}
