// Manifest-Test: belegt, dass der Terminal-Skin gegen den aktuellen Vertrag
// deklariert ist und dass die Deklaration ehrlich ist — jede verdrahtete Aktion ist
// eine kanonische Aktion des Vertrags, `unsupported` ist bewusst leer.

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { schema, version as contractVersion, type SkinManifest } from "@obs/visu-contract";
import manifest from "../manifest.json" with { type: "json" };
import { details, tiles } from "../renderers.js";

const CORE_TYPES = [
  "blind",
  "camera",
  "climate",
  "jalousie",
  "light",
  "media",
  "scene",
  "sensor",
  "switch",
];

const schemaWidgets = (schema as { widgets: Record<string, { actions?: Record<string, unknown> }> })
  .widgets;

describe("terminal skin manifest", () => {
  const m = manifest as unknown as SkinManifest;

  it("zielt auf den aktuellen Vertragsstand und bleibt eine Liste", () => {
    expect(m.name).toBe("terminal");
    // Gegen den Vertrag gemessen, nicht gegen ein Literal: ein Literal bleibt grün,
    // während der Skin hinter dem Vertrag herhinkt (so blieben neun Minor-Versionen
    // unbemerkt). Diese Zeile wird rot, sobald der Vertrag ohne den Skin weiterzieht.
    expect(m.targetsContract).toBe(contractVersion);
    // Terminal nutzt schlichte Listendarstellung, kein Grid (Issue #11).
    expect(m.layout.model).toBe("list");
  });

  it("deklariert alle neun Kern-Typen und nichts als unsupported", () => {
    expect(Object.keys(m.widgets).sort()).toEqual([...CORE_TYPES].sort());
    // `unsupported` bleibt bewusst leer: alle neun Kern-Typen werden gerendert.
    // Leer heißt NICHT „vergessen" — die Angabe ist da (Goldene Regel 3) und hält den
    // Weg frei, dass ein künftiger neuer Kern-Typ wieder als `gap` auffällt.
    expect(m.unsupported).toEqual([]);
  });

  it("verdrahtet ausschließlich kanonische Vertrags-Aktionen", () => {
    for (const [type, entry] of Object.entries(m.widgets)) {
      const canonical = Object.keys(schemaWidgets[type]?.actions ?? {});
      for (const action of entry?.actions ?? []) {
        expect(canonical, `${type}.${action}`).toContain(action);
      }
    }
  });

  it("lässt die bewusst weggelassenen Aktionen weg (ehrlich partiell)", () => {
    // Terminal zeigt Dim/Lamelle/Pegel an, bietet sie aber nicht als Bedienung an.
    expect(m.widgets.light?.actions).not.toContain("setDim");
    expect(m.widgets.jalousie?.actions).not.toContain("setSlat");
    expect(m.widgets.media?.actions).not.toContain("setVolume");
  });

  it("deklariert nur die Layout-Fähigkeiten, die es wirklich hat", () => {
    // Boden (Goldene Regel 5) ja — Rollen/Pixel/Layer/Popups nein: terminal hat
    // keine roleMap, keine Pixelpositionen und keinen Page-Renderer.
    expect(m.layout.honors).toEqual(["order", "grouping"]);
    for (const capability of ["role", "position", "layers", "popup"]) {
      expect(m.layout.honors).not.toContain(capability);
    }
  });

  it("bringt Renderer für jeden deklarierten Typ mit und kein eigenes Detail", () => {
    expect(Object.keys(tiles).sort()).toEqual(Object.keys(m.widgets).sort());
    // Kein eigener detail-Renderer: Bedienung delegiert an das Host-Default-Detail (#11).
    expect(details).toEqual({});
  });
});

/**
 * Das Zeilen-Layout als CSS-Aussage. Diese Datei prueft sonst das Manifest; die
 * Regel unten ist aber genauso eine Zusicherung an den Nutzer — "kein
 * Horizontalscroll, nichts wird gekuerzt, was passt" — und war zweimal falsch.
 */
describe("terminal Zeilen-Layout (breite Form)", () => {
  const css = () => readFile(new URL("../terminal.css", import.meta.url), "utf8");

  it("gibt Label und Zustand einen Boden, deckelt ihn aber auf die Zeilenbreite", async () => {
    const src = await css();
    const wide = /@container\s*\(min-width:\s*701px\)\s*\{([\s\S]*?)\n\}/.exec(src);
    expect(wide, "die breite Form muss es geben").not.toBeNull();
    const body = wide![1]!;

    // Der Boden ist da (sonst schrumpfen Label/Zustand vor der Befehlsspalte) …
    expect(body).toMatch(/min-width:\s*min\(\s*max-content\s*,\s*100%\s*\)/);
    // … und er ist NICHT nackt: ein ungedeckelter max-content-Boden ueberschreibt
    // `min-width: 0`, und mit `white-space: nowrap` kann ein nutzergelieferter
    // Wert dann weder schrumpfen noch umbrechen noch ellipsieren — er laeuft aus
    // der Zeile heraus. Genau der Ueberlauf, den die Regel verhindern soll.
    expect(body).not.toMatch(/min-width:\s*max-content\s*;/);
  });

  it("laesst die schmale (gestapelte) Form ohne jeden max-content-Boden", async () => {
    const src = await css();
    const narrow = /@container\s*\(max-width:\s*700px\)\s*\{([\s\S]*?)\n\}/.exec(src);
    expect(narrow).not.toBeNull();
    expect(narrow![1]!).not.toContain("max-content");
  });
});
