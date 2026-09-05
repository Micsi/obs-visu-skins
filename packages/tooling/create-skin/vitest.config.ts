import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Umgebung `node` (der Default), NICHT `jsdom`: das Spec laedt einen frisch
     * erzeugten Skin als echtes Modul, und der Browser-Aufloesungspfad findet dessen
     * `vue`-Import nicht (dieselbe Falle, die auch die Gate- und CLI-Specs unter
     * `node` haelt).
     *
     * `generateSupport` misst trotzdem am MONTIERTEN Ergebnis und zieht sich dafuer
     * ueber `ensureDom()` selbst ein Dokument hoch. Damit das gelingt, steht `jsdom`
     * hier als devDependency: unter pnpms isoliertem `node_modules` loest vitest den
     * dynamischen `import("jsdom")` aus Sicht des TEST-Pakets auf, nicht aus Sicht
     * der Datei, die ihn schreibt. Ohne diese Abhaengigkeit meldete der Generator
     * jeden Typ als `broken` — mit der ehrlichen Begruendung "keine DOM-Laufzeit".
     */
    include: ["tests/**/*.spec.ts"],
    /**
     * 60 s statt der 5 s des Defaults — fuer den End-to-End-Test „accepts WITHOUT a
     * gap", den einzigen ASYNCHRONEN Test hier und damit den einzigen, den vitest
     * ueberhaupt abbrechen kann (die uebrigen laufen synchron ueber `execFileSync`,
     * an ihnen greift `testTimeout` nicht).
     *
     * Er scaffoldet ein Skin in den Workspace, zieht ueber `ensureDom()` eine
     * jsdom-Laufzeit hoch, importiert die frisch geschriebenen Renderer als echtes
     * Modul (Vue + alle Tiles durch die Transformation) und laesst den kompletten
     * Konformitaets-Generator inklusive Farb-Achse darueber laufen. Vier Messungen
     * unter `pnpm -r test`: 3752 ms, 8026 ms, 5172 ms, 6533 ms — die Arbeit ist
     * dieselbe, die WARTEZEIT macht die parallele Last der acht Pakete. Der Default
     * liegt mitten in dieser Streuung, also war `pnpm -r test` ein Muenzwurf.
     *
     * Warum so grosszuegig: der Kaltstart nach frischem `pnpm install` transformiert
     * alles neu — der Nachbar `conformance` steht aus genau diesem Grund bei 120 s.
     * Und es verdeckt keinen Haenger: ein haengender Renderer wird vom honors-
     * Probelauf in `generateSupport` mit eigenem 3-s-Budget je Skin gefangen, nicht
     * hier. Diese Grenze deckt nur Transformations- und Kaltstartlatenz ab.
     */
    testTimeout: 60_000,
    typecheck: {
      enabled: true,
      include: ["tests/**/*.spec.ts"],
    },
  },
});
