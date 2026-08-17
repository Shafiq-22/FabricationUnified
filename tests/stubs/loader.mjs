/**
 * Test loader: resolves extensionless relative imports the way the bundler
 * does, and swaps the JSX front matter + react-pdf for the stubs above.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const STUBS = {
  "@react-pdf/renderer": "./react-pdf-stub.ts",
  "./mdb-pdf-document": "./mdb-pdf-document-stub.ts",
};

export async function resolve(spec, ctx, next) {
  const stub = STUBS[spec];
  if (stub) {
    return next(new URL(stub, import.meta.url).href, { ...ctx, parentURL: import.meta.url });
  }
  try {
    return await next(spec, ctx);
  } catch (e) {
    if (spec.startsWith(".") && ctx.parentURL) {
      const base = fileURLToPath(new URL(spec, ctx.parentURL));
      for (const ext of [".ts", ".tsx"]) {
        if (existsSync(base + ext)) return next(pathToFileURL(base + ext).href, ctx);
      }
    }
    throw e;
  }
}
