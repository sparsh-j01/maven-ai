import { afterEach, describe, expect, it } from "vitest";
import { isAdmin } from "./admin";

const ID = "user_2exampleAAAAAAAAAAAAAAAAAAA";
const OTHER = "user_2exampleBBBBBBBBBBBBBBBBBBB";

const set = (v: string | undefined) => {
  if (v === undefined) delete process.env.ADMIN_USER_IDS;
  else process.env.ADMIN_USER_IDS = v;
};

afterEach(() => set(undefined));

describe("isAdmin", () => {
  it("matches an id in the allowlist", () => {
    set(ID);
    expect(isAdmin(ID)).toBe(true);
  });

  it("rejects an id that is not in the allowlist", () => {
    set(ID);
    expect(isAdmin(OTHER)).toBe(false);
  });

  it("handles several ids", () => {
    set(`${OTHER},${ID}`);
    expect(isAdmin(ID)).toBe(true);
    expect(isAdmin(OTHER)).toBe(true);
  });

  // A half-filled Vercel project is the common case, not an exotic one: the var
  // can be absent, declared-but-empty, or whitespace. All three mean zero admins.
  it("fails closed when the allowlist is unusable", () => {
    for (const v of [undefined, "", "   ", ",", " , , "]) {
      set(v);
      expect(isAdmin(ID)).toBe(false);
    }
  });

  it("fails closed on a missing userId", () => {
    set(ID);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin("")).toBe(false);
  });

  // Copy-paste out of a dashboard brings padding and a trailing comma with it.
  it("tolerates surrounding whitespace and a trailing comma", () => {
    set(`  ${ID} , ${OTHER} ,`);
    expect(isAdmin(ID)).toBe(true);
    expect(isAdmin(OTHER)).toBe(true);
  });

  // Exact match, not prefix: a shorter id that happens to start the same way is
  // a different account and must not inherit approval rights.
  it("does not match on a substring or prefix", () => {
    set(ID);
    expect(isAdmin(ID.slice(0, -4))).toBe(false);
    expect(isAdmin(`${ID}X`)).toBe(false);
  });

  // Clerk ids are case-sensitive, and so is this.
  it("does not match on case differences", () => {
    set(ID);
    expect(isAdmin(ID.toLowerCase())).toBe(false);
  });

  // Parsing is comma-only, on purpose. Pinned so a newline-separated var fails
  // loudly in a test rather than quietly locking the owner out of production.
  it("does not accept newline-separated ids", () => {
    set(`${OTHER}\n${ID}`);
    expect(isAdmin(ID)).toBe(false);
    expect(isAdmin(OTHER)).toBe(false);
  });
});
