import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/backend/src"),
      "@repo/trpc": path.resolve(__dirname, "packages/trpc/src/index.ts"),
      "@repo/trpc/router": path.resolve(__dirname, "packages/trpc/src/router.ts"),
      "@repo/zod-types": path.resolve(
        __dirname,
        "packages/zod-types/src/index.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: path.resolve(__dirname, "tmp/vitest/coverage"),
      exclude: [
        "tests/**",
        "**/*.config.ts",
        "**/*.test.ts",
        "apps/**/dist/**",
        "packages/**/dist/**",
      ],
    },
  },
});
