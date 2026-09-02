// Goldene Regel 6 — AA-Kontrast, gemessen statt behauptet.
//
// Liest die Farb-Token direkt aus terminal.css (nicht aus einer Kopie im Test) und
// rechnet für BEIDE Themes die WCAG-2.1-Kontrastverhältnisse aus — und zwar für das
// KOMPOSITUM, wie es real auf dem Schirm steht, nicht nur Token gegen `--t-bg`:
//
//   • zwei Gründe: `--t-bg` (Zeilenfläche) und `--t-surface` (Befehlsknopf),
//   • jede Deckkraft, die terminal.css auf Farbe legt: 1 (Normalfall) und 0.85
//     (`.t-row.is-locked .t-state` / `.t-row.is-readonly`) — die Farbe wird über
//     den Grund gemischt, bevor gemessen wird.
//
// Vier Rollen, drei Schwellen — jeder Token wird nach dem gemessen, was er WIRKLICH
// einfärbt, nicht nach der bequemsten Klasse:
//
//   • TEXT (4.5:1, WCAG 1.4.3) — `--t-fg`, `--t-dim` und `--t-acc-amber`; letzteres
//     trägt `.t-status.is-warn`, also echten Fließtext.
//   • GRAFIK (3:1, WCAG 1.4.11) — LED-Punkt, Balkenfüllung, Sparkline. Alle
//     `aria-hidden`; die Aussage steht als Zahl/Wort daneben.
//   • SPUR (Sonderfall) — `--t-bar-track` färbt die ░-Glyphen der unbefüllten
//     Balkenspur. Das ist VORDERGRUND, aber die Information des Balkens ist die
//     Grenze zwischen Füllung und Spur, nicht die Spur gegen den Grund. Gemessen
//     wird deshalb Füllung↔Spur gegen 3:1. Gegen den Grund liegt die Spur bewusst
//     bei ~1.3:1 — sie soll eine leise Führung sein; wäre sie so kräftig wie die
//     Füllung, wäre der Balken nicht mehr ablesbar.
//   • GRUND — `--t-bg`, `--t-surface` (Flächen) und `--t-line` (Zeilentrenner +
//     Knopfrahmen). Sie sind der Bezug, nicht der Vordergrund.
//
// Drei Wächter halten die Messung ehrlich — sie greifen Drift, nicht den Skin:
//   1. jeder Farb-Token der Datei liegt in GENAU EINER Klasse,
//   2. jeder Token, der wie eine Farbe aussieht, liegt in einer Form vor, die dieser
//      Test rechnen kann (`#rrggbb`) — sonst fällt der Test, statt zu schweigen,
//   3. es gibt keine Deckkraft und keinen Alpha-Kanal, den dieser Test nicht verrechnet.
//
// Terminal hat keine Tweaks, also gibt es keine Tweak-Extreme, an denen der Kontrast
// kippen könnte — die beiden Themes sind der vollständige Farbraum dieses Skins.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../terminal.css", import.meta.url)), "utf8");

/** Die einzige Farbform, die dieser Test rechnen kann. */
const SUPPORTED_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Sieht der Wert nach einer Farbe aus? Bewusst weit gefasst: alles, was hier
 * anschlägt, MUSS in einer rechenbaren Form vorliegen — sonst schlägt Wächter 2 zu.
 * Nicht-Farben (Schriftstapel, Längen) fallen durch und werden übersprungen.
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

/** AA für normalen Text (WCAG 1.4.3). */
const AA_TEXT = 4.5;
/** AA für Nicht-Text-Grafik (WCAG 1.4.11). */
const AA_NON_TEXT = 3;

/** Token, die TEXT einfärben. */
const TEXT_TOKENS = ["--t-fg", "--t-dim", "--t-acc-amber"];
/** Token, die Grafik gegen den GRUND tragen: LED, Balkenfüllung, Sparkline. */
const GRAPHIC_TOKENS = [
  "--t-led-off",
  "--t-acc-orange",
  "--t-acc-teal",
  "--t-acc-violet",
  "--t-acc-green",
  "--t-acc-blue",
  "--t-acc-rose",
  "--t-acc-slate",
];
/** Die Akzente — sie sind die Balkenfüllung, gegen die die Spur sich absetzen muss. */
const ACCENT_TOKENS = GRAPHIC_TOKENS.filter((t) => t.startsWith("--t-acc-")).concat([
  "--t-acc-amber",
]);
/** Vordergrund, der NICHT gegen den Grund gemessen wird — siehe Kopf, Rolle „SPUR". */
const TRACK_TOKENS = ["--t-bar-track"];
/** Flächen und Chrome-Linien: der Bezug, nicht der Vordergrund. */
const GROUND_TOKENS = ["--t-bg", "--t-surface", "--t-line"];
/**
 * Deckkraft, die terminal.css auf Farbe legt: 1 (Normalfall) und 0.85
 * (`.t-row.is-locked .t-state` / `.t-row.is-readonly`). Beide werden gemessen.
 */
