// Ratsche für die durchscheinenden Flächen (--vz-tile-bg · --vz-tile-bg-strong ·
// --vz-chip-bg) im dunklen Theme.
//
// ══ Warum diese Spec überhaupt existiert
//
// Der Konformitätslauf misst die Palette und schreibt den Befund nach support.json,
// aber sein Exit-Code kennt nur „hat der Skin eine undeklarierte gap". Solange ionic
// insgesamt `fail` ist — und das ist er, weil die Palette-Token auf --vz-bg noch
// Reste tragen —, bliebe ein Rückfall dieser drei Flächen auf einen Weiss-Wasch
// völlig unbemerkt: die Zahl in support.json stiege, der Lauf bliebe gleich rot.
// Dieselbe Lücke, die für die Ink-Achse schon in smoke.spec.ts geschlossen ist.
//
// ══ Was hier festgehalten wird
//
// Nicht die Farbwerte als Selbstzweck, sondern die REGEL, aus der sie folgen:
//
//   Eine durchscheinende Fläche zieht den FLÄCHENTON ihres Themes auf, nicht Weiss.
//   Ihr zusammengemischtes Pixel liegt damit für jede Deckkraft zwischen --vz-bg und
//   diesem Ton — der tileAlpha-Regler und das Stapeln von Chip auf Kachel können sie
//   nicht mehr aus dem Kontrast-Korridor tragen.
//
// Im hellen Theme galt die Regel schon immer, ohne dass es jemand aufgeschrieben
// hätte: der aufgezogene Ton IST dort Weiss, und Weiss ist --vz-solid. Im dunklen
// Theme war der Ton ebenfalls Weiss, der Korridor endet dort aber bei --vz-solid-2
// (#1f242d) — deshalb lief die Kachel auf #3b3e42 und der Chip, ein zweiter Wasch
// darüber, auf #535558 davon, mittlere Graus, auf denen kaum eine Farbe der Palette
// noch trägt.
//
// ══ Was die Spec NICHT behauptet
//
// Sie prüft die drei Flächen, nicht die Palette. Token, die schon auf --vz-bg oder
// --vz-solid scheitern, scheitern auch hier — das ist eine Eigenschaft dieser Token,
// keine der Fläche, und gehört auf die Palette-Achse. Sie standen namentlich in REST,
// damit die Auslassung eine Aussage blieb und nicht ein Vergessen (Goldene Regel 3);
// die Palette-Achse hat inzwischen geliefert, REST ist leer, und die Flächen-Ratsche
// misst damit wieder jede Paarung selbst.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { schema, type SkinManifest } from "@obs/visu-contract";
import manifestJson from "../manifest.json" with { type: "json" };

const manifest = manifestJson as unknown as SkinManifest;
const a11y = manifest.a11y!;

/** Das Stylesheet OHNE Kommentare — sonst zählt der Fliesstext als Deklaration. */
const CSS = readFileSync(fileURLToPath(new URL("../ionic.css", import.meta.url)), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Die Schwellen kommen aus dem Vertrag, nicht aus einem Literal hier. */
const THRESHOLDS = (schema as { a11y?: { thresholds?: { text?: number; graphic?: number } } }).a11y
  ?.thresholds ?? { text: 4.5, graphic: 3 };

/** Der Flächenton des dunklen Themes — die Obergrenze der ganzen Leiter. */
const TINT = "35, 40, 48" as const; // #232830

/** Die drei Flächen, um die es geht, mit dem Grund, über dem sie real liegen. */
const SURFACES = ["--vz-tile-bg", "--vz-tile-bg-strong", "--vz-chip-bg"] as const;

/**
 * Vordergrund/Deckkraft-Paare, die auf diesen Flächen weiterhin reissen, weil sie es
 * schon auf einem DECKENDEN Grund tun. Jeder Eintrag nennt den Grund, auf dem er
 * ebenfalls fällt — wer ihn hier streichen will, muss zuerst dort liefern.
 *
 * Die Liste ist LEER, seit die Palette-Achse geliefert hat. Sie stand mit sechs
 * Einträgen da (--vz-fg-soft@1 und @0.7, --vz-off@0.7, --vz-bad@0.7,
 * --vz-acc-slate@0.7, --vz-fg-mute@0.7); jeder von ihnen war ein Farbwert, der schon
 * auf --vz-bg, --vz-solid oder --vz-solid-2 riss, und jeder trägt seine Schwelle
 * inzwischen auf jedem erklärten Grund (siehe contrast.spec.ts). Der Mechanismus
 * bleibt stehen, weil er die Bauform für den nächsten begründeten Rest ist — ein
 * Eintrag hier setzt eine Messung AUS, also darf er nie ohne Begründung dastehen.
 */
const REST: Readonly<Record<string, string>> = {};

/* ------------------------------------------------------------------ Parsing */

/** Der Rumpf des Regelblocks, dessen Selektor exakt `selector` ist. */
function blockOf(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  expect(at, `Selektor ${selector} fehlt in ionic.css`).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("}", at));
}

function declOf(block: string, name: string): string {
  const hit = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block);
  expect(hit?.[1], `${name} fehlt im Block`).toBeDefined();
  return hit![1]!.trim();
}

