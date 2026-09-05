import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Umgebung `node` (der Default), NICHT `jsdom`: dieses Paket rendert nichts, es
     * liest Dateien vom Datenträger und vergleicht sie mit der Doku.
     *
     * Und bewusst OHNE `--typecheck`, anders als die übrigen Pakete hier: das Spec
     * hängt an keiner Vertragsfläche, deren Typen sich unter ihm wegdrehen könnten —
     * die Wurzel-`tsc --build` deckt es über die Projektreferenz vollständig ab. Ein
     * zweiter tsc-Lauf wäre reine Last, und die kostet real: `pnpm -r test` fährt acht
     * Pakete parallel, und der zusätzliche Prozess trieb `create-skin`s End-to-End-Test
     * (5s-Limit, solo 2,8s) auf 9,1s ins Timeout. Grün, ohne fremde Tests zu verdrängen.
     */
    include: ["tests/**/*.spec.ts"],
  },
});
