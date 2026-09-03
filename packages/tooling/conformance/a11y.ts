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
// Die Vollständigkeitsprüfung: JEDE Farb-Deklaration in einem erklärten Block muss
// in `tokens` stehen. Eine unbequeme Farbe lässt sich also nicht durch Weglassen
// aus der Messung nehmen — das Weglassen selbst ist der Befund (`unclassified`).

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

/** Alle `--name: wert`-Paare eines Rumpfes, in Quelltextreihenfolge. */
export function declarations(body: string): [string, string][] {
  return [...body.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map(([, n, v]) => [n!, v!.trim()]);
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
export const COLOR_BEARING = /(#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|color-mix\()/i;

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
  let current = "";
  for (const ch of input) {
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

  const variable = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/.exec(v);
  if (variable) {
    const bound = env.get(variable[1]!);
    if (bound !== undefined) return resolveColor(bound, env, depth + 1);
    return variable[2] !== undefined ? resolveColor(variable[2], env, depth + 1) : null;
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
  violations: [],
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
  for (const [token, entry] of Object.entries(decl.tokens)) {
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
  // "Extreme geprüft" heisst: JEDE deklarierte Achse hat mindestens einen Stopp
  // erzeugt. Ein Skin ohne farbwirksame Tweaks (terminal) hat nichts anzufahren —
  // dort ist die Aussage trivial wahr, und der Report zeigt `tweakStops: [default]`.
  const checkedTweakExtremes = axes.length === 0 || stops.length > 1;

  const measurements: A11yMeasurement[] = [];
  const violations: A11yMeasurement[] = [];
  const base =
    sources.length > 0 && decl.base ? tokensFor(sources, decl.base) : new Map<string, string>();
  const alphas = decl.alphas && decl.alphas.length > 0 ? decl.alphas : [1];

  for (const [theme, selector] of measuredThemes) {
    if (sources.length === 0) break;
    const themeTokens = tokensFor(sources, selector);

    for (const stop of stops) {
      const env = new Map<string, string>([...base, ...themeTokens, ...stop.overrides]);

      // 1) Gründe auflösen und die Kette zusammenmischen.
      const ground = new Map<string, Rgba>();
      for (const g of decl.grounds) {
        const resolved = resolveGround(g, decl.grounds, env);
        if (resolved === null) {
          if (stop.label === "default") {
            findings.push({
              problem: "unresolvable",
              detail: `${theme}: Grund ${g.token} = "${env.get(g.token) ?? "(fehlt)"}" ist nicht auflösbar`,
            });
          }
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
          if (stop.label === "default") {
            findings.push({
              problem: "unresolvable",
              detail: `${theme}: ${token} = "${raw}" ist nicht auflösbar — umschreiben oder exempt mit Begründung`,
            });
          }
          continue;
        }
        const threshold = entry.role === "text" ? THRESHOLDS.text : THRESHOLDS.graphic;
        const targets = entry.on ?? decl.grounds.map((g) => g.token);
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

  // 3) Vollständigkeit: jede Farb-Deklaration eines erklärten Blocks MUSS eine
  //    Rolle tragen. Das ist der Riegel gegen "unbequeme Farbe einfach weglassen".
  if (sources.length > 0) {
    const scanned = [
      ...(decl.base ? [decl.base] : []),
      ...measuredThemes.map(([, selector]) => selector),
    ];
    for (const selector of scanned) {
      for (const [name, value] of tokensFor(sources, selector)) {
        if (name in decl.tokens) continue;
        if (COLOR_SHAPED.test(value)) {
          findings.push({
            problem: "unclassified",
            detail: `${selector}: ${name} = "${value}" ist eine Farbe ohne Rolle in a11y.tokens`,
          });
        } else if (COLOR_BEARING.test(value)) {
          findings.push({
            problem: "unclassified",
            detail: `${selector}: ${name} = "${value}" trägt Farbe, ist aber keine flache Farbe — als exempt mit Begründung führen`,
          });
        }
      }
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
  const ok = violations.length === 0 && findings.length === 0 && measurements.length > 0;

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
    violations: violations.sort((a, b) => a.ratio - b.ratio).slice(0, 40),
    ...(Object.keys(exemptTokens).length > 0 ? { exempt: exemptTokens } : {}),
    findings: dedupe(findings),
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
