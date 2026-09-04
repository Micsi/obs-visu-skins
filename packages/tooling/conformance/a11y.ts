// Die Farb-Achse des Konformitäts-Generators (Goldene Regel 6, Vertrag 1.13).
//
// Render- und Aktions-Achse misst `index.ts` am erzeugten Markup. Farbe steht dort
// nicht: ein Renderer liefert Klassennamen, keine Pixel. Diese Datei schliesst die
// Lücke — sie liest das ECHTE Stylesheet des Skins und rechnet WCAG 2.1 darauf.
//
// Die Arbeitsteilung ist die ganze Idee der Vertrags-Fläche `manifest.a11y`:
//
//   • Der Skin DEKLARIERT die Semantik: welcher Token färbt Text, welcher Grafik,
//     welcher ist nur Grund, welcher ist bewusst ausgenommen (mit Begründung);
//     auf welchen Gründen ein Vordergrund real steht; welche Deckkräfte er auflegt;
//     welche Tweaks Farbe bewegen.
//   • Der Generator MISST die Werte: er löst die Token aus der CSS-Datei auf,
//     mischt durchscheinende Gründe zu dem Pixel zusammen, das real auf dem Schirm
//     steht, und rechnet das Verhältnis.
//
// Warum nicht einfach die Verhältnisse deklarieren lassen? Weil eine deklarierte
// Zahl beim nächsten Farbdreher stillschweigend falsch wird. Deklariert wird nur,
// was ein Mensch entscheidet (Rolle, Grund, Ausnahme) — gerechnet wird der Rest.
//
// ══ Was hier NICHT gemessen wird (ausdrücklich, damit es niemand für geprüft hält)
//
//  1. Ob ein Token wirklich dort steht, wo `on` behauptet. Die Zuordnung
//     Vordergrund-zu-Grund ist eine Deklaration. Nur ein echter Browser-Render
//     könnte sie beweisen; hier wird sie geglaubt — aber sie steht sichtbar im
//     Report, ist also kritisierbar. Fehlt `on`, gilt die STRENGERE Lesart
//     (gegen alle Gründe): einschränken muss man hinschreiben.
//  2. Deckkraft aus Regeln statt aus Token. `alphas` ist eine Deklaration. Ein
//     Skin, dessen Stylesheet klein genug für einen vollständigen `opacity`-Scan
//     ist, prüft das zusätzlich in seiner eigenen Spec (terminal tut das) — der
//     Vertrag verlangt es nicht, weil ein grosses Stylesheet dutzende rein
//     dekorativer Deckkräfte trägt und ein Pflicht-Scan dort nur Rauschen ergäbe.
//  3. Schriftgrösse. WCAG erlaubt "grossem Text" 3:1. Hier gilt für JEDEN
//     Text-Token 4.5:1 — die strengere Schwelle, ohne Ausnahme.
//  4. Gradient und Schatten. Sie sind keine flache Farbe. Ein Token, der eine
//     Farbe ENTHÄLT, ohne eine zu SEIN, muss deshalb `exempt` mit Begründung
//     sein — er verschwindet nicht lautlos aus der Messung.
//
// ══ Was den Skin daran hindert, sich grün zu deklarieren
//
// Jeder Weg AUS der Messung heraus muss eine begründete Aussage sein, nie ein
// Weglassen (Goldene Regel 3). Vier Riegel, jeder für einen Ausweg, den ein
// früherer Entwurf offen liess:
//
//  1. **Farbe weglassen.** JEDE Farb-Deklaration in JEDEM Block der deklarierten
//     Stylesheets muss in `tokens` stehen — nicht nur in `base` und den
//     Theme-Blöcken. Ein Skin, der seine unbequeme Farbe in einen dritten Block
//     schreibt (ionic tut das mit den `--ion-*`-Brückenvariablen), fiele sonst
//     lautlos aus der Prüfung.
//  2. **Grund weglassen.** Ein Token als `ground` zu deklarieren und dann NICHT in
//     `grounds` zu führen nahm es spurlos aus der Messung. Das braucht jetzt eine
//     Begründung und steht als `unmeasuredGrounds` im Report.
//  3. **Theme weglassen.** `exemptThemes` verlangt eine nicht-leere Begründung,
//     genau wie `exempt` bei einem Token.
//  4. **Tweak weglassen.** Jeder Tweak aus `manifest.tweaks` muss eingeordnet sein:
//     messbare Achse, farbneutral (mit Grund) oder farbwirksam-aber-nicht-erfassbar
//     (mit Grund, und dann ist `checkedTweakExtremes` FALSE). Ohne diesen Abgleich
//     behauptete der Report, die Extreme geprüft zu haben, während ein unbenannter
//     Tweak die Farbe verschiebt — eine ungedeckte positive Aussage.

import {
  schema as contractSchema,
  type A11yGround,
  type A11yMeasurement,
  type A11yFinding,
  type SkinManifest,
  type SkinTweak,
  type SupportA11y,
} from "@obs/visu-contract";

/* ------------------------------------------------------- Vertrags-Schwellen */

interface SchemaA11y {
  readonly thresholds?: { readonly text?: number; readonly graphic?: number };
  readonly roles?: readonly string[];
}
const SCHEMA_A11Y = ((contractSchema as { a11y?: SchemaA11y }).a11y ?? {}) as SchemaA11y;

/**
 * Die WCAG-Schwellen kommen AUS dem Vertrag, nicht aus einem Literal hier —
 * dieselbe Regel wie bei `canonicalActions` und `LAYOUT_HONORS`. Der Fallback ist
 * bewusst der WCAG-Normwert, damit ein Vertrag ohne `a11y`-Block (bis 1.12) nicht
 * still auf 0 prüft und damit gar nichts mehr messen würde.
 */
export const THRESHOLDS = Object.freeze({
  text: SCHEMA_A11Y.thresholds?.text ?? 4.5,
  graphic: SCHEMA_A11Y.thresholds?.graphic ?? 3,
});

