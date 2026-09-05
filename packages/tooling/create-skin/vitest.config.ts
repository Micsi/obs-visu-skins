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
    typecheck: {
      enabled: true,
      include: ["tests/**/*.spec.ts"],
    },
  },
});
