import { describe, expect, it } from "vitest";
import { errorMessage } from "./http";

describe("errorMessage", () => {
  it("surfaces the route's message, and only the route's message", async () => {
    // Built the way every route builds one: a bare string, no explicit Content-Type.
    // This pins the constructor's text/plain default. Move a route to Response.json()
    // and this assertion fails — instead of every error message silently going vague.
    const plain = new Response("Already subscribed", { status: 409 });
    expect(await errorMessage(plain, "fallback")).toBe("Already subscribed");

    // A crashed route answers with an HTML 500 page. It must never reach a <span>.
    const html = new Response("<!doctype html><h1>500</h1>", {
      status: 500,
      headers: { "content-type": "text/html" },
    });
    expect(await errorMessage(html, "fallback")).toBe("fallback");

    // A blank body would make new Error(""), whose message is falsy — the UI's
    // `{error ? … : null}` then renders nothing and the button just stops.
    const blank = new Response("   ", { status: 500 });
    expect(await errorMessage(blank, "fallback")).toBe("fallback");
  });
});
