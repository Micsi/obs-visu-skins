import { defineConfig } from "vitest/config";

// Eigene Config nur für das Konformitäts-Gate (R4 #3). Hält das Gate von den
// Generator-Specs unter tests/** getrennt: `pnpm test` fährt die Specs, `pnpm gate`
// fährt das Gate über alle Skins.
export default defineConfig({
  test: {
    include: ["gate.spec.ts"],
  },
});