const ALPHAS = [1, 0.85];

describe.each([
  ["dark", '.t-root[data-theme="dark"]'],
  ["light", '.t-root[data-theme="light"]'],
])("AA-Kontrast · Theme %s", (theme, selector) => {
  const tokens = tokensOf(selector);
  const bg = tokens["--t-bg"];

  it("definiert einen Hintergrund und die vollständige Akzent-Palette", () => {
    expect(bg, `${theme}: --t-bg`).toBeDefined();
    for (const token of ["orange", "teal", "violet", "green", "blue", "rose", "amber", "slate"]) {
      expect(tokens[`--t-acc-${token}`], `${theme}: --t-acc-${token}`).toBeDefined();
    }
  });

  it("hält jeden Text-Token über 4.5:1 — auf beiden Gründen, bei jeder Deckkraft", () => {
    // Nicht Token gegen --t-bg, sondern das reale Pixel: Text steht auch auf dem
    // Knopf-Grund (--t-surface) und wird bei gesperrt/readonly mit 0.85 gedeckt.
    for (const name of TEXT_TOKENS) {
      const hex = tokens[name];
      expect(hex, `${theme}: ${name}`).toBeDefined();
      for (const ground of [bg!, tokens["--t-surface"]!]) {
        for (const alpha of ALPHAS) {
          const effective = composite(hex!, ground, alpha);
          const ratio = contrast(effective, ground);
          expect(
            ratio,
            `${theme} ${name} (${hex}) @${alpha} auf ${ground} → ${effective}: ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(AA_TEXT);
        }
      }
    }
  });

  it("hält jeden Grafik-Token über der Nicht-Text-Schwelle 3:1", () => {
    // LED-Punkt, Balkenfüllung, Sparkline: `aria-hidden`, die Aussage steht als Text daneben.
    for (const name of GRAPHIC_TOKENS) {
      const hex = tokens[name];
      expect(hex, `${theme}: ${name}`).toBeDefined();
      for (const alpha of ALPHAS) {
        const effective = composite(hex!, bg!, alpha);
        const ratio = contrast(effective, bg!);
        expect(
          ratio,
          `${theme} ${name} (${hex}) @${alpha}: ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    }
  });

  it("setzt die Balkenfüllung gegen die Spur über 3:1 ab", () => {
    // Die Aussage des Balkens ist die Grenze Füllung↔Spur — genau dieses Paar wird
    // gemessen. Die Spur gegen den Grund zu prüfen wäre die falsche Frage: sie ist
    // absichtlich leise, und ihr Wert steht ohnehin als Zahl in derselben Zeile.
    for (const track of TRACK_TOKENS) {
      const trackHex = tokens[track];
      expect(trackHex, `${theme}: ${track}`).toBeDefined();
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
    }
  });
});

describe("Wächter", () => {
  const CLASSES: [string, readonly string[]][] = [
    ["TEXT_TOKENS", TEXT_TOKENS],
    ["GRAPHIC_TOKENS", GRAPHIC_TOKENS],
    ["TRACK_TOKENS", TRACK_TOKENS],
    ["GROUND_TOKENS", GROUND_TOKENS],
  ];

  it("1 · führt jeden Farb-Token der Datei in genau einer Klasse", () => {
    const seen = new Map<string, string>();
    for (const [className, names] of CLASSES) {
      for (const name of names) {
        const previous = seen.get(name);
        expect(previous, `${name} steht in ${previous} UND ${className}`).toBeUndefined();
        seen.set(name, className);
      }
    }
    // Jeder rechenbare Farb-Token der Datei muss geführt sein — sonst bliebe er ungemessen.
    for (const [name, value] of declarations(css)) {
      if (!SUPPORTED_COLOR.test(value)) continue;
      expect([...seen.keys()], `${name} ist keiner Kontrast-Klasse zugeordnet`).toContain(name);
    }
  });

  it("2 · lässt keine Farbform durch, die dieser Test nicht rechnen kann", () => {
    // Ein Token als rgb() oder 3-stelliges Hex entkäme sonst lautlos BEIDEN Wächtern:
    // tokensOf() sähe ihn nicht, und damit auch Wächter 1 nicht.
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
    const accounted = new Set(ALPHAS);
    for (const alpha of found) {
      expect(accounted, `unverrechnete Deckkraft ${alpha} in terminal.css`).toContain(alpha);
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
});
