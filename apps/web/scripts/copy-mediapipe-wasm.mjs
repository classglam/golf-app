// Copies MediaPipe's WebAssembly runtime out of node_modules into public/ so
// the app self-hosts it (served at /mediapipe/wasm) instead of pulling it from
// a CDN at runtime. Runs before `dev` and `build`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// package.json is not in the package's "exports", so resolve the CJS entry
// (which sits at the package root) instead.
const pkgDir = dirname(require.resolve("@mediapipe/tasks-vision"));
const src = join(pkgDir, "wasm");
const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "mediapipe", "wasm");

if (!existsSync(src)) {
  console.error(`MediaPipe wasm folder not found at ${src}`);
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied MediaPipe wasm -> ${dest}`);
