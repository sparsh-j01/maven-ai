// Self-host Monaco instead of pulling it from a CDN.
//
// @monaco-editor/react ships only a wrapper; the editor itself is fetched at runtime
// by @monaco-editor/loader, which injects <script src="https://cdn.jsdelivr.net/...">
// into the page. Our script-src doesn't list jsdelivr, so the browser blocks it and
// the editor never mounts — and because the code buffer starts pre-filled with the
// starter template, the coding round would happily ship that untouched stub to Judge0
// and grade the candidate down for a round they could not type a character into.
//
// So copy the AMD build into public/ and point loader.config() at it (code-panel.tsx).
// Same origin, covered by script-src 'self', and it survives a jsdelivr outage.
//
// Runs from the build script (NOT `prebuild` — pnpm has enable-pre-post-scripts off by
// default, so a prebuild hook would silently never run and we'd be right back here).
import { cpSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const src = join(
  dirname(require.resolve("monaco-editor/package.json")),
  "min/vs",
);
const dest = join(here, "..", "public", "monaco", "vs");

if (!existsSync(join(src, "loader.js"))) {
  console.error(`monaco: no AMD loader at ${src} — did monaco-editor change layout?`);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`monaco: self-hosted ${src} -> ${dest}`);