/** Das anerkannte Rollen-Vokabular — ebenfalls aus dem Vertrag. */
export const A11Y_ROLES: readonly string[] = Object.freeze([
  ...((SCHEMA_A11Y.roles ?? ["text", "graphic", "ground", "exempt"]) as string[]),
]);

/* ------------------------------------------------------------- CSS-Parsing */

/** Ein Regelblock: die (kommagetrennten) Selektoren plus der rohe Rumpf. */
interface Rule {
  readonly selectors: readonly string[];
  readonly body: string;
}

/** Kommentare raus, dann jeden INNERSTEN Block einsammeln (`@media` fällt dabei weg). */
export function parseRules(css: string): Rule[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (m[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (selectors.length > 0) out.push({ selectors, body: m[2] ?? "" });
  }
  return out;
}

/**
 * Alle `--name: wert`-Paare eines Rumpfes, in Quelltextreihenfolge.
 *
 * Über {@link splitTop} statt über einen Regex auf den Rohtext, und das behebt
 * drei Fehlurteile auf einmal:
 *
 *  - **Zeichenketten** zählten mit. `content: "--brand: #fff"` — oder dieselbe
 *    Folge in einem Data-URI — galt als echte Deklaration, und der
 *    Vollständigkeits-Scan meldete den Phantom-Token als `unclassified`.
 *  - **`!important`** blieb am Wert kleben und liess `resolveColor` scheitern.
 *  - **Nicht-ASCII-Namen** fielen weg: `\w` kennt nur ASCII, `--zustand-grün`
 *    wurde also weder in die Umgebung aufgenommen noch klassifiziert — während
 *    gewöhnliches CSS ihn über `var()` sehr wohl verbraucht.
 */
export function declarations(body: string): [string, string][] {
  const out: [string, string][] = [];
  for (const part of splitTop(body, ";")) {
    const cut = part.indexOf(":");
    if (cut <= 0) continue;
    const name = part.slice(0, cut).trim();
    if (!name.startsWith("--") || name.length < 3) continue;
    const value = withoutImportance(part.slice(cut + 1));
    if (value.length === 0) continue;
    out.push([name, value]);
  }
  return out;
}

/**
 * Alle Custom-Property-Deklarationen JEDES Blocks, dessen Selektorliste `selector`
 * enthält — über alle Stylesheets, in Quelltextreihenfolge. Mehrere Blöcke werden
 * gemischt (der spätere gewinnt), genau wie die Kaskade es täte.
 */
export function tokensFor(sources: readonly string[], selector: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      if (!rule.selectors.includes(selector)) continue;
      for (const [name, value] of declarations(rule.body)) out.set(name, value);
    }
  }
  return out;
}

/**
 * JEDE Custom-Property-Deklaration ALLER Blöcke, mit dem Selektor, in dem sie steht.
 * Grundlage von Riegel 1: die Vollständigkeit wird über das ganze Blatt geprüft, nicht
 * nur über die erklärten Blöcke — sonst wäre ein dritter Block das Versteck.
 */
export function allDeclarations(sources: readonly string[]): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      for (const [name, value] of declarations(rule.body)) {
        out.push([rule.selectors.join(", "), name, value]);
      }
    }
  }
  return out;
}

/**
 * Kaskadiert dieser Selektor in das gemessene Theme?
 *
 * Nein, wenn er den Selektor eines ANDEREN Themes trägt und den eigenen nicht:
 * `.visu-root[data-theme="light"] .foo` gilt im dunklen Theme nicht. Ein Block,
 * dessen Selektorliste beide nennt, gilt in beiden — deshalb wird je Selektor
 * entschieden und der Block genommen, sobald EINER von ihnen passt.
 *
 * Warum das zählt: der Rückfall-Boden wurde vorher aus JEDER Deklaration in JEDEM
 * Selektor gefüllt. Fehlte `--fg` im dunklen Block, borgte die dunkle Messung ihn
 * still aus dem hellen — eine unvollständige dunkle Palette konnte `pass`
 * bekommen, statt den Token als fehlend zu melden.
 */
function cascadesInto(selector: string, own: string, foreign: readonly string[]): boolean {
  if (own.length > 0 && selector.includes(own)) return true;
  return !foreign.some((f) => f.length > 0 && selector.includes(f));
}

/**
 * Der Kaskaden-Boden EINES Themes: jede Deklaration jedes Blocks, der in dieses
 * Theme kaskadiert ({@link cascadesInto}), in Quelltextreihenfolge. Er liegt unter
 * `base` und den Theme-Token, die ihn überschreiben, und fängt die Token auf, die
 * ausserhalb der erklärten Blöcke definiert sind (ionics `--ion-*`-Brücke unter
 * `.visu-root`).
 */
function themeEnv(
  sources: readonly string[],
  own: string,
  foreign: readonly string[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      if (!rule.selectors.some((sel) => cascadesInto(sel, own, foreign))) continue;
      for (const [name, value] of declarations(rule.body)) out.set(name, value);
    }
  }
  return out;
}

/**
 * Alle GEWÖHNLICHEN Deklarationen eines Rumpfes (`color: #fff`) — alles, was KEINE
 * Custom Property ist. Der Gegenpart zu {@link declarations}, und der Grund, warum
 * es ihn braucht: der Vollständigkeits-Scan erkannte ausschliesslich `--name` und
 * sah `outline: 2px solid #d6a800` oder `color: #fff` deshalb NIE — weder
 * klassifiziert noch gemessen. Ein Skin konnte damit `a11y.status: "pass"`
 * bekommen und trotzdem unzugängliche Vordergründe ausliefern.
 *
 * Getrennt am obersten Klammer-Level, damit ein `;` in `url(…)` oder in einer
 * `rgba(…)`-Liste nicht mitten in einem Wert schneidet.
 */
