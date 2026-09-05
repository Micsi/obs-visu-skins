// Ratsche für die PALETTE-Achse: die Vordergrundtöne selbst.
//
// ══ Warum diese Spec existiert
//
// Der Konformitätslauf misst genau das, was hier steht — aber sein Exit-Code hängt
// am Gesamtstatus des Skins, und ionic ist weiterhin `fail`: 98 `unclassified`
// Befunde (Farben, die an a11y.tokens vorbei im Blatt stehen) halten ihn rot.
// Solange das so ist, könnte `a11y.violationCount` von 0 zurück auf 400 klettern,
// ohne dass ein einziger Lauf die Farbe wechselt. Dieselbe Lücke, die für die
// Ink-Achse in smoke.spec.ts und für die Glasflächen in surfaces.spec.ts schon
// geschlossen ist — diese Datei schliesst sie für die Farbwerte.
//
// ══ Was hier festgehalten wird
//
// Die WIRKUNG, nicht die Schreibweise. Kein Test vergleicht einen Hexwert mit einem
// Literal; jeder rechnet das Verhältnis aus, das der Ton real auf seinem erklärten
// Grund erzeugt, und zwar mit derselben Rechnung wie der Generator:
//
//   • WCAG-2.1-Leuchtdichte und -Verhältnis (dieselben Formeln wie a11y.ts),
//   • der Grund über seine `over`-Kette zusammengemischt,
//   • die Deckkräfte aus `a11y.tokens[…].alphas` (die 0.7 der gesperrten Kachel),
//   • an JEDER tileAlpha-Stellung, die auch der Generator anfährt (min/default/max),
//   • in BEIDEN gemessenen Themes (`image` ist im Manifest ausgenommen).
//
// Wer einen Wert zurückdreht, dreht damit ein Verhältnis unter die Schwelle, und
// genau diese Zahl steht in der Fehlermeldung. Gegenprobe gefahren: `--vz-fg-soft`
// im dunklen Block auf den alten `#7a808d` zurückgesetzt → rot, mit allen vierzehn
// gerissenen Paarungen im Klartext, darunter
//
//   --vz-fg-soft reisst:
//     dark/default auf --vz-chip-bg bei alpha=0.7: 2.60:1 < 4.5:1
//     dark/default auf --vz-tile-bg  bei alpha=1:   4.41:1 < 4.5:1
//     …
//
// Zweite Gegenprobe mit `--vz-acc-amber` im hellen Block: rot in vier Tests
// gleichzeitig — der Akzent selbst, seine Ink, der Ionic-Button darauf und der
// Farbton-Block unten.
//
// Dritte Gegenprobe, fuer den Alias-Waechter weiter unten: `--vz-accent` und
// `--vz-accent-ink` zurueck nach `:root` gelegt → beide Tests des dritten Blocks
// rot. Derselbe Zustand laesst den Konformitaetslauf bei `violationCount: 0`
// stehen — er kann ihn nicht sehen. Genau dafuer ist dieser Block da.
//
// ══ Und die REGEL hinter den Zahlen
//
// Ein Kontrastwert lässt sich auch dadurch erreichen, dass man einer Farbe die
// Farbigkeit nimmt — acht identische Graustufen bestünden den ersten Block hier
// und wären als Palette wertlos, weil die acht Akzente Gerätetypen UNTERSCHEIDEN.
// Deshalb prüft der zweite Block, dass die helle Tonstufe der acht denselben
// OKLab-Farbton trägt wie die Marken-Palette in `:root`, dabei nur tiefer liegt
// und ihre Chroma nicht verliert — und dass die acht paarweise auseinanderliegen.
// Zahlen allein wären hier die falsche Ratsche.

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

/* ------------------------------------------------------------------ Parsing */

/** Der Rumpf des Regelblocks, dessen Selektor exakt `selector` ist. */
function blockOf(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  expect(at, `Selektor ${selector} fehlt in ionic.css`).toBeGreaterThan(-1);
  return CSS.slice(at, CSS.indexOf("}", at));
}

function declIn(block: string, name: string): string | undefined {
  return new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block)?.[1]?.trim();
}

const ROOT = blockOf(":root");
/**
 * Der `--ion-*`-Brückenblock. Er steht NACH `:root` und trägt dieselbe Spezifität
 * wie ein Klassenselektor — die Kaskade gibt ihm also den Vorrang vor `:root` und
 * den Nachrang gegenüber den Theme-Blöcken. Der Generator sieht ihn genauso
 * (`themeEnv` sammelt alles, was nicht zu einem FREMDEN Theme gehört); ohne ihn
 * fiele `--ion-color-primary-contrast` hier lautlos aus der Prüfung.
 */