const ROOT = blockOf(":root");
const DARK = blockOf('.visu-root[data-theme="dark"]');
/**
 * Der `--ion-*`-Brückenblock. Er sitzt auf DEMSELBEN Element wie `[data-theme]` und
 * trägt deshalb die Aliasse, die ihr Theme sehen müssen (`--vz-accent`,
 * `--vz-accent-ink`) — in `:root`, also auf <html>, wären sie auf den dunklen Boden
 * eingefroren, weil eine Custom Property auf dem Element substituiert wird, das ihre
 * Deklaration trägt. Ohne diese Zeile fände die Spec `--vz-accent` gar nicht mehr.
 */
const BRIDGE = blockOf(".visu-root");

/** Theme, dann Brücke, dann :root — dieselbe Reihenfolge, die die Kaskade hätte. */
function tokenValue(name: string): string {
  const dark = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(DARK);
  if (dark) return dark[1]!.trim();
  const bridge = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(BRIDGE);
  if (bridge) return bridge[1]!.trim();
  return declOf(ROOT, name);
}

/* ------------------------------------------------------------------- Farbe */

interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Der Alpha-Kanal, in derselben Grammatik, die auch der Generator beherrscht: eine
 * nackte Zahl, `var(--vz-tile-alpha)` oder ein `calc()`, das ausschliesslich
 * MULTIPLIZIERT.
 *
 * Der erste Entwurf prüfte nur `alpha.includes("--vz-tile-alpha")` und nahm dann den
 * Reglerwert — der Faktor in `calc(var(--vz-tile-alpha) * 0.7)` fiel unter den Tisch.
 * Die Spec hätte damit eine ANDERE Kachel gemessen als der Konformitätslauf und wäre
 * grün geblieben, während das Blatt etwas anderes ausliefert. Genau die Sorte
 * Wächter, die hier nirgends stehen darf.
 */
function alphaOf(expr: string, tileAlpha: number): number {
  const v = expr.trim();
  if (/^[0-9.]+$/.test(v)) return Number(v);
  if (/^var\(\s*--vz-tile-alpha\s*\)$/.test(v)) return tileAlpha;
  const calc = /^calc\(([\s\S]*)\)$/.exec(v);
  expect(calc, `Alpha nicht auflösbar: ${expr}`).not.toBeNull();
  // Nur Produkte — dieselbe Einschränkung wie im Generator. Eine Summe wäre dort
  // `unresolvable` und nähme die Fläche aus der Messung; sie ist hier ein Fehler.
  return calc![1]!.split("*").reduce((product, factor) => product * alphaOf(factor, tileAlpha), 1);
}

/**
 * Löst die Farbformen auf, die die dunkle Palette real benutzt: `#rrggbb`,
 * `rgba(r, g, b, a)` und den einstufigen Alias `var(--x)`. Der Alpha-Kanal läuft
 * über {@link alphaOf} — genau das macht der Generator auch.
 */
