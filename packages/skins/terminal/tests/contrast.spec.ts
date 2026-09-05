// Goldene Regel 6 — AA-Kontrast, gemessen statt behauptet.
//
// Seit Vertrag 1.13 misst der KONFORMITÄTSLAUF die Palette: `manifest.a11y` sagt,
// welcher Token welche Rolle trägt, und der Generator rechnet WCAG darauf. Diese
// Spec dupliziert das nicht mehr — die Rollen-Listen, die hier früher standen,
// waren eine zweite Wahrheit neben dem Manifest. Sie liest die Rollen jetzt AUS
// dem Manifest und deckt genau die zwei Dinge ab, die der Vertrag bewusst NICHT
// trägt:
//
//   • **Stylesheet-Disziplin.** Der Vertrag prüft Vollständigkeit nur innerhalb der
//     erklärten Blöcke. Terminal ist klein genug für den vollständigen Scan: jede
//     Farbe der DATEI muss in einer rechenbaren Form (`#rrggbb`) stehen, und jede
//     `opacity`-Regel der Datei muss in `a11y.alphas` vorkommen. Ein Skin mit einem
//     2000-Zeilen-Blatt trüge hier nur Rauschen davon; terminal nicht.
//   • **Füllung gegen Spur.** `--t-bar-track` färbt die ░-Glyphen der unbefüllten
//     Balkenspur. Das ist Vordergrund, aber die Information des Balkens ist die
//     Grenze Füllung↔Spur, nicht Spur↔Grund — ein Paar Vordergrund/Vordergrund,
//     das die Vertrags-Fläche (Vordergrund↔Grund) nicht ausdrücken kann. Deshalb
//     steht der Token dort als `exempt` MIT Begründung und wird hier gemessen.
//
// Terminal hat keine Tweaks, also gibt es keine Tweak-Extreme, an denen der Kontrast
// kippen könnte — die beiden Themes sind der vollständige Farbraum dieses Skins.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SkinManifest } from "@obs/visu-contract";
import manifestJson from "../manifest.json" with { type: "json" };

const css = readFileSync(fileURLToPath(new URL("../terminal.css", import.meta.url)), "utf8");
const a11y = (manifestJson as unknown as SkinManifest).a11y!;

/** Die einzige Farbform, die dieses Rechenwerk kann. */
const SUPPORTED_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Sieht der Wert nach einer Farbe aus? Bewusst weit gefasst: alles, was hier
 * anschlägt, MUSS in einer rechenbaren Form vorliegen — sonst schlägt Wächter 2 zu.
 */