const BRIDGE = blockOf(".visu-root");
const THEME_BLOCKS: Readonly<Record<string, string>> = {
  light: blockOf('.visu-root[data-theme="light"]'),
  dark: blockOf('.visu-root[data-theme="dark"]'),
};
/** Auch das ausgenommene `image` — ein eingefrorener Alias friert dort genauso ein. */
const ALL_THEME_BLOCKS = [
  ...Object.values(THEME_BLOCKS),
  blockOf('.visu-root[data-theme="image"]'),
];

/** Die gemessenen Themes — `image` ist im Manifest ausdrücklich ausgenommen. */
const MEASURED = Object.keys(THEME_BLOCKS).filter(
  (t) => (a11y as { exemptThemes?: Record<string, string> }).exemptThemes?.[t] === undefined,
);

/** Kaskadenreihenfolge: Theme schlägt Brücke schlägt `:root`. */
function tokenValue(theme: string, name: string): string | undefined {
  return (
    declIn(THEME_BLOCKS[theme]!, name) ?? declIn(BRIDGE, name) ?? declIn(ROOT, name) ?? undefined
  );
}

/* -------------------------------------------------------------------- Farbe */

interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** Alpha in der Grammatik, die der Generator beherrscht: Zahl, Alias oder Produkt. */
function alphaOf(expr: string, tileAlpha: number): number {
  const v = expr.trim();
  if (/^[0-9.]+$/.test(v)) return Number(v);
  if (/^var\(\s*--vz-tile-alpha\s*\)$/.test(v)) return tileAlpha;
  const calc = /^calc\(([\s\S]*)\)$/.exec(v);
  expect(calc, `Alpha nicht auflösbar: ${expr}`).not.toBeNull();
  return calc![1]!.split("*").reduce((product, factor) => product * alphaOf(factor, tileAlpha), 1);
}

/**
 * `#rrggbb`, `rgb(a)(…)` und die Alias-Kette `var(--x)`. Alles andere (color-mix,
 * Verläufe) liefert `null` — der Generator nennt das `unresolvable` und misst es
 * nicht; diese Spec überspringt es aus demselben Grund, statt zu raten.
 */
function color(theme: string, value: string, tileAlpha: number, depth = 0): Rgba | null {
  if (depth > 8) return null;
  const v = value.trim();

  const alias = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
  if (alias) {
    const next = tokenValue(theme, alias[1]!);
    return next === undefined ? null : color(theme, next, tileAlpha, depth + 1);
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join("") : hex[1]!;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }

  const fn = /^rgba?\(([\s\S]*)\)$/i.exec(v);
  if (fn) {
    const parts = fn[1]!.split(",").map((p) => p.trim());
    const alpha = parts[3];
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
      a: alpha === undefined ? 1 : alphaOf(alpha, tileAlpha),
    };
  }
  return null;
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

/** Der Grund, wie er nach dem Mischen über seiner `over`-Kette real dasteht. */
function ground(theme: string, token: string, tileAlpha: number): Rgba | null {
  const entry = a11y.grounds.find((g) => g.token === token);
  expect(entry, `${token} steht nicht in a11y.grounds`).toBeDefined();
  const raw = tokenValue(theme, token);
  if (raw === undefined) return null;
  const own = color(theme, raw, tileAlpha);
  if (own === null) return null;
  if (own.a >= 0.999 || entry!.over === undefined) return own;
  const base = ground(theme, entry!.over, tileAlpha);
  return base === null ? null : over(own, base);
}

/* ----------------------------------------------------------------- OKLab */

function toLinear(c: number): number {
  return channel(c);
}
/** OKLab nach Björn Ottosson — nur so viel, wie für Farbton und Chroma nötig ist. */
function oklab(c: Rgba): { L: number; a: number; b: number; C: number } {
  const r = toLinear(c.r);
  const g = toLinear(c.g);
  const bl = toLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, a: A, b: B, C: Math.hypot(A, B) };
}

