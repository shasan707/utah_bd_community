// Lets plain Node run the project's TypeScript without a build step.
//
// Three jobs: resolve the "@/" alias the way tsconfig does, add the .ts
// extension that Next lets source files omit, and turn the "server-only"
// marker into a no-op so server modules can be imported outside Next.
//
// Used by tests/run.mjs. Nothing in the application depends on it.
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STUB = pathToFileURL(path.join(ROOT, "tests", "empty.mjs")).href;

/** Source files omit the extension; try the ones the project uses. */
function withExtension(fsPath) {
  if (fs.existsSync(fsPath) && fs.statSync(fsPath).isFile()) return fsPath;
  for (const ext of [".ts", ".tsx", ".mts", ".mjs", ".js", "/index.ts"]) {
    if (fs.existsSync(fsPath + ext)) return fsPath + ext;
  }
  return fsPath;
}

/** Everything returned must be a file: URL, never a bare C:\ path. */
const asUrl = (p) => (p.startsWith("file:") ? p : pathToFileURL(p).href);

export function resolve(specifier, context, next) {
  if (/^[a-zA-Z]:[\\/]/.test(specifier)) {
    return { url: asUrl(withExtension(specifier)), shortCircuit: true };
  }
  if (specifier === "server-only" || specifier === "client-only") {
    return { url: STUB, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    return { url: asUrl(withExtension(path.join(ROOT, specifier.slice(2)))), shortCircuit: true };
  }
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    if (!/\.[a-z]+$/.test(specifier)) {
      const target = new URL(specifier, new URL(".", context.parentURL));
      const guess = withExtension(fileURLToPath(target));
      if (fs.existsSync(guess)) return { url: asUrl(guess), shortCircuit: true };
    }
  }
  return next(specifier, context);
}
