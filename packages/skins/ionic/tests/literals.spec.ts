// Ratsche gegen rohe Farbe im Stylesheet.
//
// ══ Warum diese Spec existiert
//
// Der Konformitätslauf hat dafür einen eigenen Riegel: eine Farbe, die direkt in
// einer gewöhnlichen Deklaration steht (`color: #fff`, `box-shadow: … rgba(…)`),
// ist ein Befund, weil sie NICHT MESSBAR ist — sie hat keinen Namen, keine Rolle
// und keinen erklärten Grund. Nur: ionics Lauf ist aus einem ANDEREN Grund rot
// (`unmeasuredTweaks` → `checkedTweakExtremes: false`, siehe manifest.a11y). Ein
// Rückfall auf rohe Farbe bliebe deshalb unbemerkt: die Zahl in support.json
// stiege, der Exit-Code bliebe derselbe. Dieselbe Lücke, die surfaces.spec.ts für
// die drei Glasflächen schliesst.
//
// ══ Was hier festgehalten wird — die WIRKUNG, nicht die Schreibweise
//
//   1. Keine Farbe im Blatt läuft an einem benannten Token vorbei.
//   2. Jedes benannte Token hat im Manifest eine Rolle (sonst wäre Umbenennen
//      allein schon ein Ausweg: ein Token ohne Rolle ist genauso ungemessen wie
//      ein Literal).
//   3. Und der eigentliche Punkt: was TEXT oder ein GLYPH färbt, endet bei einem
//      gemessenen Token. Ein `exempt` darf in einer solchen Deklaration nur
//      stehen, wenn es selbst ein Alias auf ein gemessenes Token ist (`--acc:
//      var(--vz-accent)` — der Renderer setzt ihn je Kachel auf einen der acht
//      Palette-Akzente, die alle gemessen sind).
//
// Punkt 3 ist der Riegel gegen den billigen Weg, einen Befund loszuwerden: einen
// Textfarb-Token als `exempt` zu deklarieren, damit die Zahl fällt. Punkt 1
// allein wäre dagegen blind — der Token hiesse dann eben `--vz-irgendwas` und
// stünde mit einer Begründung im Report, ohne je gemessen zu werden.
//
// Die Spec liest das ECHTE Blatt und das ECHTE Manifest; sie bringt keine
// Erwartungswerte mit, die man beim nächsten Farbdreher stillschweigend
// mitzieht.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SkinManifest } from "@obs/visu-contract";
import manifestJson from "../manifest.json" with { type: "json" };

const manifest = manifestJson as unknown as SkinManifest;
const tokens = manifest.a11y!.tokens;

const CSS = readFileSync(fileURLToPath(new URL("../ionic.css", import.meta.url)), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/* ------------------------------------------------------------- CSS-Zerlegung */

/** Trennt an `sep`, aber nur auf oberster Klammer-/Anführungsebene. */
function splitTop(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const ch of input) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === sep && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

interface Decl {
  readonly selector: string;
  readonly prop: string;
  readonly value: string;
}

/** Jede Deklaration jedes innersten Blocks, mit dem Selektor, in dem sie steht. */
function declarations(css: string): Decl[] {
  const out: Decl[] = [];
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Alles vor dem letzten `;` gehört zu einer At-Anweisung (`@import …;`).
    const head = (rule[1] ?? "").slice((rule[1] ?? "").lastIndexOf(";") + 1);
    const selector = head
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("@"))
      .join(", ");
    if (selector.length === 0) continue;
    for (const part of splitTop(rule[2] ?? "", ";")) {
      const cut = part.indexOf(":");
      if (cut <= 0) continue;
      const prop = part.slice(0, cut).trim();
      const value = part
        .slice(cut + 1)
        .replace(/!\s*important\s*$/i, "")
        .trim();
      if (value.length === 0) continue;
      out.push({ selector, prop, value });
    }
  }
  return out;
}

const DECLS = declarations(CSS);
const CUSTOM = DECLS.filter((d) => d.prop.startsWith("--") && d.prop.length > 2);
const PLAIN = DECLS.filter((d) => !d.prop.startsWith("--") && /^[a-z-]+$/i.test(d.prop));

/**
 * Trägt der Wert eine Farbe DIREKT? Dieselbe Lesart wie der Generator: bewusst
 * weit, damit `red`, `oklch(…)` und `color-mix(…)` genauso anschlagen wie ein
 * Hexwert. `var(…)` steht NICHT drin — das ist ja der erwünschte Weg.
 */
const COLOR_BEARING =
  /(#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(|\b(?:red|blue|green|black|white|gray|grey|yellow|orange|purple|pink|brown|cyan|magenta|silver|gold|navy|teal|olive|maroon|lime|aqua|fuchsia|indigo|violet|beige|ivory|khaki|coral|salmon|crimson|turquoise|lavender|plum|tan|azure|orchid|tomato|wheat|linen|snow|seashell|honeydew|currentcolor)\b)/i;

/** Zeichenketten und `url()` tragen keine Farbe, können aber `#…` enthalten. */
const probe = (value: string): string =>
  value.replace(/url\([^)]*\)/gi, "").replace(/"[^"]*"|'[^']*'/g, "");

/* ---------------------------------------------------- Token-Graph (Punkt 3) */

/** Alle Werte, die ein Token im Blatt irgendwo bekommt. */
const VALUES = new Map<string, string[]>();
for (const d of CUSTOM) {
  const list = VALUES.get(d.prop) ?? [];
  list.push(d.value);
  VALUES.set(d.prop, list);
}