/** Abstand zweier Farben in der OKLab-Kugel — die Zahl hinter „unterscheidbar". */
function distance(p: ReturnType<typeof oklab>, q: ReturnType<typeof oklab>): number {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

/* --------------------------------------------------------------- Die Fälle */

/** Die Reglerstellungen, die auch der Generator anfährt — aus dem Manifest. */
const tileAlphaTweak = manifest.tweaks!["tileAlpha"]!;
const STOPS: readonly { label: string; value: number }[] = [
  { label: "min", value: tileAlphaTweak.min as number },
  { label: "default", value: tileAlphaTweak.default as number },
  { label: "max", value: tileAlphaTweak.max as number },
];

interface Case {
  readonly theme: string;
  readonly stop: string;
  readonly token: string;
  readonly on: string;
  readonly alpha: number;
  readonly threshold: number;
  readonly ratio: number;
}

const CASES: Case[] = [];
for (const theme of MEASURED) {
  for (const { label, value } of STOPS) {
    for (const [token, entry] of Object.entries(a11y.tokens)) {
      if (entry.role !== "text" && entry.role !== "graphic") continue;
      const raw = tokenValue(theme, token);
      if (raw === undefined) continue; // steht in keinem gemessenen Block
      const fg = color(theme, raw, value);
      if (fg === null) continue; // color-mix & Co. — der Generator misst sie auch nicht
      const threshold = entry.role === "text" ? THRESHOLDS.text! : THRESHOLDS.graphic!;
      const targets = entry.on && entry.on.length > 0 ? entry.on : a11y.grounds.map((g) => g.token);
      const alphas = entry.alphas && entry.alphas.length > 0 ? entry.alphas : (a11y.alphas ?? [1]);
      for (const target of targets) {
        const bg = ground(theme, target, value);
        if (bg === null) continue;
        for (const alpha of alphas) {
          CASES.push({
            theme,
            stop: label,
            token,
            on: target,
            alpha,
            threshold,
            ratio: contrast(over(fg, bg, alpha), bg),
          });
        }
      }
    }
  }
}

/* -------------------------------------------------------------------- Specs */

/** Die Token, die überhaupt Fälle erzeugt haben — ein Fall je Zeile wäre zu fein. */
const TOKENS = [...new Set(CASES.map((c) => c.token))].sort();

describe("jeder gemessene Vordergrund trägt seine Schwelle — auch gedimmt", () => {
  it("die Fälle sind überhaupt zusammengekommen", () => {
    // Ohne diese Zeile wäre eine leere Fallliste ein grüner Lauf: ein Tippfehler im
    // Selektor, und die ganze Ratsche prüfte lautlos nichts mehr.
    expect(CASES.length).toBeGreaterThan(400);
    expect(new Set(CASES.map((c) => c.theme))).toEqual(new Set(["light", "dark"]));
    expect(TOKENS).toContain("--vz-acc-amber");
    expect(TOKENS).toContain("--vz-fg-soft");
  });

  it.each(TOKENS)("%s auf jedem erklärten Grund, bei jeder Deckkraft", (token) => {
    // Ein Test je Token statt je Paarung: die Fehlermeldung nennt trotzdem jede
    // gerissene Paarung mit ihrer Zahl, aber der Lauf bläht sich nicht um tausend
    // Zeilen auf.
    const broken = CASES.filter((c) => c.token === token && c.ratio < c.threshold).map(
      (c) =>
        `${c.theme}/${c.stop} auf ${c.on} bei alpha=${c.alpha}: ${c.ratio.toFixed(2)}:1 < ${c.threshold}:1`,
    );
    expect(broken, `${token} reisst:\n  ${broken.join("\n  ")}`).toEqual([]);
  });
});

describe("die Rechnung oben gilt nur, wenn kein Alias sein Theme verpasst", () => {
  it("kein Alias in :root zeigt auf ein Token, das ein Theme überschreibt", () => {
    // ══ Die Voraussetzung, unter der die flache Variablen-Karte oben stimmt ══
    //
    // Der Block oben löst `var(--x)` in EINER Karte je Theme auf. Der Browser tut
    // das nicht: er substituiert eine Custom Property auf dem Element, das die
    // DEKLARATION trägt. `:root` ist <html>; `[data-theme]` sitzt immer auf einem
    // Nachfahren-div (.visu-root). Ein Alias in :root wird deshalb gegen die
    // Palette von <html> aufgelöst — den dunklen Boden — und erbt als fertiges
    // Literal nach unten; die Tonstufe des hellen Themes erreicht ihn nie.
    //
    // Genau das war hier passiert: `--vz-accent: var(--vz-acc-orange)` und
    // `--vz-accent-ink: var(--ink-orange)` standen in :root. Am echten Element
    // gemessen (<div class="visu-root" data-theme="light">) lieferten sie #ec8b3a
    // statt #954a00 (2.13:1 auf --vz-bg) und #10131a statt #f7f8fa (2.26:1 …
    // 2.88:1 auf den tiefen Akzenten) — dreissig Paarungen, die der Lauf für
    // repariert hielt, plus acht neu gerissene. Der Konformitätslauf kann das
    // nicht sehen (dieselbe flache Karte), und diese Spec konnte es vorher auch
    // nicht: sie kopiert sein Modell.
    //
    // Statt das Modell nachzubauen, prüft diese Zeile die BEDINGUNG, unter der es
    // trägt. Ist sie erfüllt, ist jeder Alias entweder theme-unabhängig oder
    // steht auf dem getheMten Element — und dann rechnet die flache Karte richtig.
    const themed = new Set<string>();
    for (const block of ALL_THEME_BLOCKS) {
      for (const m of block.matchAll(/(--[\w-]+)\s*:/g)) themed.add(m[1]!);
    }
    const frozen: string[] = [];
    for (const decl of ROOT.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      for (const ref of decl[2]!.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (themed.has(ref[1]!)) frozen.push(`${decl[1]}: var(${ref[1]})`);
      }
    }
    expect(
      frozen,
      `in :root eingefroren (gehört in .visu-root, wo [data-theme] sitzt):\n  ${frozen.join("\n  ")}`,
    ).toEqual([]);
  });

  it("die beiden Akzent-Aliasse stehen auf dem getheMten Element", () => {
    // Die Gegenrichtung: der Wächter oben wäre auch grün, wenn jemand die Aliasse
    // ersatzlos streicht. Hier steht, dass sie existieren — und zwar dort.
    expect(declIn(BRIDGE, "--vz-accent")).toBe("var(--vz-acc-orange)");
    expect(declIn(BRIDGE, "--vz-accent-ink")).toBe("var(--ink-orange)");
  });
});

describe("die helle Tonstufe ist dieselbe Palette, nicht eine andere", () => {
  const ACCENTS = [
    "--vz-acc-orange",
    "--vz-acc-teal",
    "--vz-acc-violet",
    "--vz-acc-green",
    "--vz-acc-blue",
    "--vz-acc-rose",
    "--vz-acc-amber",
    "--vz-acc-slate",
  ] as const;

  it.each(ACCENTS)("%s hält im hellen Theme seinen Farbton", (token) => {
    // Die Nebenbedingung als Test: die acht Akzente unterscheiden Gerätetypen.
    // Kontrast liesse sich billig durch Entsättigen kaufen — acht Graustufen
    // bestünden den Block oben und wären als Palette wertlos. Hier steht, dass die
    // helle Stufe DENSELBEN Farbton trägt und nur tiefer liegt.
    //
    // Gemessen wird der Abstand SENKRECHT zur Farbachse des Bodens, nicht ein
    // Winkel: bei kleiner Chroma (slate, C = 0.027) sind wenige Grad optisch nichts,
    // bei grosser Chroma sind sie ein anderer Farbton. Ein Winkelmass hätte slate
    // fälschlich rot gemacht und amber fälschlich durchgelassen. 0.01 liegt unter
    // der Sichtbarkeitsschwelle von rund 0.02.
    const base = oklab(color("dark", tokenValue("dark", token)!, 0.55)!);
    const light = oklab(color("light", tokenValue("light", token)!, 0.55)!);
    const len = Math.hypot(base.a, base.b);
    const perpendicular = Math.abs((base.a * light.b - base.b * light.a) / len);
    expect(perpendicular, `${token}: Farbton wandert`).toBeLessThan(0.01);
    expect(light.L, `${token}: helle Stufe muss TIEFER liegen`).toBeLessThan(base.L);
    // Chroma darf im engeren sRGB-Raum weiter unten schrumpfen, aber nicht kippen:
    // unter der Hälfte wäre der Ton entfärbt statt vertieft.
    expect(light.C, `${token}: Chroma entfärbt`).toBeGreaterThan(base.C * 0.5);
  });

  it("die acht bleiben paarweise unterscheidbar — in beiden Themes", () => {
    // Die eigentliche Schranke gegen „alle in dieselbe Ecke ziehen, bis die Zahlen
    // stimmen". Gemessen liegt der engste Abstand bei 0.075 (teal/slate, hell) und
    // 0.095 (violet/blue, dunkel). 0.06 lässt etwas Luft für spätere Feinarbeit und
    // liegt immer noch beim Dreifachen der Unterscheidungsschwelle für Flächen.
    for (const theme of MEASURED) {
      const cols = ACCENTS.map((t) => oklab(color(theme, tokenValue(theme, t)!, 0.55)!));
      for (let i = 0; i < cols.length; i++) {
        for (let j = i + 1; j < cols.length; j++) {
          expect(
            distance(cols[i]!, cols[j]!),
            `${theme}: ${ACCENTS[i]} und ${ACCENTS[j]} zu nah`,
          ).toBeGreaterThan(0.06);
        }
      }
    }
  });
});

describe("die neutrale Text-Leiter bleibt eine Leiter", () => {
  // Die acht Akzente haben eine Abstandsschranke, die Graustufen hatten keine —
  // und genau die sind beim Sanieren gestaucht worden: der 0.7-Dimmer der
  // gesperrten Kachel deckelt sie oben, drei Stufen teilen sich seither rund ein
  // Drittel der frueheren Spanne. Ohne Waechter koennte ein spaeterer Lauf sie
  // vollends einebnen, und jedes Gate bliebe gruen: `--vz-fg-mute` und
  // `--vz-fg-soft` haben dann immer noch ihren Kontrast, sie waeren nur nicht
  // mehr voneinander zu unterscheiden. Hierarchie ist aber der Zweck dieser drei
  // Token, nicht ihr Kontrast allein.
  //
  // 0.03 OKLab-L ist bewusst niedrig angesetzt: es ist die Untergrenze dafuer,
  // dass zwei Flaechen nebeneinander als verschieden hell lesen — kein
  // Wunschabstand. Heute liegen die Schritte bei rund 0.08.
  const LADDER = ["--vz-fg", "--vz-fg-mute", "--vz-fg-soft"] as const;
  const MIN_STEP = 0.03;

  it.each(["light", "dark"] as const)("%s: fg → fg-mute → fg-soft fallen erkennbar ab", (theme) => {
    const ls = LADDER.map((t) => {
      const c = color(theme, tokenValue(theme, t)!, 1);
      expect(c, `${theme}: ${t} nicht auflösbar`).not.toBeNull();
      return { token: t, L: oklab(c!).L };
    });
    // Im hellen Theme ist der Text dunkel, im dunklen hell — die Leiter faellt
    // also in entgegengesetzte Richtungen. Gemessen wird der Betrag.
    for (let i = 1; i < ls.length; i += 1) {
      const step = Math.abs(ls[i]!.L - ls[i - 1]!.L);
      expect(
        step,
        `${theme}: ${ls[i - 1]!.token} (L ${ls[i - 1]!.L.toFixed(3)}) und ${ls[i]!.token} (L ${ls[i]!.L.toFixed(3)}) liegen zu dicht`,
      ).toBeGreaterThan(MIN_STEP);
    }
    // …und sie laufen monoton, nicht im Zickzack.
    const dir = Math.sign(ls[1]!.L - ls[0]!.L);
    expect(Math.sign(ls[2]!.L - ls[1]!.L), `${theme}: die Leiter kehrt um`).toBe(dir);
  });
});

/* ═══════════════════ Die Ratsche zur zweiten Rolle des Akzents ═══════════════════
 *
 * Der Akzent trägt ZWEI Verwendungen: Balkenfüllung, LED und Ring (grafisch) und —
 * über `--acc: var(--vz-accent)` — echten Text in `.vz-climate-soll` (12px/600),
 * `.vz-climate-mode` und `.vz-dialog-val` (15px/700). Das Messmodell kennt aber nur
 * EINE Rolle je Token, und die strengere gewinnt: `text`, 4.5:1.
 *
 * Damit fiel die Deckkraft 0.7 aus der Deklaration — die Sperr-Dämpfung
 * `.vz-tile.locked .vz-tile-body { opacity: 0.7 }`. Sie gegen 4.5:1 zu messen wäre
 * falsch streng: gedämpft ist die Kachel gesperrt, dort zeigt der Akzent Balken und
 * Ring, nicht Fliesstext. Sie GAR NICHT zu messen wäre aber eine stille Lücke —
 * 270 Paarungen, die vorher liefen. Also stehen sie hier, gegen die Schwelle, die
 * für sie gilt: 3:1.
 *
 * Gegenprobe gefahren: `--vz-acc-blue` in `:root` von `#5a93dd` auf `#3a6ba8`
 * abgedunkelt → rot über alle drei Reglerstellungen, u. a.
 *   dark/min auf --vz-tile-bg-strong bei alpha=0.7: 2.02:1 < 3:1
 *   dark/min auf --vz-bg             bei alpha=0.7: 2.30:1 < 3:1
 */

/**
 * Die Sperr-Deckkraft — aus dem Blatt gelesen, nicht als Zahl hier hingeschrieben.
 * Wer `opacity: 0.7` an der gesperrten Kachel ändert, ändert damit auch das, wogegen
 * diese Ratsche misst; ein Literal hier würde die Verbindung kappen.
 */
const LOCKED_ALPHA = (() => {
  const rule = /\.vz-tile\.locked\s+\.vz-tile-body[^{]*\{([^}]*)\}/.exec(CSS);
  expect(rule, "Regel `.vz-tile.locked .vz-tile-body` fehlt in ionic.css").not.toBeNull();
  const opacity = /opacity\s*:\s*([0-9.]+)/.exec(rule![1]!);
  expect(opacity, "die gesperrte Kachel dämpft nicht mehr per opacity").not.toBeNull();
  return Number(opacity![1]);
})();

/**
 * Genau die Token, deren 0.7 aus der Deklaration gefallen ist: die Akzente, die
 * SELBST Fläche sein können (sie stehen in `a11y.grounds`, weil die Ink auf ihnen
 * liegt) und die zugleich Text tragen. `--vz-accent-ink` fällt damit heraus — es ist
 * Tinte AUF dem Akzent, nie Fläche, und hatte nie eine 0.7 abzugeben.
 */
const GROUND_TOKENS = new Set(a11y.grounds.map((g) => g.token));
const DUAL_ROLE = Object.entries(a11y.tokens)
  .filter(([name, e]) => e.role === "text" && GROUND_TOKENS.has(name))
  .map(([name]) => name)
  .sort();

/** Dieselben Fälle wie oben, nur mit der Sperr-Deckkraft und der Grafikschwelle. */
const DIMMED: Case[] = [];
for (const theme of MEASURED) {
  for (const { label, value } of STOPS) {
    for (const token of DUAL_ROLE) {
      const raw = tokenValue(theme, token);
      if (raw === undefined) continue;
      const fg = color(theme, raw, value);
      if (fg === null) continue;
      const entry = a11y.tokens[token]!;
      const targets = entry.on && entry.on.length > 0 ? entry.on : a11y.grounds.map((g) => g.token);
      for (const target of targets) {
        const bg = ground(theme, target, value);
        if (bg === null) continue;
        DIMMED.push({
          theme,
          stop: label,
          token,
          on: target,
          alpha: LOCKED_ALPHA,
          threshold: THRESHOLDS.graphic!,
          ratio: contrast(over(fg, bg, LOCKED_ALPHA), bg),
        });
      }
    }
  }
}

describe("der Akzent hält als gesperrte Grafik seine eigene Schwelle", () => {
  it("die gedämpften Fälle sind überhaupt zusammengekommen", () => {
    // Ohne diese Zeile wäre die Ratsche mit einer leeren Liste grün — und die 270
    // Paarungen, für die sie einspringt, wären lautlos verschwunden.
    expect(DUAL_ROLE.length).toBe(9);
    expect(DIMMED.length).toBeGreaterThan(200);
    // Und: die Deklaration hat die 0.7 wirklich abgegeben. Holt jemand sie zurück,
    // misst der Generator wieder selbst und diese Ratsche wird überflüssig — dann
    // soll sie brechen, statt still doppelt zu prüfen.
    for (const token of DUAL_ROLE) expect(a11y.tokens[token]!.alphas).toEqual([1]);
  });

  it.each(DUAL_ROLE)("%s bei gesperrter Kachel", (token) => {
    const broken = DIMMED.filter((c) => c.token === token && c.ratio < c.threshold).map(
      (c) =>
        `${c.theme}/${c.stop} auf ${c.on} bei alpha=${c.alpha}: ${c.ratio.toFixed(2)}:1 < ${c.threshold}:1`,
    );
    expect(broken, `${token} reisst gedämpft:\n  ${broken.join("\n  ")}`).toEqual([]);
  });
});