function color(value: string, tileAlpha: number): Rgba {
  const v = value.trim();
  const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
  if (alias) return color(tokenValue(alias[1]!), tileAlpha);

  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1]!;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }

  // `[\s\S]*` statt `[^)]*`: der Alpha-Kanal trägt selbst Klammern (`var(…)`,
  // `calc(…)`) mitten im Wert.
  const fn = /^rgba?\(([\s\S]*)\)$/i.exec(v);
  expect(fn, `nicht auflösbar: ${value}`).not.toBeNull();
  const parts = fn![1]!.split(",").map((p) => p.trim());
  const alpha = parts[3];
  return {
    r: Number(parts[0]),
    g: Number(parts[1]),
    b: Number(parts[2]),
    a: alpha === undefined ? 1 : alphaOf(alpha, tileAlpha),
  };
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(c: Rgba): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}
function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
/** Vordergrund über Grund — `alpha` skaliert zusätzlich (die gedimmte Kachel). */
function over(fg: Rgba, bg: Rgba, alpha = 1): Rgba {
  const a = fg.a * alpha;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/** Der Grund, wie er nach dem Mischen über seiner over-Kette real dasteht. */
function ground(token: string, tileAlpha: number): Rgba {
  const entry = a11y.grounds.find((g) => g.token === token);
  expect(entry, `${token} steht nicht in a11y.grounds`).toBeDefined();
  const own = color(tokenValue(token), tileAlpha);
  if (own.a >= 0.999 || entry!.over === undefined) return own;
  return over(own, ground(entry!.over, tileAlpha));
}

/** Die Reglerstellungen, die auch der Generator anfährt — aus dem Manifest, nicht geraten. */
const tileAlphaTweak = manifest.tweaks!["tileAlpha"]!;
const STOPS: readonly { label: string; value: number }[] = [
  { label: "min", value: tileAlphaTweak.min as number },
  { label: "default", value: tileAlphaTweak.default as number },
  { label: "max", value: tileAlphaTweak.max as number },
];

/* -------------------------------------------------------------------- Specs */

describe("dunkle Glasflächen ziehen den Flächenton auf, nicht Weiss", () => {
  it("alle drei Flächen sind Wasch-Stufen DESSELBEN Tons", () => {
    // Die eigentliche Ratsche gegen den Rückfall: einer der drei wieder auf
    // `rgba(255, 255, 255, …)` zu stellen, wäre genau der alte Fehler.
    for (const token of SURFACES) {
      expect(tokenValue(token), token).toMatch(
        new RegExp(`^rgba\\(\\s*${TINT.replace(/, /g, ",\\s*")}\\s*,`),
      );
    }
  });

  it("das helle Theme zieht Weiss auf — und Weiss IST dort --vz-solid", () => {
    // Warum das hier steht: es ist der Beweis, dass die Regel keine Sonderregel für
    // Dunkel ist. Das helle Theme erfüllt sie seit jeher, nur unausgesprochen.
    const light = blockOf('.visu-root[data-theme="light"]');
    expect(declOf(light, "--vz-solid")).toBe("#ffffff");
    for (const token of SURFACES) {
      expect(declOf(light, token), token).toMatch(/^rgba\(\s*255,\s*255,\s*255\s*,/);
    }
  });

  it.each(STOPS)("bleibt bei tileAlpha=$value innerhalb von --vz-bg … Flächenton", ({ value }) => {
    const bg = luminance(ground("--vz-bg", value));
    const cap = luminance(color(`rgba(${TINT}, 1)`, value));
    for (const token of SURFACES) {
      const l = luminance(ground(token, value));
      expect(l, `${token} unter --vz-bg`).toBeGreaterThan(bg);
      expect(l, `${token} über dem Flächenton`).toBeLessThanOrEqual(cap);
    }
  });

  it.each(STOPS)("hält bei tileAlpha=$value einen SICHTBAREN Schritt Kachel→Chip", ({ value }) => {
    // Warum ein Mindest-Schritt und nicht `toBeGreaterThan`: „heller als" ist keine
    // Aussage über eine abgesetzte Fläche. Der erste Entwurf dieser Zeile stand mit
    // 0.020883 gegen 0.020832 grün — 0.25% Abstand, 1.001:1 — und bescheinigte damit
    // genau den Zustand, den sie verhindern sollte: bei tileAlpha=0.9 waren die
    // Tasten in der Kachel nur noch Umrisse, weil die Kachel (die MIT dem Regler
    // wächst) den Chip und -strong (feste Wasch-Stufen) eingeholt hatte.
    //
    // 1.08:1 ist bewusst niedrig — es ist kein WCAG-Kriterium (eine Fläche in einer
    // Fläche trägt keine Zustandsinformation, WCAG 1.4.11 zielt auf Bedienelemente),
    // sondern die Untergrenze dafür, dass die Füllung überhaupt noch als eigene
    // Fläche liest statt nur als Rahmen. Der Kachel-Faktor 0.7 hält an jedem Stopp
    // mindestens 1.09.
    const tile = ground("--vz-tile-bg", value);
    for (const token of ["--vz-chip-bg", "--vz-tile-bg-strong"] as const) {
      expect(contrast(ground(token, value), tile), `${token} gegen --vz-tile-bg`).toBeGreaterThan(
        1.08,
      );
    }
  });
});

describe("auf den drei Flächen hält die dunkle Palette ihre Schwellen", () => {
  // Die Wirkungs-Ratsche. Sie fällt, sobald der Flächenton zwei Stufen heller wird:
  // ab rgb(37 42 50) reisst --vz-bad auf dem Chip, kurz danach --vz-acc-blue bei 0.7
  // Deckkraft. Der Deckel oben ist damit nicht behauptet, sondern belegt.
  for (const stop of STOPS) {
    for (const surface of SURFACES) {
      it(`${surface} @ tileAlpha=${stop.value}`, () => {
        const bg = ground(surface, stop.value);
        let measured = 0;
        for (const [token, entry] of Object.entries(a11y.tokens)) {
          if (entry.role !== "text" && entry.role !== "graphic") continue;
          if (!(entry.on ?? []).includes(surface)) continue;
          const threshold = entry.role === "text" ? THRESHOLDS.text! : THRESHOLDS.graphic!;
          for (const alpha of entry.alphas ?? [1]) {
            measured += 1;
            const ratio = contrast(over(color(tokenValue(token), stop.value), bg, alpha), bg);
            const rest = REST[`${token}@${alpha}`];
            if (rest !== undefined) {
              // Kein `toBeLessThan`: ein Rest, der plötzlich BESTEHT, ist eine gute
              // Nachricht — er soll die Spec nicht rot machen, sondern aus REST
              // verschwinden dürfen. Festgehalten wird nur, dass er benannt ist.
              expect(rest.length, `${token}@${alpha} ohne Begründung`).toBeGreaterThan(0);
              continue;
            }
            expect(ratio, `${token} @ Deckkraft ${alpha} auf ${surface}`).toBeGreaterThanOrEqual(
              threshold,
            );
          }
        }
        // Ein Wächter, der nichts misst, beweist nichts.
        expect(measured, `${surface} erzeugte keine Messung`).toBeGreaterThan(0);
      });
    }
  }
});
