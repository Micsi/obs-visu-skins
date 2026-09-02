import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    // Der erste dynamische Import eines Skins zieht Vue + alle Renderer nach und
    // liegt über dem 5s-Default; der Lauf selbst ist schnell.
    testTimeout: 30_000,
    typecheck: {
      enabled: true,
      include: ["tests/**/*.spec.ts"],
    },
  },
});