export function plainDeclarations(body: string): [string, string][] {
  const out: [string, string][] = [];
  for (const part of splitTop(body, ";")) {
    const cut = part.indexOf(":");
    if (cut <= 0) continue;
    const name = part.slice(0, cut).trim();
    const value = withoutImportance(part.slice(cut + 1));
    if (name.length === 0 || value.length === 0) continue;
    if (name.startsWith("--")) continue; // die haben ihren eigenen Scan
    if (!/^[a-z-]+$/i.test(name)) continue; // kein Eigenschaftsname
    out.push([name, value]);
  }
  return out;
}

/** Wie {@link allDeclarations}, aber für die gewöhnlichen Deklarationen. */
export function allPlainDeclarations(sources: readonly string[]): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const css of sources) {
    for (const rule of parseRules(css)) {
      for (const [name, value] of plainDeclarations(rule.body)) {
        out.push([rule.selectors.join(", "), name, value]);
      }
    }
  }
  return out;
}

/** Steht dieser Selektor überhaupt in einem der Stylesheets? */
export function hasSelector(sources: readonly string[], selector: string): boolean {
  return sources.some((css) => parseRules(css).some((r) => r.selectors.includes(selector)));
}

/* ---------------------------------------------------------- Farb-Auflösung */

/** Eine aufgelöste Farbe. `a` unter 1 heisst durchscheinend — sie braucht einen Grund. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Sieht der Wert nach Farbe aus? Bewusst weit: alles, was hier anschlägt, MUSS
 * auflösbar sein — sonst ist es ein Befund und kein stilles Überspringen.
 * `var(` ist dabei, weil ein Alias (`--vz-accent: var(--vz-acc-orange)`) sonst
 * unklassifiziert durchrutschte.
 */
