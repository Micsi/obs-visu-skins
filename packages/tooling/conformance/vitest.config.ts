import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Der honors-Probelauf MOUNTET die Seite mit Vue und feuert echte
    // MouseEvents. `@vue/runtime-dom` greift `document` beim Modul-Laden ab,
    // also muss das DOM stehen, BEVOR irgendein Import Vue nachzieht — das
    // leistet nur die Umgebung, kein Setup-Hook im Test.
    environment: "jsdom",
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
