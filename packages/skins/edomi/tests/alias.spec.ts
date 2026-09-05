// Ratsche gegen den Alias, der auf <html> einfriert.
//
// ══ Der Fehler, gegen den sie steht
//
// Die Substitution einer Custom Property passiert auf dem Element, das die
// DEKLARATION trägt — nicht auf dem, das sie liest. `:root` ist `<html>`. Das
// Wurzel-div dieses Skins trägt `class: ["edomi-root", "visu-root"]` (page.ts)
// und ist damit ein NACHFAHRE von `<html>`. Alles, was erst dort gesetzt wird —
// die Ionic-Brücke (`--ion-background-color`, `--ion-text-color`) und die ganze
// Theme-Palette (`--vz-bg`, `--vz-fg`, …) — existiert auf `<html>` nicht.
//
// Ein Alias in `:root`, der so etwas liest, findet es nicht und fällt auf seinen
// Rückfall zurück. Gemessen im Browser (`--edomi-canvas-bg` in `:root` gegen
// dieselbe Deklaration in `.visu-root`):
//
//     :root       bg rgb(15, 18, 22)   fg rgb(232, 236, 242)   ← Rückfall
//     .visu-root  bg rgb(14, 17, 22)   fg rgb(238, 240, 244)   ← --vz-bg / --vz-fg
//
// Die zwei Farbeinheiten sind das kleinere Problem. Das größere: der
// Konformitätslauf faltet den `.visu-root`-Block über `cascadesInto` in seine
// Umgebung und löst den Alias sehr wohl auf `--vz-bg` / `--vz-fg` auf. Er MISST
// dann eine Farbe, die der Browser nie malt — ein deklarierter `ground` und ein
// deklarierter `text`-Token stünden gegen fiktive Werte.
//
// ionic hat gegen genau diesen Mechanismus seit der Palette-Runde einen Wächter
// in tests/contrast.spec.ts („kein Alias in :root zeigt auf ein Token, das ein
// Theme überschreibt"). edomi hatte keinen — und der Fehler ist hier prompt
// zweimal passiert. Das ist er.
//
// ══ Was geprüft wird — die Wirkung, nicht die Schreibweise
//
// Nicht „diese zwei Token stehen in diesem Block", sondern die REGEL dahinter:
// eine `:root`-Deklaration darf nur Token lesen, die selbst in `:root` stehen.
// Wer morgen einen dritten Alias hinzufügt, fällt genauso auf.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

/** Beide Blätter, die edomis a11y-Deklaration nennt. */
const EDOMI = read("../src/edomi.css");
const IONIC = read("../../ionic/ionic.css");

interface Decl {
  readonly selectors: readonly string[];
  readonly name: string;
  readonly value: string;
}

/** Jede Custom-Property-Deklaration beider Blätter, mit ihren Selektoren. */
function customProperties(css: string): Decl[] {
  const out: Decl[] = [];
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const head = (rule[1] ?? "").slice((rule[1] ?? "").lastIndexOf(";") + 1);
    const selectors = head
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("@"));
    if (selectors.length === 0) continue;
    for (const part of (rule[2] ?? "").split(";")) {
      const cut = part.indexOf(":");
      if (cut <= 0) continue;
      const name = part.slice(0, cut).trim();
      const value = part.slice(cut + 1).trim();
      if (!name.startsWith("--") || name.length < 3 || value.length === 0) continue;
      out.push({ selectors, name, value });
    }
  }
  return out;
}

const ALL = [...customProperties(EDOMI), ...customProperties(IONIC)];

/**
 * Wird diese Deklaration auf `<html>` — oder einem Vorfahren des Skin-Wurzel-divs
 * — ausgewertet?
 *
 * Nicht nur `:root`. `html`, `body` und `*` treffen dasselbe Element bzw. einen
 * Vorfahren, frieren einen Alias also genauso ein; der Generator faltet sie über
 * dieselbe Regel in seine Umgebung (`cascadesInto`:
 * `/^(?::root|html|body|\*)\b/`). Ein Wächter, der nur den Literalstring
 * `":root"` kennt, liesse `html { --x: var(--vz-bg) }` durch.
 *
 * Und `some` statt `every`: `:root, .edomi-nav { … }` gilt für BEIDE Elemente,
 * wird auf `<html>` also ausgewertet — mit `every` rutschte ein solcher Block
 * durch.
 */