const refs = (value: string): string[] =>
  [...value.matchAll(/var\(\s*(--[^\s,)]+)/g)].map((m) => m[1]!);

/**
 * Endet dieser Token bei einem GEMESSENEN Token (`text`/`graphic`)?
 *
 * `exempt`/`ground` sind nur dann in Ordnung, wenn sie reine Weiterleitungen
 * sind: jeder `var()` in ihrem Wert muss selbst dort enden. Ein `exempt` mit
 * einem eigenen Farbwert (oder ganz ohne Deklaration im Blatt) endet nicht.
 */
const MEASURED = new Map<string, boolean>();
function endsAtMeasured(name: string, path = new Set<string>()): boolean {
  const cached = MEASURED.get(name);
  if (cached !== undefined) return cached;
  if (path.has(name)) return false; // Zyklus — nur DIESER Pfad ist blockiert
  const role = tokens[name]?.role;
  if (role === "text" || role === "graphic") {
    MEASURED.set(name, true);
    return true;
  }
  const values = VALUES.get(name);
  const next = new Set(path).add(name);
  const ok =
    values !== undefined &&
    values.length > 0 &&
    values.every((v) => {
      const r = refs(v);
      return r.length > 0 && r.every((n) => endsAtMeasured(n, next));
    });
  MEASURED.set(name, ok);
  return ok;
}

/** Eigenschaften, die Text oder ein Glyph einfärben. */
const INK_PROPS = new Set([
  "color",
  "-webkit-text-fill-color",
  "text-decoration-color",
  "caret-color",
  "fill",
  "stroke",
]);
const INK = PLAIN.filter((d) => INK_PROPS.has(d.prop.toLowerCase()));

/* -------------------------------------------------------------------- Specs */

describe("keine Farbe laeuft an einem benannten Token vorbei", () => {
  it("der Scan hat das Blatt ueberhaupt gesehen", () => {
    // Ohne diese Zeile waere ein kaputter Parser ein gruener Lauf.
    expect(PLAIN.length).toBeGreaterThan(400);
    expect(CUSTOM.length).toBeGreaterThan(100);
    expect(INK.length).toBeGreaterThan(30);
    expect(PLAIN.some((d) => d.selector === ".vz-lock" && d.prop === "color")).toBe(true);
  });

  it("keine gewoehnliche Deklaration traegt eine Farbe direkt", () => {
    const raw = PLAIN.filter((d) => COLOR_BEARING.test(probe(d.value))).map(
      (d) => `${d.selector} { ${d.prop}: ${d.value.replace(/\s+/g, " ")} }`,
    );
    expect(
      raw,
      `rohe Farbe im Blatt — sie hat keinen Namen, keine Rolle und keinen erklaerten Grund:\n  ${raw.join("\n  ")}`,
    ).toEqual([]);
  });

  it("jedes Token im Blatt traegt im Manifest eine Rolle", () => {
    // Umbenennen allein waere sonst der Ausweg: ein Token ohne Rolle ist genauso
    // ungemessen wie ein Literal. (Der Generator prueft dasselbe; hier steht es
    // noch einmal, weil sein Exit-Code fuer ionic aus anderem Grund rot ist.)
    // „Farbtragend" heisst: der Wert IST eine Farbe, oder er zeigt (ueber
    // beliebig viele Zwischenschritte) auf einen Token, der im Manifest als
    // Farbe gefuehrt wird. Ohne den zweiten Teil zaehlte `--ion-font-family:
    // var(--vz-font)` als Farbe — und ein Waechter mit falschem Alarm wird
    // ignoriert.
    const carriesColour = (name: string, path = new Set<string>()): boolean => {
      if (path.has(name)) return false;
      if (tokens[name] !== undefined) return true;
      const next = new Set(path).add(name);
      return (VALUES.get(name) ?? []).some(
        (v) => COLOR_BEARING.test(probe(v)) || refs(v).some((n) => carriesColour(n, next)),
      );
    };
    const colored = [...VALUES.entries()].filter(([, vs]) =>
      vs.some((v) => COLOR_BEARING.test(probe(v)) || refs(v).some((n) => carriesColour(n))),
    );
    const orphans = colored.filter(([name]) => tokens[name] === undefined).map(([name]) => name);
    expect(orphans, `Token ohne Rolle in a11y.tokens:\n  ${orphans.join("\n  ")}`).toEqual([]);
  });
});

describe("was Text oder ein Glyph faerbt, endet bei einem gemessenen Token", () => {
  it("keine Tinten-Deklaration endet in einer ausgenommenen Farbe", () => {
    const broken: string[] = [];
    for (const d of INK) {
      const v = d.value.trim();
      // `inherit`/`currentColor` reichen die Farbe des Elternteils weiter — sie
      // ist dort deklariert und wird dort geprueft.
      if (/^(inherit|currentcolor|initial|unset|none|transparent)$/i.test(v)) continue;
      const names = refs(v);
      if (names.length === 0) continue; // Literal — faengt die Spec oben
      for (const name of names) {
        if (!endsAtMeasured(name)) {
          broken.push(
            `${d.selector} { ${d.prop}: ${v} } → ${name} (${tokens[name]?.role ?? "ohne Rolle"})`,
          );
        }
      }
    }
    expect(
      broken,
      `faerbt Text/Glyph, endet aber nicht bei einem gemessenen Token — genau der billige Weg,\n` +
        `einen Befund loszuwerden, statt die Farbe messen zu lassen:\n  ${broken.join("\n  ")}`,
    ).toEqual([]);
  });
});
