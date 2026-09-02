// Goldene Regel 6 — AA-Kontrast, gemessen statt behauptet.
//
// Liest die Farb-Token direkt aus terminal.css (nicht aus einer Kopie im Test) und
// rechnet für BEIDE Themes die WCAG-2.1-Kontrastverhältnisse gegen den jeweiligen
// Hintergrund aus. Verlangt wird 4.5:1 — der AA-Wert für normalen Text. Die Akzente
// tragen im Skin nur Nicht-Text (LED, Block-Bar, Sparkline), für die 3:1 genügen
// würde; sie werden trotzdem gegen 4.5 geprüft (bewusste Reserve).
//
// Terminal hat keine Tweaks, also gibt es keine Tweak-Extreme, an denen der Kontrast
// kippen könnte — die beiden Themes sind der vollständige Farbraum dieses Skins.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../terminal.css", import.meta.url)), "utf8");

/** Alle `--token: #rrggbb;`-Paare aus dem Regelblock, der `selector` enthält. */
function tokensOf(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, `Selektor ${selector} fehlt in terminal.css`).toBeGreaterThan(-1);
  const block = css.slice(start, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const [, name, hex] of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    out[name!] = hex!;
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

/** WCAG-2.1-Kontrastverhältnis zweier Farben. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const AA = 4.5;
/** Token, die bewusst als Trennlinie/Fläche dienen und keinen Textkontrast tragen. */
const NON_TEXT = new Set(["--t-bg", "--t-line", "--t-surface"]);

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

  it("hält jeden Vordergrund-/Akzent-Token über 4.5:1 gegen den Hintergrund", () => {
    for (const [name, hex] of Object.entries(tokens)) {
      if (NON_TEXT.has(name)) continue;
      const ratio = contrast(hex, bg!);
      expect(
        ratio,
        `${theme} ${name} (${hex}) auf ${bg}: ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it("hält den gedimmten Text ebenfalls über AA (Raum, Einheit, Status)", () => {
    expect(contrast(tokens["--t-dim"]!, bg!)).toBeGreaterThanOrEqual(AA);
  });
});