const COLOR_SHAPED =
  /^(#|rgba?\(|hsla?\(|hwb\(|lab\(|lch\(|oklab\(|oklch\(|color\(|color-mix\(|light-dark\(|transparent\b|currentcolor\b)/i;

/**
 * Syntax, die einen Alpha-Kanal einführt, den dieses Rechenwerk NICHT verrechnet.
 * `opacity:` ist bewusst nicht dabei — dessen Werte prüft Wächter 3 einzeln.
 */
const UNACCOUNTED_ALPHA: readonly (readonly [string, RegExp])[] = [
  ["rgba()/rgb() mit Alpha", /\brgba?\([^)]*(,\s*(0?\.\d+|0|1)\s*\)|\/)/i],
  ["hsla()/hsl() mit Alpha", /\bhsla?\([^)]*(,\s*(0?\.\d+|0|1)\s*\)|\/)/i],
  ["8-stelliges Hex", /#[0-9a-f]{8}(?![0-9a-f])/i],
  ["4-stelliges Hex", /#[0-9a-f]{4}(?![0-9a-f])/i],
  ["color-mix()", /\bcolor-mix\(/i],
  ["filter/backdrop-filter", /\b(backdrop-)?filter\s*:/i],
  ["opacity() als Funktion", /\bopacity\(/i],
];

/** Alle `--name: wert`-Deklarationen eines Textabschnitts, roh. */
function declarations(block: string): [string, string][] {
  return [...block.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map(([, name, value]) => [
    name!,
    value!.trim(),
  ]);
}

/** Alle rechenbaren Farb-Token aus dem Regelblock, der `selector` enthält. */
function tokensOf(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, `Selektor ${selector} fehlt in terminal.css`).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const [name, value] of declarations(block)) {
    if (SUPPORTED_COLOR.test(value)) out[name] = value.toLowerCase();
  }
  return out;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

/** WCAG-2.1-Kontrastverhältnis zweier (deckender) Farben. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Vordergrund mit Deckkraft `alpha` über den Grund gemischt — das reale Pixel. */
export function composite(fg: string, bg: string, alpha: number): string {
  const mix = [1, 3, 5].map((i) => {
    const f = parseInt(fg.slice(i, i + 2), 16);
    const b = parseInt(bg.slice(i, i + 2), 16);
    return Math.round(f * alpha + b * (1 - alpha));
  });
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** AA für Nicht-Text-Grafik (WCAG 1.4.11). */
const AA_NON_TEXT = 3;

/** Die Deckkräfte, die das Manifest deklariert — eine Quelle, nicht zwei. */
const ALPHAS = a11y.alphas ?? [1];
/** Die Akzente sind die Balkenfüllung, gegen die sich die Spur absetzen muss. */
const ACCENT_TOKENS = Object.keys(a11y.tokens).filter((t) => t.startsWith("--t-acc-"));

describe("Wächter (Stylesheet-Disziplin — was die Vertrags-Fläche nicht trägt)", () => {
  it("1 · führt jeden Farb-Token der DATEI in a11y.tokens", () => {
    // Der Konformitätslauf prüft Vollständigkeit nur in den ERKLÄRTEN Blöcken.
    // terminal.css ist klein genug, um die ganze Datei zu scannen: ein Farb-Token
    // ausserhalb der Theme-Blöcke bliebe sonst ungemessen und unbemerkt.
    for (const [name, value] of declarations(css)) {
      if (!SUPPORTED_COLOR.test(value)) continue;
      expect(Object.keys(a11y.tokens), `${name} hat keine Rolle in manifest.a11y`).toContain(name);
    }
  });

  it("2 · lässt keine Farbform durch, die dieses Rechenwerk nicht kann", () => {
    // Ein Token als rgb() oder 3-stelliges Hex entkäme sonst lautlos: tokensOf()
    // sähe ihn nicht, und damit auch Wächter 1 nicht.
    for (const [name, value] of declarations(css)) {
      if (!COLOR_SHAPED.test(value)) continue;
      expect(
        SUPPORTED_COLOR.test(value),
        `${name}: ${value} — dieser Test rechnet nur #rrggbb. Farbe umschreiben oder das Rechenwerk erweitern.`,
      ).toBe(true);
    }
  });

  it("3 · kennt jede Deckkraft und lässt keinen unverrechneten Alpha-Kanal durch", () => {
    const found = [...css.matchAll(/opacity\s*:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
    const accounted = new Set<number>(ALPHAS);
    for (const alpha of found) {
      expect(
        accounted,
        `unverrechnete Deckkraft ${alpha} in terminal.css — in manifest.a11y.alphas aufnehmen`,
      ).toContain(alpha);
    }
    expect(found.length, "keine opacity-Regel mehr gefunden — Wächter ins Leere?").toBeGreaterThan(
      0,
    );

    for (const [label, pattern] of UNACCOUNTED_ALPHA) {
      const hit = pattern.exec(css);
      expect(
        hit?.[0],
        `${label} in terminal.css ("${hit?.[0] ?? ""}") — der Alpha-Kanal geht in keine Messung ein.`,
      ).toBeUndefined();
    }
  });

  it("4 · deklariert jede Ausnahme mit Begründung (Goldene Regel 3)", () => {
    for (const [name, entry] of Object.entries(a11y.tokens)) {
      if (entry.role !== "exempt") continue;
      expect(entry.reason?.length ?? 0, `${name}: exempt ohne reason`).toBeGreaterThan(0);
    }
  });
});

describe.each(Object.entries(a11y.themes))("Balken · Theme %s", (theme, selector) => {
  const tokens = tokensOf(selector);
  const bg = tokens["--t-bg"];

  it("setzt die Balkenfüllung gegen die Spur über 3:1 ab", () => {
    // Das eine Paar, das die Vertrags-Fläche nicht ausdrücken kann: Vordergrund
    // gegen Vordergrund. Die Spur gegen den GRUND zu prüfen wäre die falsche Frage —
    // sie ist absichtlich leise (~1.3:1), und ihr Wert steht ohnehin als Zahl in
    // derselben Zeile. Deshalb steht --t-bar-track im Manifest als `exempt`.
    const trackHex = tokens["--t-bar-track"];
    expect(trackHex, `${theme}: --t-bar-track`).toBeDefined();
    for (const accent of ACCENT_TOKENS) {
      const fill = tokens[accent];
      expect(fill, `${theme}: ${accent}`).toBeDefined();
      for (const alpha of ALPHAS) {
        const ratio = contrast(composite(fill!, bg!, alpha), composite(trackHex!, bg!, alpha));
        expect(
          ratio,
          `${theme} Füllung ${accent} (${fill}) gegen Spur ${trackHex} @${alpha}: ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    }
  });

  it("definiert einen Hintergrund und die vollständige Akzent-Palette", () => {
    expect(bg, `${theme}: --t-bg`).toBeDefined();
    for (const token of ["orange", "teal", "violet", "green", "blue", "rose", "amber", "slate"]) {
      expect(tokens[`--t-acc-${token}`], `${theme}: --t-acc-${token}`).toBeDefined();
    }
  });
});
