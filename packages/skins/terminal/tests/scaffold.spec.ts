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
    const wide = /@container\s*\(width\s*>\s*700px\)\s*\{([\s\S]*?)\n\}/.exec(src);
    expect(wide, "die breite Form muss es geben").not.toBeNull();
    const body = wide![1]!;

    // Der Boden ist da (sonst schrumpfen Label/Zustand vor der Befehlsspalte) …
    const floors = [...body.matchAll(/min-width:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(floors.length, "Label und Zustand brauchen je einen Boden").toBeGreaterThanOrEqual(2);
    // … und er ist NICHT nackt: ein ungedeckelter max-content-Boden ueberschreibt
    // `min-width: 0`, und mit `white-space: nowrap` kann ein nutzergelieferter
    // Wert dann weder schrumpfen noch umbrechen noch ellipsieren — er laeuft aus
    // der Zeile heraus. Genau der Ueberlauf, den die Regel verhindern soll.
    expect(body).not.toMatch(/min-width:\s*max-content\s*;/);
    for (const floor of floors) {
      expect(floor, `ungedeckelter Boden: ${floor}`).toMatch(/\bmin\(/);
      expect(floor, `der Deckel fehlt: ${floor}`).toContain("100%");
    }
  });

  it("schreibt keinen Boden, den der Browser verwirft", async () => {
    // Die Lehre aus der Runde davor, und sie kostete eine ganze Welle: der Test
    // pruefte die SCHREIBWEISE `min(max-content, 100%)` und war damit gruen,
    // waehrend jeder Browser die Deklaration verwarf — intrinsische
    // Schluesselwoerter (`max-content`, `min-content`, `fit-content`, `auto`,
    // `stretch`) sind in einer CSS-Rechenfunktion nicht erlaubt. Der Boden fehlte
    // ganz, das Kuerzungsband war zurueck, und nichts wurde rot.
    //
    // Geprueft wird deshalb die GUELTIGKEIT, ueber die ganze Datei: keine
    // Rechenfunktion darf ein intrinsisches Schluesselwort enthalten. Kommentare
    // sind ausgenommen — die Regel, warum es nicht geht, muss man aufschreiben
    // duerfen, ohne dass der Waechter darueber stolpert.
    const src = (await css()).replace(/\/\*[\s\S]*?\*\//g, "");
    const intrinsic = /\b(?:min|max|clamp|calc)\(([^()]*)\)/g;
    const bad: string[] = [];
    for (const m of src.matchAll(intrinsic)) {
      if (/\b(?:max-content|min-content|fit-content|stretch|auto)\b/.test(m[1]!)) bad.push(m[0]!);
    }
    expect(bad, `Rechenfunktion mit intrinsischem Schluesselwort: ${bad.join(" · ")}`).toEqual([]);
  });

  it("laesst die schmale (gestapelte) Form ohne jeden max-content-Boden", async () => {
    const src = await css();
    const narrow = /@container\s*\(width\s*<=\s*700px\)\s*\{([\s\S]*?)\n\}/.exec(src);
    expect(narrow).not.toBeNull();
    expect(narrow![1]!).not.toContain("max-content");
  });
  it("laesst zwischen den beiden Formen keine Luecke", async () => {
    // `min-width: 701px` + `max-width: 700px` sahen komplementaer aus, waren es
    // aber nicht: Containerbreiten sind gebrochen (Grid-Aufteilung, Zoom,
    // Geraete-Pixel), und zwischen 700 und 701 px traf KEINE der beiden Regeln.
    // Dort behielten die Felder ihr schrumpfbares `min-width: 0` und kuerzten
    // wieder, statt zu stapeln — genau das Band, das beide Regeln schliessen.
    //
    // Geprueft wird die Lueckenlosigkeit selbst, nicht die Schreibweise: die
    // beiden Bedingungen muessen dieselbe Schwelle nennen und sich an ihr
    // beruehren (`>` auf der einen, `<=` auf der anderen Seite).
    const src = (await css()).replace(/\/\*[\s\S]*?\*\//g, "");
    const conds = [...src.matchAll(/@container\s*\(([^)]+)\)/g)].map((m) => m[1]!.trim());
    expect(conds.length, "es gibt zwei Formen").toBeGreaterThanOrEqual(2);

    const wide = conds.find((c) => /width\s*>/.test(c));
    const narrow = conds.find((c) => /width\s*<=/.test(c));
    expect(wide, `keine offene obere Form in ${conds.join(" · ")}`).toBeDefined();
    expect(narrow, `keine geschlossene untere Form in ${conds.join(" · ")}`).toBeDefined();
    // Dieselbe Zahl auf beiden Seiten — sonst klafft oder ueberlappt es.
    const px = (c: string) => Number(/(\d+(?:\.\d+)?)px/.exec(c)?.[1]);
    expect(px(wide!)).toBe(px(narrow!));
    // Und KEINE der beiden darf die alte, luecken-erzeugende Form tragen.
    for (const c of conds) {
      expect(c, `min-/max-width laesst eine gebrochene Breite offen: ${c}`).not.toMatch(
        /\b(?:min|max)-width\s*:/,
      );
    }
  });
});
