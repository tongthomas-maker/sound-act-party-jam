// Plain vitest config: tests don't need the TanStack Start/Cloudflare plugins,
// which break React hook tests (duplicate React under the SSR plugin chain).
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
