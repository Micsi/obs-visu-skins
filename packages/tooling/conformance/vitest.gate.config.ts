import { defineConfig } from "vitest/config";

// Eigene Config nur für das Konformitäts-Gate (R4 #3). Hält das Gate von den
// Generator-Specs unter tests/** getrennt: `pnpm test` fährt die Specs, `pnpm gate`
// fährt das Gate über alle Skins.
export default defineConfig({
  test: {
    // KEINE jsdom-Umgebung, anders als bei den Generator-Specs: das Gate fährt
    // `main()` aus `cli.ts`, und über dessen Shebang stolpert der Transform-Pfad
    // der Browser-Umgebung. Das DOM, das der honors-Probelauf zum Mounten
    // braucht, zieht das CLI ohnehin selbst hoch (`ensureDom()` vor dem
    // Skin-Import) — hier läuft also genau der Weg, den ein direkter Aufruf nimmt.
    include: ["gate.spec.ts"],
    // Der erste dynamische Import eines Skins zieht Vue + alle Renderer nach und
    // liegt knapp über dem 5s-Default (lokal ~5.0s für ionic) — der Lauf ist echt,
    // nur der Default zu knapp. 30s gibt dem Kaltstart Luft, ohne echte Hänger zu decken.
    // 60 s aus demselben Grund wie bei den Specs: der Kaltstart zieht Vue, die
    // Renderer und die DOM-Laufzeit auf einmal hoch. Das Budget des Probelaufs
    // (3 s je Skin) bleibt die Grenze, die echte Hänger fängt.
    testTimeout: 60_000,
  },
});
