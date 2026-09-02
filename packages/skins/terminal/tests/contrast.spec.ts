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
// Schwelle 4.5:1 für Token, die Text einfärben (`--t-fg`, `--t-dim`, und `--t-acc-amber`,
// das `.t-status.is-warn` trägt); 3:1 für reine Grafik-Token (LED-Punkt, Block-Bar,
// Sparkline — alle `aria-hidden`, die Aussage steht als Text daneben).
//
// Zwei Wächter halten die Messung ehrlich: einer prüft, dass jeder Farb-Token der Datei
// einer Klasse zugeordnet ist, der andere, dass keine unverrechnete Deckkraft auftaucht.
// Ohne sie driftet der Test still, sobald jemand Token oder Regeln ergänzt.
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

/**
 * Token, die in terminal.css TEXT einfärben: Vorder-/Sekundärfarbe und Amber — das
 * trägt `.t-status.is-warn`, also echten Fließtext. Sie müssen 4.5:1 halten.
 */
const TEXT_TOKENS = ["--t-fg", "--t-dim", "--t-acc-amber"];
/**
 * Token, die nur Grafik tragen: LED-Punkt, Block-Bar, Sparkline, Fokusrahmen. Für sie
 * gilt 3:1. Sie werden NICHT als Text gerendert — deshalb wäre 4.5:1 hier eine
 * erfundene Anforderung, keine strengere Prüfung.
 */
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
/** Reine Flächen/Linien — sie sind der Grund, nicht der Vordergrund. */
const GROUND_TOKENS = ["--t-bg", "--t-line", "--t-surface"];
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
    // LED-Punkt, Block-Bar, Sparkline: `aria-hidden`, die Aussage steht als Text daneben.
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

  it("erfasst jeden Farb-Token der Datei in genau einer Klasse", () => {
    // Ein neuer Token in terminal.css, den keine Klasse führt, bliebe ungemessen.
    const classified = new Set([...TEXT_TOKENS, ...GRAPHIC_TOKENS, ...GROUND_TOKENS]);
    for (const name of Object.keys(tokens)) {
      expect(classified, `${theme}: ${name} ist keiner Kontrast-Klasse zugeordnet`).toContain(name);
    }
  });
});

describe("Deckkraft-Wächter", () => {
  it("kennt jede Deckkraft, die terminal.css auf Farbe legt", () => {
    // Taucht in terminal.css eine neue Deckkraft auf, die oben nicht verrechnet
    // wird, ist die Messung unvollständig — dann fällt dieser Test, nicht der Skin.
    const found = [...css.matchAll(/opacity:\s*([0-9.]+)/g)].map((m) => Number(m[1]));
    const accounted = new Set(ALPHAS);
    for (const alpha of found) {
      expect(accounted, `unverrechnete Deckkraft ${alpha} in terminal.css`).toContain(alpha);
    }
    expect(found.length).toBeGreaterThan(0);
  });
});