// Etwas strenger als cascadesInto: dessen `\b` nach dem `*` laesst den nackten
// Universalselektor durchfallen (kein Wortzeichen davor/danach). Ein Waechter darf
// in diese Richtung irren, ein Generator nicht.
const ROOTISH = /^(?::root\b|html\b|body\b|\*)/;
const appliesToHtml = (d: Decl): boolean => d.selectors.some((sel) => ROOTISH.test(sel));

/**
 * Token, die IRGENDWO auf einem Nachfahren von `<html>` gesetzt werden — auch
 * dann, wenn sie zusätzlich in `:root` stehen. Genau dieser Fall ist der
 * gefährliche: der `:root`-Alias friert den `:root`-Wert ein und verpasst die
 * Überschreibung weiter unten, während der Generator sie sehr wohl sieht. Eine
 * Ausnahme für „steht auch in :root" wäre also das zweite Loch.
 */
const ON_DESCENDANT = new Set(
  ALL.filter((d) => d.selectors.some((sel) => !ROOTISH.test(sel))).map((d) => d.name),
);

const refs = (value: string): string[] =>
  [...value.matchAll(/var\(\s*(--[^\s,)]+)/g)].map((m) => m[1]!);

describe("kein Alias in :root liest ein Token, das erst auf einem Nachfahren steht", () => {
  it("die Blaetter sind ueberhaupt gelesen", () => {
    // Ohne diese Zeile waere ein falscher Pfad ein gruener Lauf.
    expect(EDOMI.length).toBeGreaterThan(2000);
    expect(IONIC.length).toBeGreaterThan(20000);
    expect(ALL.filter(appliesToHtml).length).toBeGreaterThan(20);
    // Die Wurzel-Formen, die der Waechter kennen MUSS — sonst ist die Regel
    // oben nur ein Sonderfall von `:root`.
    expect([":root", "html", "body", "*", "html.dark"].filter((s) => ROOTISH.test(s))).toEqual([
      ":root",
      "html",
      "body",
      "*",
      "html.dark",
    ]);
    expect([".edomi-nav", ".visu-root", "html .x"].filter((s) => ROOTISH.test(s))).toEqual([
      "html .x",
    ]);
    expect(ON_DESCENDANT.has("--ion-background-color")).toBe(true);
    expect(ON_DESCENDANT.has("--vz-bg")).toBe(true);
  });

  it("jede :root-Deklaration in edomi.css bleibt in :root aufloesbar", () => {
    const frozen: string[] = [];
    for (const d of customProperties(EDOMI).filter(appliesToHtml)) {
      for (const ref of refs(d.value)) {
        // Ein Token, das NIRGENDS deklariert ist, ist in Ordnung: dann greift der
        // Rueckfall im Browser genauso wie im Lauf. Gefaehrlich ist nur der Token,
        // der weiter unten im Baum SEHR WOHL existiert — dort weichen Browser und
        // Generator voneinander ab, und zwar auch dann, wenn er zusaetzlich in
        // :root steht (der :root-Wert friert ein, die Ueberschreibung fehlt).
        if (ON_DESCENDANT.has(ref)) {
          frozen.push(`${d.name}: var(${ref}) — ${ref} steht erst auf einem Nachfahren`);
        }
      }
    }
    expect(
      frozen,
      "in :root eingefroren (gehoert in .visu-root, wo die Bruecke und das Theme stehen):\n  " +
        frozen.join("\n  "),
    ).toEqual([]);
  });

  it("die beiden Seiten-Aliasse stehen auf dem Element, das die Bruecke traegt", () => {
    // Die Gegenrichtung: der Waechter oben waere auch gruen, wenn jemand die
    // Aliasse ersatzlos streicht. Hier steht, dass es sie gibt — und wo.
    const onVisuRoot = customProperties(EDOMI)
      .filter((d) => d.selectors.includes(".visu-root"))
      .map((d) => d.name);
    expect(onVisuRoot).toContain("--edomi-canvas-bg");
    expect(onVisuRoot).toContain("--edomi-canvas-ink");
  });
});