export const COLOR_SHAPED =
  /^(#|rgba?\(|hsla?\(|hwb\(|lab\(|lch\(|oklab\(|oklch\(|color\(|color-mix\(|light-dark\(|var\(|transparent\b|currentcolor\b)/i;

/**
 * Enthält der Wert eine Farbe, OHNE eine flache Farbe zu sein? Gradienten und
 * Schatten. Sie sind nicht wie ein Pixel messbar und müssen deshalb ausdrücklich
 * `exempt` sein — Goldene Regel 3, statt lautlos aus der Messung zu fallen.
 */
/**
 * Trägt dieser Wert eine Farbe DIREKT, also an den Token vorbei?
 *
 * Bewusst breit: der Scan entscheidet, ob eine gewöhnliche Deklaration überhaupt
 * betrachtet wird. Fehlt hier eine Syntax, fällt sie stillschweigend aus der
 * Messung — `color: red` und `background: oklch(…)` sind genauso an der Palette
 * vorbei wie ein Hexwert. Die benannten Farben stehen als Wortgrenze, damit
 * `border` (enthält „red") nicht anschlägt.
 */
export const COLOR_BEARING =
  /(#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(|\b(?:red|blue|green|black|white|gray|grey|yellow|orange|purple|pink|brown|cyan|magenta|silver|gold|navy|teal|olive|maroon|lime|aqua|fuchsia|indigo|violet|beige|ivory|khaki|coral|salmon|crimson|turquoise|lavender|plum|tan|azure|orchid|tomato|wheat|linen|snow|seashell|honeydew|currentcolor)\b)/i;

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Löst eine Zahl auf: nackt, `var(--x)` oder ein einstufiges `calc(A * B)`.
 * Mehr braucht kein Alpha-Ausdruck in einem Skin-Stylesheet — und mehr zu raten
 * wäre gefährlicher als der Befund `unresolvable`.
 */
export function resolveNumber(value: string, env: Map<string, string>, depth = 0): number | null {
  if (depth > 16) return null;
  const v = value.trim();

  const percent = /^([0-9.]+)%$/.exec(v);
  if (percent) return Number(percent[1]) / 100;
  if (/^[+-]?[0-9]*\.?[0-9]+$/.test(v)) return Number(v);

  const variable = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/.exec(v);
  if (variable) {
    const bound = env.get(variable[1]!);
    if (bound !== undefined) return resolveNumber(bound, env, depth + 1);
    return variable[2] !== undefined ? resolveNumber(variable[2], env, depth + 1) : null;
  }

  const calc = /^calc\(([\s\S]*)\)$/.exec(v);
  if (calc) {
    const parts = splitTop(calc[1]!, "*");
    if (parts.length < 2) return null;
    let product = 1;
    for (const part of parts) {
      const n = resolveNumber(part, env, depth + 1);
      if (n === null) return null;
      product *= n;
    }
    return product;
  }
  return null;
}

/** Zerlegt an `sep`, aber nur auf oberster Klammerebene. */
function splitTop(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    // Zeichenketten sind für die Struktur BLIND: was zwischen Anführungszeichen
    // steht, ist Inhalt. Ohne diesen Zweig zählte `content: "a;b(c"` Trenner und
    // Klammern mit und zerlegte die Deklaration an der falschen Stelle.
    if (quote) {
      current += ch;
      if (ch === "\\") {
        // Maskiertes Zeichen komplett übernehmen, damit `"\""` die Kette nicht schliesst.
        const next = input[i + 1];
        if (next !== undefined) {
          current += next;
          i += 1;
        }
      } else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === sep && depth === 0) {
      out.push(current);
      current = "";
    } else current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Ein CSS-Wert ohne seinen Wichtigkeits-Marker.
 *
 * `!important` entscheidet im Browser nur, WELCHE Deklaration gewinnt — der
 * berechnete Wert ist derselbe. `--fg: #000 !important` erreichte
 * {@link resolveColor} aber samt Marker, wurde dort abgelehnt, und ein sonst
 * konformer Skin fiel mit `unresolvable` durch.
 */
function withoutImportance(value: string): string {
  return value.replace(/!\s*important\s*$/i, "").trim();
}

/**
 * Löst einen CSS-Farbwert zu {@link Rgba} auf. Beherrscht die Formen, die ein
 * Skin-Stylesheet für PALETTE-Token real benutzt: Hex (3/4/6/8), `rgb()`/`rgba()`
 * in Komma- und Slash-Syntax, `var()` mit Fallback, `transparent`. Alles andere
 * gibt `null` — und `null` ist ein Befund, kein Überspringen.
 */
export function resolveColor(value: string, env: Map<string, string>, depth = 0): Rgba | null {
  if (depth > 16) return null;
  const v = value.trim();

  if (/^transparent$/i.test(v)) return { r: 0, g: 0, b: 0, a: 0 };

  const hex = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (hex) {
    const h = hex[1]!;
    const expand = (s: string): number => parseInt(s.length === 1 ? s + s : s, 16);
    if (h.length === 3 || h.length === 4) {
      return {
        r: expand(h[0]!),
        g: expand(h[1]!),
        b: expand(h[2]!),
        a: h.length === 4 ? expand(h[3]!) / 255 : 1,
      };
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
    return null;
  }

  // `--name` bewusst ohne `\w`: Custom-Property-Namen folgen der vollen
  // `<dashed-ident>`-Grammatik und dürfen Nicht-ASCII enthalten.
  const variable = /^var\(\s*(--[^\s,)]+)\s*(?:,([\s\S]*))?\)$/.exec(v);
  if (variable) {
    const bound = env.get(variable[1]!);
    const fallback = variable[2];
    if (bound !== undefined) {
      const resolved = resolveColor(bound, env, depth + 1);
      if (resolved !== null) return resolved;
      // Der Rückfall greift NICHT nur bei fehlendem Token: auch ein
      // garantiert-ungültiger Wert (`initial`) oder eine zyklische Bindung lässt
      // den Browser auf den Rückfall gehen. `--optional: initial; --fg:
      // var(--optional, #fff)` ist gültiges CSS und berechnet `#fff` — hier galt
      // es als `unresolvable`, weil der Token ja "existiert".
      return fallback !== undefined ? resolveColor(fallback, env, depth + 1) : null;
    }
    return fallback !== undefined ? resolveColor(fallback, env, depth + 1) : null;
  }

  const fn = /^rgba?\(([\s\S]*)\)$/i.exec(v);
  if (fn) {
    const [head, alphaPart] = splitTop(fn[1]!, "/");
    const channels = splitTop((head ?? "").replace(/,/g, " ").trim(), " ");
    if (channels.length < 3) return null;
    const nums = channels.slice(0, 3).map((c) => resolveNumber(c, env, depth + 1));
    // Prozentkanäle: resolveNumber liefert 0..1, rgb() meint 0..255.
    const rgb = nums.map((n, i) => (n === null ? null : /%$/.test(channels[i]!) ? n * 255 : n));
    if (rgb.some((n) => n === null)) return null;
    const alphaText = alphaPart ?? channels[3];
    const a = alphaText === undefined ? 1 : resolveNumber(alphaText, env, depth + 1);
    if (a === null) return null;
    return { r: clamp255(rgb[0]!), g: clamp255(rgb[1]!), b: clamp255(rgb[2]!), a };
  }
  return null;
}

/* --------------------------------------------------------------- WCAG 2.1 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative Leuchtdichte einer DECKENDEN Farbe (WCAG 2.1). */
export function luminance(c: Rgba): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG-2.1-Kontrastverhältnis zweier deckender Farben. */
export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Vordergrund über Grund gemischt — das reale Pixel. `alpha` skaliert zusätzlich. */
export function composite(fg: Rgba, bg: Rgba, alpha = 1): Rgba {
  const a = fg.a * alpha;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: a + bg.a * (1 - a),
  };
}

function hex(c: Rgba): string {
  return `#${[c.r, c.g, c.b].map((n) => clamp255(n).toString(16).padStart(2, "0")).join("")}`;
}

/* ------------------------------------------------------------ Tweak-Stopps */

/** Eine angefahrene Tweak-Stellung: ein Name plus die gesetzten CSS-Variablen. */
interface TweakStop {
  readonly label: string;
  readonly overrides: ReadonlyMap<string, string>;
}

/**
 * Die Extreme einer Tweak-Achse: bei `slider` `min` und `max`, bei `select` jede
 * Option. Der Default wird NICHT mitgezählt — er ist der eigene Stopp `default`.
 */
function extremesOf(tweak: SkinTweak): string[] {
  if (tweak.type === "slider") {
    const values: string[] = [];
    if (typeof tweak.min === "number") values.push(String(tweak.min));
    if (typeof tweak.max === "number") values.push(String(tweak.max));
    return values;
  }
  return [...(tweak.options ?? [])];
}

/* ---------------------------------------------------------------- Messung */

/** Eingabe der Farb-Achse: die Deklaration plus die GELESENEN Stylesheet-Quellen. */
export interface A11yInput {
  readonly manifest: SkinManifest;
  /**
   * Quelltext je deklariertem Stylesheet-Eintrag. Das Lesen macht der Aufrufer
   * (CLI/Test) — diese Messung bleibt rein, damit sie ohne Dateisystem testbar ist
   * und ein fehlendes Stylesheet ein BEFUND wird statt einer Ausnahme.
   */
  readonly styles?: Readonly<Record<string, string>>;
}

const UNDECLARED: SupportA11y = {
  status: "undeclared",
  aa: false,
  checkedTweakExtremes: false,
  thresholds: THRESHOLDS,
  themes: [],
  tweakStops: [],
  combinations: 0,
  worst: {},
  violationCount: 0,
  violationBreakdown: { atDefault: 0, atTweakExtreme: 0, whenDimmed: 0 },
  violations: [],
  findingCount: 1,
  findings: [
    {
      problem: "undeclared",
      detail:
        "manifest.a11y fehlt — die Palette ist nicht deklariert, AA ist damit UNGEMESSEN, nicht bestanden (Goldene Regeln 3 + 6)",
    },
  ],
};

/**
 * Misst die Farb-Achse eines Skins und liefert den `a11y`-Block für support.json.
 *
 * Fehlt `manifest.a11y`, ist das Ergebnis `undeclared` — ausdrücklich NICHT `pass`
 * und ausdrücklich nicht dasselbe wie ein Skin, der deklariert und besteht.
 */
export function measureA11y(input: A11yInput): SupportA11y {
  const decl = input.manifest.a11y;
  if (!decl) return UNDECLARED;

  const findings: A11yFinding[] = [];
  const sheets = typeof decl.stylesheet === "string" ? [decl.stylesheet] : [...decl.stylesheet];
  const sources: string[] = [];
  for (const path of sheets) {
    const src = input.styles?.[path];
    if (src === undefined) {
      findings.push({
        problem: "stylesheet-unreadable",
        detail: `${path} wurde nicht geladen — ohne Quelltext ist die Palette nicht messbar`,
      });
    } else sources.push(src);
  }

  const exemptThemes = decl.exemptThemes ?? {};
  const measuredThemes = Object.entries(decl.themes).filter(([name]) => !(name in exemptThemes));

  // Riegel 3: ein ganzes Theme auszunehmen ist die grösste Auslassung überhaupt —
  // sie braucht dieselbe Begründungspflicht wie ein einzelner Token. Ohne diese
  // Prüfung hätte `exemptThemes: { light: "" }` den halben Farbraum stillgelegt.
  for (const [theme, reason] of Object.entries(exemptThemes)) {
    if (!reason || reason.trim().length === 0) {
      findings.push({
        problem: "exempt-without-reason",
        detail: `Theme ${theme} ist ausgenommen, ohne Begründung — das ist ein Vergessen, keine Aussage`,
      });
    }
    if (!(theme in decl.themes)) {
      findings.push({
        problem: "selector-missing",
        detail: `exemptThemes nennt ${theme}, das in themes gar nicht steht`,
      });
    }
  }

  // Riegel 5: die a11y-Themes gegen die ECHTEN Themes des Manifests. Ohne diesen
  // Abgleich war "ein Theme gar nicht erst nennen" der stillste Ausweg von allen:
  // ein Skin, der `light` und `dark` anbietet, aber nur `dark` deklariert, liess
  // die halbe Palette ungemessen — und der Report konnte `pass` sein. Ein Theme
  // wegzulassen muss dieselbe begründete Aussage sein wie es auszunehmen.
  for (const theme of input.manifest.themes ?? []) {
    if (theme in decl.themes || theme in exemptThemes) continue;
    findings.push({
      problem: "selector-missing",
      detail: `manifest.themes bietet ${theme} an, a11y.themes kennt es nicht — diese Palette ist ungemessen. Nenne ihren Selektor oder nimm sie mit Begründung in exemptThemes auf.`,
    });
  }

  for (const selector of [
    ...(decl.base ? [decl.base] : []),
    ...measuredThemes.map(([, sel]) => sel),
  ]) {
    if (sources.length > 0 && !hasSelector(sources, selector)) {
      findings.push({
        problem: "selector-missing",
        detail: `${selector} steht in keinem der deklarierten Stylesheets`,
      });
    }
  }

  // Riegel 6: die ROLLE selbst prüfen. Manifeste kommen per Typ-Zusicherung aus
  // JSON, ohne Schema-Validierung — ein Tippfehler (`"role": "tetx"`) fiel damit
  // durch JEDE Schleife hier (weder exempt noch ground noch text/graphic), während
  // der Vollständigkeits-Scan den Token als klassifiziert ansah, weil sein Name in
  // `tokens` steht. Lieferte irgendein anderer Token eine Messung, konnte der
  // Report `pass` sein: der Token war unsichtbar, nicht ausgenommen.
  for (const [token, entry] of Object.entries(decl.tokens)) {
    const role = (entry as { role?: unknown }).role;
    if (typeof role === "string" && A11Y_ROLES.includes(role)) continue;
    findings.push({
      problem: "unclassified",
      detail: `${token} trägt die Rolle ${JSON.stringify(role)}, die es im Vertrags-Vokabular nicht gibt (${A11Y_ROLES.join(" · ")}) — der Token ist damit weder gemessen noch ausgenommen`,
    });
  }

  // Ausnahmen ohne Begründung: eine Auslassung MUSS eine Aussage sein (Regel 3).
  const exemptTokens: Record<string, string> = {};
  for (const [token, entry] of Object.entries(decl.tokens)) {
    if (entry.role !== "exempt") continue;
    if (!entry.reason || entry.reason.trim().length === 0) {
      findings.push({
        problem: "exempt-without-reason",
        detail: `${token} ist exempt ohne reason — eine Ausnahme ohne Begründung ist ein Vergessen`,
      });
    } else exemptTokens[token] = entry.reason;
  }

  const groundNames = new Set(decl.grounds.map((g) => g.token));

  // Riegel 2: `role: "ground"` heisst "wird nicht als Vordergrund gemessen". Steht der
  // Token dann auch in keinem `grounds`-Eintrag, ist er ÜBERHAUPT nicht gemessen — der
  // stillste aller Auswege. Er ist erlaubt (eine Trennlinie ist wirklich kein
  // Vordergrund), aber nur als begründete Aussage, und er steht im Report.
  const unmeasuredGrounds: Record<string, string> = {};
  for (const [token, entry] of Object.entries(decl.tokens)) {
    if (entry.role !== "ground" || groundNames.has(token)) continue;
    if (!entry.reason || entry.reason.trim().length === 0) {
      findings.push({
        problem: "ground-without-reason",
        detail: `${token} ist ground, steht aber in keinem grounds-Eintrag — damit ist er ungemessen. Das braucht eine Begründung.`,
      });
    } else unmeasuredGrounds[token] = entry.reason;
  }

  for (const [token, entry] of Object.entries(decl.tokens)) {
    // Riegel 7: `"on": []` war ein stiller Ausweg. Nullish-Coalescing erhält ein
    // ausdrücklich leeres Array, also erzeugte ein Text- oder Grafik-Token damit
    // NULL Paarungen und keinen Befund; solange irgendein anderer Token gemessen
    // wurde, blieb `measurements.length` ungleich null und der Report konnte
    // `pass` sein. Leer ist keine Aussage — es wird gemeldet UND auf die strenge
    // Lesart zurückgefallen (gegen alle Gründe), genau wie ein fehlendes `on`.
    if (entry.on !== undefined && entry.on.length === 0) {
      findings.push({
        problem: "unclassified",
        detail: `${token} nennt "on": [] — ein leerer Grund-Satz misst nichts. Nenne die Gründe, lass "on" ganz weg (dann gilt die strengere Lesart gegen alle), oder führe den Token als exempt mit Begründung.`,
      });
    }
    for (const on of entry.on ?? []) {
      if (!groundNames.has(on)) {
        findings.push({
          problem: "unknown-ground",
          detail: `${token} nennt den Grund ${on}, der nicht in grounds steht`,
        });
      }
    }
  }
  for (const ground of decl.grounds) {
    if (ground.over !== undefined && !groundNames.has(ground.over)) {
      findings.push({
        problem: "unknown-ground",
        detail: `Grund ${ground.token} liegt über ${ground.over}, das nicht in grounds steht`,
      });
    }
  }

  // Tweak-Achsen gegen die echten Tweaks des Manifests — eine Achse auf einen
  // Tweak, den es nicht gibt, fährt Extreme an, die niemand einstellen kann.
  const tweaks = input.manifest.tweaks ?? {};
  const stops: TweakStop[] = [{ label: "default", overrides: new Map() }];
  const axes = decl.tweakAxes ?? [];
  for (const axis of axes) {
    const tweak = tweaks[axis.tweak];
    if (!tweak) {
      findings.push({
        problem: "unknown-tweak",
        detail: `a11y.tweakAxes nennt den Tweak ${axis.tweak}, den manifest.tweaks nicht kennt`,
      });
      continue;
    }
    const values = extremesOf(tweak);
    if (values.length === 0) {
      findings.push({
        problem: "unknown-tweak",
        detail: `Tweak ${axis.tweak} hat keine Extreme (weder min/max noch options) — die Achse misst nichts`,
      });
      continue;
    }
    for (const value of values) {
      stops.push({
        label: `${axis.tweak}=${value}`,
        overrides: new Map([[axis.cssVar, value]]),
      });
    }
  }
  // Riegel 4: JEDER Tweak des Manifests muss eingeordnet sein. Ohne diesen Abgleich
  // stand `checkedTweakExtremes: true` im Report, während ein unbenannter Tweak die
  // Farbe verschob — eine ungedeckte positive Aussage, und damit genau der Fehler,
  // den diese Fläche sonst überall verbietet.
  const neutralTweaks = decl.neutralTweaks ?? {};
  const unmeasuredTweaks = decl.unmeasuredTweaks ?? {};
  const named = new Set([
    ...axes.map((a) => a.tweak),
    ...Object.keys(neutralTweaks),
    ...Object.keys(unmeasuredTweaks),
  ]);
  let unclassifiedTweak = false;
  for (const name of Object.keys(tweaks)) {
    if (named.has(name)) continue;
    unclassifiedTweak = true;
    findings.push({
      problem: "undeclared-tweak",
      detail: `Tweak ${name} ist in a11y weder als Achse noch als neutralTweaks noch als unmeasuredTweaks eingeordnet — die Extreme sind damit NICHT vollständig geprüft`,
    });
  }
  for (const [group, entries] of [
    ["neutralTweaks", neutralTweaks],
    ["unmeasuredTweaks", unmeasuredTweaks],
  ] as const) {
    for (const [name, reason] of Object.entries(entries)) {
      if (!(name in tweaks)) {
        findings.push({
          problem: "unknown-tweak",
          detail: `${group} nennt ${name}, den manifest.tweaks nicht kennt`,
        });
      }
      if (!reason || reason.trim().length === 0) {
        findings.push({
          problem: "exempt-without-reason",
          detail: `${group}.${name} ohne Begründung — eine Auslassung muss eine Aussage sein`,
        });
      }
    }
  }

  // "Extreme geprüft" heisst dreierlei: jede deklarierte Achse hat einen Stopp
  // erzeugt, KEIN Tweak ist unklassifiziert geblieben, und keiner ist als
  // farbwirksam-aber-nicht-erfassbar eingeräumt. Ein Skin ohne Tweaks (terminal)
  // hat nichts anzufahren — dort ist die Aussage trivial wahr, und der Report zeigt
  // `tweakStops: ["default"]`, die Aussage bleibt also nachlesbar.
  const checkedTweakExtremes =
    (axes.length === 0 || stops.length > 1) &&
    !unclassifiedTweak &&
    Object.keys(unmeasuredTweaks).length === 0;

  const measurements: A11yMeasurement[] = [];
  const violations: A11yMeasurement[] = [];
  /**
   * Der Klassifikations-Boden: JEDE Deklaration aller Blätter. Er beantwortet nur
   * die Frage "zeigt dieser Alias überhaupt auf eine Farbe?" (Riegel 1) und darf
   * dafür themeübergreifend sein — MESSEN tut er nichts.
   */
  const envAll = new Map<string, string>();
  for (const [, name, value] of allDeclarations(sources)) envAll.set(name, value);

  // Die Selektoren ALLER deklarierten Themes (auch der ausgenommenen): sie sind
  // der Massstab dafür, welcher Block in ein gemessenes Theme kaskadiert und
  // welcher zu einem fremden gehört.
  const themeSelectors = Object.values(decl.themes);

  const base =
    sources.length > 0 && decl.base ? tokensFor(sources, decl.base) : new Map<string, string>();
  const alphas = decl.alphas && decl.alphas.length > 0 ? decl.alphas : [1];

  for (const [theme, selector] of measuredThemes) {
    if (sources.length === 0) break;
    const themeTokens = tokensFor(sources, selector);
    /**
     * Der Kaskaden-Boden DIESES Themes. Er liegt UNTER `base` und den Theme-Token,
     * die ihn überschreiben, und fängt weiterhin die Token auf, die ausserhalb der
     * erklärten Blöcke definiert sind (ionics `--ion-*`-Brücke unter `.visu-root`)
     * — aber er borgt sich nichts mehr aus einem FREMDEN Theme. Vorher wurde er
     * aus jeder Deklaration jedes Selektors gefüllt: fehlte `--fg` im dunklen
     * Block, borgte die dunkle Messung ihn still aus dem hellen, und eine
     * unvollständige dunkle Palette konnte `pass` bekommen.
     */
    const envTheme = themeEnv(
      sources,
      selector,
      themeSelectors.filter((s) => s !== selector),
    );

    for (const stop of stops) {
      const env = new Map<string, string>([
        ...envTheme,
        ...base,
        ...themeTokens,
        ...stop.overrides,
      ]);

      // 1) Gründe auflösen und die Kette zusammenmischen.
      const ground = new Map<string, Rgba>();
      for (const g of decl.grounds) {
        const resolved = resolveGround(g, decl.grounds, env);
        if (resolved === null) {
          // An JEDEM Stopp, nicht nur am Default (siehe unten beim Vordergrund):
          // ein Tweak kann einen Grund unauflösbar machen, den die Werkseinstellung
          // noch auflöst.
          findings.push({
            problem: "unresolvable",
            detail: `${theme}/${stop.label}: Grund ${g.token} = "${env.get(g.token) ?? "(fehlt)"}" ist nicht auflösbar`,
          });
          continue;
        }
        if (resolved.a < 0.999) {
          findings.push({
            problem: "translucent-ground",
            detail: `${theme}/${stop.label}: Grund ${g.token} bleibt nach dem Mischen durchscheinend (a=${resolved.a.toFixed(2)}) — nenne einen over-Grund`,
          });
          continue;
        }
        ground.set(g.token, resolved);
      }

      // 2) Jeden Vordergrund gegen jeden erklärten Grund, bei jeder Deckkraft.
      for (const [token, entry] of Object.entries(decl.tokens)) {
        if (entry.role !== "text" && entry.role !== "graphic") continue;
        const raw = env.get(token);
        if (raw === undefined) {
          if (stop.label === "default") {
            findings.push({
              problem: "unclassified",
              detail: `${theme}: ${token} ist deklariert, steht aber in keinem der erklärten Blöcke`,
            });
          }
          continue;
        }
        const color = resolveColor(raw, env);
        if (color === null) {
          // An JEDEM Stopp, nicht nur am Default. Vorher wurden unauflösbare
          // Vordergründe an einem Tweak-Extrem still übersprungen: ein Tweak, der
          // auf eine benannte CSS-Farbe abbildet (`red`), lieferte am Default einen
          // messbaren Hexwert und an jedem Extrem `null` — und der Report sagte
          // weiter `checkedTweakExtremes: true` und `pass`, obwohl an den Extremen
          // gar nichts gemessen wurde.
          findings.push({
            problem: "unresolvable",
            detail: `${theme}/${stop.label}: ${token} = "${raw}" ist nicht auflösbar — umschreiben oder exempt mit Begründung`,
          });
          continue;
        }
        const threshold = entry.role === "text" ? THRESHOLDS.text : THRESHOLDS.graphic;
        // Ein leeres `on` fällt auf die strenge Lesart zurück (gegen alle Gründe) —
        // gemeldet wird es oben, gemessen wird es hier trotzdem.
        const targets =
          entry.on && entry.on.length > 0 ? entry.on : decl.grounds.map((g) => g.token);
        // Deckkraft je Token vor Deckkraft des Skins: ein Skin dimmt seine gesperrte
        // Kachel und seine Seitenüberschrift nicht — eine globale Liste erzeugte
        // Paarungen, die es auf dem Schirm nie gibt.
        const tokenAlphas = entry.alphas && entry.alphas.length > 0 ? entry.alphas : alphas;
        for (const target of targets) {
          const bg = ground.get(target);
          if (bg === undefined) continue; // schon als Befund vermerkt
          for (const alpha of tokenAlphas) {
            const effective = composite(color, bg, alpha);
            const ratio = contrast(effective, bg);
            const m: A11yMeasurement = {
              theme,
              token,
              role: entry.role,
              ground: `${target} ${hex(bg)}`,
              alpha,
              tweaks: stop.label,
              ratio: Math.round(ratio * 100) / 100,
              threshold,
            };
            measurements.push(m);
            if (ratio < threshold) violations.push(m);
          }
        }
      }
    }
  }

  // 3) Riegel 1 — Vollständigkeit über das GANZE Blatt, nicht nur über die
  //    erklärten Blöcke. Ein Skin, der seine unbequeme Farbe in einen dritten Block
  //    schreibt, fiele sonst lautlos aus der Prüfung; ionics `--ion-*`-Brücke unter
  //    `.visu-root` ist genau so ein Block, und er trägt echte Textfarben.
  //    Ein Token, das hier nur eine ROLLE braucht (keine Messung), kann `exempt`
  //    mit Begründung sein — die Auslassung bleibt lesbar.
  if (sources.length > 0) {
    // Ein `var()`-Alias ist nur dann eine Farbe, wenn er AUF eine Farbe zeigt.
    // `--ion-font-family: var(--vz-font)` sieht sonst wie eine aus, und ein
    // Wächter mit falschem Alarm wird ignoriert — dieselbe Regel wie bei `alphas`.
    const isColor = (value: string): boolean =>
      /^var\(/i.test(value) ? resolveColor(value, envAll) !== null : COLOR_SHAPED.test(value);

    const seen = new Set<string>();
    for (const [selector, name, value] of allDeclarations(sources)) {
      if (name in decl.tokens || seen.has(name)) continue;
      if (isColor(value)) {
        seen.add(name);
        findings.push({
          problem: "unclassified",
          detail: `${selector}: ${name} = "${value}" ist eine Farbe ohne Rolle in a11y.tokens`,
        });
      } else if (COLOR_BEARING.test(value)) {
        seen.add(name);
        findings.push({
          problem: "unclassified",
          detail: `${selector}: ${name} = "${value}" trägt Farbe, ist aber keine flache Farbe — als exempt mit Begründung führen`,
        });
      }
    }

    // Riegel 8 — Farbe an den Token VORBEI. Der Scan oben erkennt ausschliesslich
    // `--name`; `outline: 2px solid #d6a800` und ein hartcodiertes `color: #fff`
    // wurden deshalb WEDER klassifiziert NOCH gemessen. Ein Skin konnte
    // `a11y.status: "pass"` bekommen und trotzdem unzugängliche Vordergründe
    // ausliefern — die grösste Lücke, die diese Fläche je hatte.
    //
    // Die Regel ist deshalb: in einem deklarierten Blatt kommt jede Farbe aus
    // einem Token (`var(--…)`), der eine Rolle trägt. Eine Farbe direkt in einer
    // gewöhnlichen Deklaration ist ein Befund — nicht, weil sie zwingend falsch
    // wäre, sondern weil sie NICHT MESSBAR ist: sie hat keinen Namen, keine Rolle
    // und keinen erklärten Grund, und ein stilles Überspringen wäre wieder genau
    // der Ausweg, den diese Datei sonst überall zumauert.
    for (const [selector, prop, value] of allPlainDeclarations(sources)) {
      // Strings und `url()` tragen keine Farbe, können aber `#…` enthalten
      // (`url(#gradient)`, `content: "#1"`) — sonst schlüge der Wächter falsch an,
      // und ein falsch anschlagender Wächter wird ignoriert.
      const probe = value.replace(/url\([^)]*\)/gi, "").replace(/"[^"]*"|'[^']*'/g, "");
      if (!COLOR_BEARING.test(probe)) continue;
      findings.push({
        problem: "unclassified",
        detail: `${selector}: ${prop}: ${value} — eine Farbe an a11y.tokens vorbei. Führe sie über einen deklarierten Token (var(--…)), sonst ist sie ungemessen.`,
      });
    }
  }

  const worst: Record<string, A11yMeasurement> = {};
  for (const m of measurements) {
    const current = worst[m.role];
    if (!current || m.ratio < current.ratio) worst[m.role] = m;
  }

  if (measurements.length === 0 && findings.length === 0) {
    findings.push({
      problem: "undeclared",
      detail:
        "die Deklaration erzeugte KEINE einzige Messung — ein Wächter, der nie fällt, beweist nichts",
    });
  }
  // `checkedTweakExtremes` gehört IN das Urteil, nicht nur in den Report. Vorher
  // wurde das Flag auf `false` gesetzt, wenn `unmeasuredTweaks` einen farbwirksamen
  // Tweak einräumt — floss aber nirgends ein: ein Manifest konnte `status: "pass"`
  // und `aa: true` bekommen, und `generateSupport` behandelte das Gate als
  // bestanden, weil es nur den Status prüft. Ein eingeräumt ungeprüftes Extrem ist
  // eine Lücke in der Messung, also kein `pass` (Goldene Regel 3 + 6).
  const ok =
    violations.length === 0 &&
    findings.length === 0 &&
    measurements.length > 0 &&
    checkedTweakExtremes;

  const deduped = dedupe(findings);
  return {
    status: ok ? "pass" : "fail",
    aa: ok,
    checkedTweakExtremes,
    thresholds: THRESHOLDS,
    themes: measuredThemes.map(([name]) => name),
    ...(Object.keys(exemptThemes).length > 0 ? { exemptThemes } : {}),
    tweakStops: stops.map((s) => s.label),
    combinations: measurements.length,
    worst,
    violationCount: violations.length,
    violationBreakdown: {
      atDefault: violations.filter((v) => v.alpha === 1 && v.tweaks === "default").length,
      atTweakExtreme: violations.filter((v) => v.alpha === 1 && v.tweaks !== "default").length,
      whenDimmed: violations.filter((v) => v.alpha < 1).length,
    },
    violations: violations.sort((a, b) => a.ratio - b.ratio).slice(0, 40),
    ...(Object.keys(exemptTokens).length > 0 ? { exempt: exemptTokens } : {}),
    ...(Object.keys(unmeasuredGrounds).length > 0 ? { unmeasuredGrounds } : {}),
    ...(Object.keys(unmeasuredTweaks).length > 0 ? { unmeasuredTweaks } : {}),
    findingCount: deduped.length,
    findings: deduped.slice(0, 40),
  };
}

/** Mischt einen Grund über seine `over`-Kette zusammen, bis er deckend ist. */
function resolveGround(
  ground: A11yGround,
  all: readonly A11yGround[],
  env: Map<string, string>,
  depth = 0,
): Rgba | null {
  if (depth > 8) return null;
  const raw = env.get(ground.token);
  if (raw === undefined) return null;
  const color = resolveColor(raw, env);
  if (color === null) return null;
  if (color.a >= 0.999 || ground.over === undefined) return color;
  const under = all.find((g) => g.token === ground.over);
  if (!under) return color;
  const beneath = resolveGround(under, all, env, depth + 1);
  return beneath === null ? color : composite(color, beneath);
}

function dedupe(findings: readonly A11yFinding[]): A11yFinding[] {
  const seen = new Set<string>();
  const out: A11yFinding[] = [];
  for (const f of findings) {
    const key = `${f.problem} ${f.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
