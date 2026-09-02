import { defineConfig } from "vitest/config";

// Eigene Config nur für das Konformitäts-Gate (R4 #3). Hält das Gate von den
// Generator-Specs unter tests/** getrennt: `pnpm test` fährt die Specs, `pnpm gate`
// fährt das Gate über alle Skins.
export default defineConfig({
  test: {
    include: ["gate.spec.ts"],
    // Der erste dynamische Import eines Skins zieht Vue + alle Renderer nach und
    // liegt knapp über dem 5s-Default (lokal ~5.0s für ionic) — der Lauf ist echt,
    // nur der Default zu knapp. 30s gibt dem Kaltstart Luft, ohne echte Hänger zu decken.
    testTimeout: 30_000,
  },
});
