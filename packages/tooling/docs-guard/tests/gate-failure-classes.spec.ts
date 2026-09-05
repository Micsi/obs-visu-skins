// Ratsche gegen eine Doku, die weniger Abbruchgruende nennt, als das Gate hat.
//
// ══ Der Fehler, gegen den sie steht
//
// `AGENTS.md → „CI-Gates"` sagt: „Das Gate faehrt alle Skins und bricht bei
// `gap`/`broken` oder einem `honors`-Befund." Das ist eine Aufzaehlung, und sie war
// unvollstaendig. `generateSupport()` setzt sein hartes Fehler-Flag naemlich aus VIER
// Quellen:
//
//   hasGap: summary.gap > 0 || summary.broken > 0 || honors.length > 0 || a11yFailed
//
// Die vierte — `a11yFailed`, also `report.a11y.status !== "pass"` — ist die einzige, die
// OHNE jede `gap`-, `broken`- oder `honors`-Zeile im Report zuschlaegt: ein Skin ohne
// AA-Deklaration meldet `undeclared` (ausdruecklich NICHT `pass`), und das Gate faellt.
// Wer der Doku glaubt, sieht einen roten Lauf, findet keinen der drei genannten Gruende
// und sucht einen Fehler im Tooling — statt die Farb-Deklaration des Skins zu reparieren.
//
// ══ Warum das hier nicht per Regex auf den Ausdruck geprueft wird
//
// Ein `hasGap:\s*.+\|\|.+\|\|.+` haette den heutigen Wortlaut festgehalten und waere bei
// der naechsten Umformatierung gefallen, ohne dass sich am VERHALTEN etwas geaendert
// haette. Eine Ratsche, die die Schreibweise bewacht, deckt genau den Fall nicht, fuer
// den sie gebaut wurde.
//
// Diese hier misst deshalb zweimal, und die beiden Messungen halten einander:
//
//   1. WIRKUNG — vier synthetische Skins gehen durch den echten `generateSupport()`.
//      Jeder loest genau EINE Fehlerklasse aus und ist in den drei anderen nachweislich
//      sauber (`summary.gap === 0`, `summary.broken === 0`, `honors.length === 0`,
//      `a11y.status === "pass"` — je nachdem, was der Fall NICHT sein soll). Dazu ein
//      Kontroll-Skin, der in allen vier Achsen sauber ist und `hasGap: false` liefert.
//      Ohne ihn bewiesen die vier Faelle nur, dass irgendetwas rot macht.
//
//   2. VOLLSTAENDIGKEIT — der `hasGap`-Ausdruck wird aus `conformance/index.ts`
//      GESCHNITTEN und in seine `||`-Operanden zerlegt. Aus jedem Operanden werden die
//      Bezeichner erhoben — `summary.gap` → „gap", `a11yFailed` → „a11yfailed"/„a11y".
//
// Erst die Kopplung traegt: JEDER erhobene Operand muss genau einen Beleg aus (1)
// haben, und jeder Beleg genau einen Operanden. Kommt morgen eine fuenfte Fehlerklasse
// dazu, hat sie keinen Beleg → rot, mit der Aufforderung, sie zu belegen UND zu
// dokumentieren. Faellt eine weg, steht ein Beleg ohne Operanden da → ebenfalls rot.
// Die Zahl vier steht deshalb nirgends in dieser Datei; sie ergibt sich.
//
// ══ Wie weit der Schnitt traegt (und wo er aufhoert)
//
// Der Schnitt haengt an Klammertiefe und Trennzeichen, nicht an Leerzeichen. Er ueberlebt
// deshalb: Zeilenumbrueche und Einrueckung (prettier), Kommentare mitten im Ausdruck,
// `||` in String-Literalen, und ueberfluessige Klammern — `(a || b) || (c || d)` zerfaellt
// rekursiv in vier Operanden, nicht in zwei.
//
// Er ueberlebt NICHT jede denkbare Umschreibung, und das ist kein Versehen: wird der
// Ausdruck in eine Hilfsvariable, einen Ternaer oder ein `if/else` verlegt, ist es ein
// anderer Ausdruck, und diese Ratsche kann ihn nicht mehr an seinen Operanden ablesen.
// Sie faellt dann LAUT (Failed Suite, Exit != 0) statt still: die Erhebung liefert einen
// einzigen Sammel-Operanden, die Kopplung findet fuer ihn kein eindeutiges Gegenstueck,
// und beide Fehlermeldungen drucken den geschnittenen Ausdruck und die erhobenen
// Operanden mit ab — damit der naechste Leser in einem Satz sieht, was passiert ist.
// Nachgemessen: eine Verlegung nach `const a11yFailed = …; hasGap: gapish` ergibt genau
// einen Operanden und faellt an „nur EIN Operand erheben" und an der Kopplung.
//
// ══ Die Doku-Pruefung: zwei Haelften, und die zweite ist die tragende
//
// Beide Haelften haengen an derselben Erhebung; keine kennt das Wort „a11y", sie lesen es
// aus dem Code.
//
//   A. NENNUNG (nach vorne gerichtet) — der Abschnitt „CI-Gates" muss fuer JEDEN
//      Operanden eines seiner Woerter nennen. Ein fuenfter Operand `quotaExceeded`
//      verlangt damit automatisch „quota" (oder „quotaexceeded") im Abschnitt.
//
//   B. PFLICHTAUSSAGE (gegen die Umformulierung) — A allein ist fail-open, nachgemessen
//      an zwei Sabotagen, die beide 8/8 gruen liefen: das Wort „a11y" nur an die
//      Befehlszeile angehaengt; und der Abschnitt sagt das GEGENTEIL („Die `a11y`-Achse
//      ist rein informativ und bricht das Gate nicht"). Beide nennen das Wort, beide
//      lassen den Leser genauso ratlos zurueck wie vorher.
//      Deshalb verlangt B zusaetzlich die beiden Statuswoerter, die der Generator an
//      dieser Achse WIRKLICH emittiert — GEMESSEN, nicht hingeschrieben: der Status des
//      Kontroll-Skins (`pass`) und der Status des Skins ohne Deklaration (`undeclared`).
//      Ein Text, der beide traegt, ist mindestens VON diesem Gegensatz; ein Text, der das
//      Stichwort nur streift, traegt keinen von beiden. Beide Sabotagen fallen daran.
//
// ══ Was diese Ratsche NICHT prueft
//
// **Ob der Abschnitt die Fehlerklasse RICHTIG erklaert.** Beide Haelften sind
// Wort-Anwesenheitsprueflungen ueber erhobene Mengen — die Stichwoerter der Operanden und
// die gemessenen Statuswoerter. Wer sie beisammen hat und die Aussage trotzdem umdreht
// („steht auf `undeclared`, ist aber nicht `pass` genug, um das Gate zu brechen"), kommt
// durch. Das ist bewusst so und nicht durch eine Satzprueflung zu heilen: eine Aussage in
// deutscher Prosa hat eine unbegrenzte Formenvielfalt, und ein Waechter darueber
// dieselbe unbegrenzte Fehlerflaeche. Was hier bleibt, ist der reale Driftfall — eine
// Aufzaehlung, die eine Klasse gar nicht kennt, und ein Nachbessern, das nur das
// Stichwort einstreut (beide Sabotagen sind gefahren, siehe unten).
//
// **Die Behauptung „seit Vertrag 1.13".** Eine historische Angabe ohne laufende Quelle im
// Repo — die aktuelle `version` aus `@obs/visu-contract` widerlegt sie nicht, wenn der
// Vertrag weiterzieht. Ein Abgleich gegen einen Kommentar waere Prosa gegen Prosa.
//
// ══ Gegenproben (alle gefahren, echte Meldungen)
//
// 1 und 2 laufen gegen eine Kopie der Doku unter `DOCS_ROOT`; 3 in einer Sandbox-Kopie
// des Repos.
//
// 1. Den a11y-Teil aus dem Abschnitt 'CI-Gates' entfernt (zurueck auf die alte Fassung
//    „bricht bei `gap`/`broken` oder einem `honors`-Befund") → BEIDE Haelften fallen:
//    AGENTS.md, Abschnitt 'CI-Gates' nennt diese Abbruchgruende des Gates nicht, obwohl
//    `generateSupport()` sie in `hasGap` fuehrt
//    Geschnittener Ausdruck: summary.gap > 0 || summary.broken > 0 || honors.length > 0
//    || a11yFailed — Erhobene Operanden (4): … `a11yFailed` → [a11yfailed, a11y]
//    AGENTS.md, Abschnitt 'CI-Gates' nennt die Statuswoerter nicht, die der Generator an
//    dieser Achse wirklich emittiert. …
//
// 2. Nur die Statuswoerter entfernt, das Stichwort `a11y` stehengelassen („ein Skin ohne
//    `a11y`-Deklaration bricht das Gate ebenfalls") → Haelfte A gruen, Haelfte B rot:
//    AGENTS.md, Abschnitt 'CI-Gates' nennt die Statuswoerter nicht, die der Generator an
//    dieser Achse wirklich emittiert. Das Stichwort allein genuegt nicht — es steht auch
//    in einer Befehlszeile und in einer Aussage, die das Gegenteil behauptet. Der
//    Abschnitt muss sagen, WORAN der Leser die Klasse im Report erkennt: an welchem Status
//    sie bestanden ist und an welchem nicht.
//    Das ist der Grund fuer Haelfte B: zwei Sabotagen (Wort in der Befehlszeile;
//    invertierte Aussage) sind an der blossen Nennung nachweislich vorbeigekommen.
//
// 3. In der Sandbox eine FUENFTE Fehlerklasse in den Gate-Ausdruck gesetzt
//    (`… || a11yFailed || quotaExceeded`) → die Kopplung und die Nennung fallen zugleich:
//    Der Gate-Ausdruck fuehrt Fehlerklassen, fuer die hier kein (oder mehr als ein) Beleg
//    steht. … (a) eine Fehlerklasse ist DAZUGEKOMMEN — dann ergaenze einen synthetischen
//    Skin, der genau sie ausloest, und nenne sie in AGENTS.md …
//    AGENTS.md, Abschnitt 'CI-Gates' nennt diese Abbruchgruende des Gates nicht …
//
// 4. In der Sandbox `ensureDom()` auf `false` gezwungen →
//    keine DOM-faehige Laufzeit — der Generator meldet dann JEDEN Typ als `broken`, und
//    die Faelle unten trennen keine Fehlerklassen mehr.: expected false to be true
//
// 5. In der Sandbox den a11y-Status IMMER auf `pass` gesetzt → die Pflichtaussage
//    verliert ihren Gegensatz, und der a11y-Fall belegt nichts mehr:
//    Die Klasse `a11yFailed` erhebt nur EIN Statuswort (pass). Die Aussage lebt vom
//    GEGENSATZ zweier Woerter (bestanden gegen nicht deklariert) …
//    Der Fall 'ein Skin ohne AA-Deklaration' belegt seine Klasse nicht: der Report zeigt
//    den erwarteten Befund fuer 'a11y' nicht.
//
// 6. In der Sandbox `summary.gap` IMMER auf 1 gesetzt → der Kontroll-Skin faellt und die
//    drei anderen Faelle verlieren ihre Isolierung:
//    ein in allen Achsen sauberer Skin bricht das Gate NICHT: expected 1 to be +0
//    Der Fall 'ein Renderer, der an einer Vertrags-Fixture wirft' loest zusaetzlich 'gap'
//    aus und trennt die Fehlerklassen damit nicht mehr.
//
// 7. In der Sandbox `summary.gap` IMMER auf 0 gesetzt →
//    Der Fall 'ein deklarierter Typ ohne Renderer' belegt seine Klasse nicht: der Report
//    zeigt den erwarteten Befund fuer 'gap' nicht.
//
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FENCE_LINE, stepFence, type Fence } from "./markdown.js";

/** Wurzel des Workspace (packages/tooling/docs-guard/tests → 4 Ebenen hoch). */
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Wurzel, aus der die DOKU gelesen wird — ueberschreibbar, damit sich die Korrektur in
 * einer Kopie belegen laesst, ohne die im Repo geteilte `AGENTS.md` anzufassen. Der
 * CODE wird immer aus dem echten Repo erhoben: die Wirkung des Gates haengt nicht
 * daran, wo gerade eine Doku-Kopie liegt.
 */
const DOCS_ROOT = process.env.DOCS_ROOT ?? ROOT;

const AGENTS = readFileSync(join(DOCS_ROOT, "AGENTS.md"), "utf8");
const GENERATOR_SRC = readFileSync(join(ROOT, "packages/tooling/conformance/index.ts"), "utf8");

/* ─────────────────────────────────────────────── Erhebung: die Operanden von hasGap */

/**
 * Ueberspringt ein String-Literal ab `i` (dort steht das oeffnende Zeichen) und liefert
 * den Index HINTER dem schliessenden. Escapes zaehlen doppelt.
 *
 * Eine eigene Funktion, weil drei Scanner sie brauchen: der Ausdrucks-Schnitt, die
 * `||`-Zerlegung und die Klammer-Entpackung. Fehlte sie in einem davon, zersaegte ein
 * `||` oder eine `)` in einem Literal genau dort den Operanden — der Kritiker hat das
 * an der Zerlegung nachgewiesen.
 */
function skipString(src: string, i: number): number {
  const quote = src[i] as string;
  let j = i + 1;
  while (j < src.length && src[j] !== quote) j += src[j] === "\\" ? 2 : 1;
  return j + 1;
}

const isQuote = (c: string | undefined): boolean => c === '"' || c === "'" || c === "`";
const OPEN = "([{";
const CLOSE = ")]}";

/**
 * Schneidet den Ausdruck hinter einem `<name>:` heraus — bis zum naechsten Trennzeichen
 * auf Klammertiefe 0.
 *
 * Bewusst ein Scanner und keine Regex: der Ausdruck darf umgebrochen, eingeklammert
 * oder kommentiert werden, ohne dass diese Ratsche etwas merkt. Genau das ist der
 * Unterschied zwischen „bewacht die Wirkung" und „bewacht die Schreibweise".
 */
function sliceExpression(src: string, from: number): string {
  let depth = 0;
  let i = from;
  const out: string[] = [];
  while (i < src.length) {
    const c = src[i] as string;
    const next = src[i + 1];
    // Kommentare gehoeren nicht zum Ausdruck.
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    // Strings am Stueck uebernehmen — ein `,` darin trennt nichts.
    if (isQuote(c)) {
      const end = skipString(src, i);
      out.push(src.slice(i, end));
      i = end;
      continue;
    }
    if (OPEN.includes(c)) depth++;
    if (CLOSE.includes(c)) {
      if (depth === 0) break;
      depth--;
    }
    if (depth === 0 && (c === "," || c === ";")) break;
    out.push(c);
    i++;
  }
  return out.join("").trim();
}

/**
 * Der Ausdruck, aus dem das harte Fehler-Flag des Gates entsteht.
 *
 * GENAU EINE Zuweisung, nicht die erste: waere `hasGap` an zwei Stellen belegt, koennte
 * diese Ratsche still die falsche bewachen — und ein Leser wuesste ebenso wenig, welche
 * gilt. Die Typdeklaration (`readonly hasGap: boolean`) ist keine Zuweisung und wird
 * uebersprungen.
 */
function hasGapExpression(src: string): string {
  const found: string[] = [];
  for (const m of src.matchAll(/\bhasGap\s*:/g)) {
    const before = src.slice(0, m.index);
    if (/\breadonly\s*$/.test(before)) continue;
    const expr = sliceExpression(src, (m.index as number) + m[0].length);
    if (expr.length > 0) found.push(expr);
  }
  if (found.length !== 1) {
    throw new Error(
      `conformance/index.ts: erwartet genau EINE Belegung von \`hasGap\`, gefunden ${found.length}. ` +
        "Diese Ratsche kann dann nicht entscheiden, welche das Gate steuert — und ein Leser auch nicht.",
    );
  }
  return found[0] as string;
}

/** Zerlegt auf Klammertiefe 0 an `||` — string-bewusst, damit ein `||` im Literal nichts trennt. */
function splitTopLevelOr(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < expr.length) {
    const c = expr[i] as string;
    if (isQuote(c)) {
      i = skipString(expr, i);
      continue;
    }
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth--;
    else if (depth === 0 && c === "|" && expr[i + 1] === "|") {
      parts.push(expr.slice(start, i));
      i += 2;
      start = i;
      continue;
    }
    i++;
  }
  parts.push(expr.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Ist der ganze Ausdruck in EIN Klammerpaar gefasst, liefert dies den Inhalt — sonst
 * `null`. `(a || b)` → `a || b`; `f(a || b)` → `null` (die Klammer gehoert dem Aufruf).
 */
function unwrapParens(expr: string): string | null {
  if (!expr.startsWith("(")) return null;
  let depth = 0;
  let i = 0;
  while (i < expr.length) {
    const c = expr[i] as string;
    if (isQuote(c)) {
      i = skipString(expr, i);
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i === expr.length - 1 ? expr.slice(1, -1).trim() : null;
    }
    i++;
  }
  return null;
}

/**
 * Die `||`-Operanden — REKURSIV durch Klammern hindurch.
 *
 * Ohne die Rekursion machte ein reines Reformat den Build rot: `(a || b) || (c || d)` ist
 * derselbe Ausdruck, ergab aber zwei Sammel-Operanden mit je zwei Stichwoertern, und die
 * Kopplung meldete „ergaenze je einen synthetischen Skin" — eine Anweisung, die am Fall
 * vorbeigeht. Eine Ratsche darf an einer Umklammerung nicht fallen.
 */
function orOperands(expr: string): string[] {
  const parts = splitTopLevelOr(expr);
  if (parts.length === 1) {
    const only = parts[0] as string;
    const inner = unwrapParens(only);
    return inner === null || inner === only ? [only] : orOperands(inner);
  }
  return parts.flatMap(orOperands);
}

/** Ersetzt String-Literale durch Leerraum — ihr Inhalt ist Text, kein Bezeichner. */
function stripStringLiterals(expr: string): string {
  let out = "";
  let i = 0;
  while (i < expr.length) {
    if (isQuote(expr[i])) {
      const end = skipString(expr, i);
      out += " ";
      i = end;
      continue;
    }
    out += expr[i];
    i++;
  }
  return out;
}

/**
 * Strukturelle Bezeichner, die keine Fehlerklasse BENENNEN — sie tragen sie nur.
 * Bewusst kurz gehalten: was hier faelschlich landet, macht die Ratsche blind, und
 * genau dagegen steht die Leer-Pruefung unten.
 */
const STRUCTURAL = new Set([
  "summary",
  "report",
  "length",
  "size",
  "count",
  "status",
  "some",
  "every",
  "includes",
  "failed",
  "fail",
  "has",
  "is",
]);

/**
 * `a11yFailed` → ["a11yfailed", "a11y"], `summary.gap` → ["gap"].
 *
 * Der VOLLE Bezeichner steht mit in der Liste, nicht nur die camelCase-Teile: eine Doku,
 * die den Operanden beim Namen nennt („bricht, sobald `a11yFailed` gesetzt ist"), wurde
 * sonst als Nicht-Nennung gemeldet — die Wortgrenze hinter „a11y" schlaegt in
 * „a11yfailed" fehl. Ein Fehlalarm bei korrekter Doku ist derselbe Schaden wie ein
 * uebersehener Fehler: beide bringen den naechsten Leser dazu, der Ratsche nicht mehr zu
 * glauben.
 *
 * String-Literale werden vorher entfernt: stuende die Quelle inline als
 * `report.a11y?.status !== "pass"`, waere „pass" sonst ein Stichwort, und der Doku
 * genuegte das blanke Wort.
 */
function keywordsOf(operand: string): string[] {
  const ids = [...stripStringLiterals(operand).matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)].map(
    (m) => m[0],
  );
  const words = ids.flatMap((id) => [
    id.toLowerCase(),
    ...id
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .split(" ")
      .map((w) => w.toLowerCase()),
  ]);
  return [...new Set(words)].filter((w) => !STRUCTURAL.has(w));
}

interface FailureClass {
  /** Der Operand, wie er im Code steht — er steht in jeder Fehlermeldung. */
  readonly operand: string;
  /** Die Woerter, an denen die Doku diese Klasse nennen kann. */
  readonly keywords: readonly string[];
}

const HAS_GAP_EXPR = hasGapExpression(GENERATOR_SRC);
const FAILURE_CLASSES: readonly FailureClass[] = orOperands(HAS_GAP_EXPR).map((operand) => ({
  operand,
  keywords: keywordsOf(operand),
}));

/** Steht unter jeder Meldung, die von der Zerlegung handelt — sonst raet der Leser. */
const ERHEBUNG =
  `\nGeschnittener Ausdruck: ${HAS_GAP_EXPR}\n` +
  `Erhobene Operanden (${FAILURE_CLASSES.length}): ` +
  FAILURE_CLASSES.map((c) => `\`${c.operand}\` → [${c.keywords.join(", ")}]`).join(" · ");

/* ───────────────────────────────────────────── Wirkung: der echte Generator, gefahren */

interface SupportReport {
  readonly summary: Record<string, number>;
  readonly a11y?: { readonly status?: string };
}
interface Conformance {
  readonly CORE_WIDGET_TYPES: readonly string[];
  readonly LAYOUT_HONORS: readonly string[];
  readonly ensureDom: () => Promise<boolean>;
  readonly generateSupport: (skin: unknown) => Promise<{
    readonly hasGap: boolean;
    readonly honors: readonly unknown[];
    readonly report: SupportReport;
  }>;
}

/**
 * Der Generator wird ueber einen BERECHNETEN Pfad geladen, nicht ueber seinen
 * Paketnamen: `docs-guard` fuehrt `@obs-visu-skins/conformance` bewusst nicht in seinen
 * Abhaengigkeiten (es ist ein Doku-Waechter, kein Konsument des Vertrags), und ein
 * statischer Import ueber `../../conformance/index.js` laege ausserhalb des `rootDir`
 * dieses Projekts — `tsc --build` bricht daran. Der dynamische Import haelt beide
 * Grenzen ein und misst trotzdem den echten Code.
 */
const conformance = (await import(
  /* @vite-ignore */ join(ROOT, "packages/tooling/conformance/index.ts")
)) as Conformance;

/**
 * VOR jedem Lauf: die Aktions-Achse montiert mit Vue in ein echtes Dokument, und
 * `@vue/runtime-dom` greift `document` beim MODUL-Laden ab. Ohne Dokument meldet der
 * Generator JEDEN Typ als `broken` — die vier Faelle unten waeren dann alle derselbe,
 * und diese Ratsche belegte nichts. `cli.ts` haelt dieselbe Reihenfolge ein.
 */
const DOM_OK = await conformance.ensureDom();

const ALL_TYPES = [...conformance.CORE_WIDGET_TYPES];
/** Irgendein Kern-Typ — welcher, ist fuer die Fehlerklasse egal; aus dem Vertrag, nicht getippt. */
const SOME_TYPE = ALL_TYPES[0] as string;

/**
 * Eine winzige, GEMESSEN bestandene Palette (Text 14.9:1) — uebernommen aus der Spec
 * des Generators. Sie ist Kulisse, nicht Gegenstand: die drei Faelle, die NICHT die
 * Farb-Achse belegen, brauchen sie, damit ihr `hasGap` wirklich von ihrer eigenen
 * Klasse kommt.
 */
const AA_STYLES = { "./stub.css": '.stub[data-theme="dark"]{--x-bg:#0b0e14;--x-fg:#e6edf3;}' };
const AA_DECL = {
  stylesheet: "./stub.css",
  themes: { dark: '.stub[data-theme="dark"]' },
  grounds: [{ token: "--x-bg" }],
  tokens: { "--x-bg": { role: "ground" }, "--x-fg": { role: "text" } },
};

/** Ein `honors`-Token, das der Vertrag NICHT kennt — gegen den Vertrag geprueft, nicht behauptet. */
const UNKNOWN_HONOR = "kein-vertrags-token";

const manifest = (over: Record<string, unknown>): Record<string, unknown> => ({
  name: "gate-failure-classes",
  // Der Generator validiert die Zielversion nicht (das tun die Skin-Specs), deshalb
  // steht hier bewusst irgendein Wert und keine Kopie des Vertragsstands.
  targetsContract: "1.0",
  unsupported: ALL_TYPES,
  widgets: {},
  layout: { model: "grid", honors: [] },
  a11y: AA_DECL,
  ...over,
});

const throwing = (): never => {
  throw new Error("boom");
};

interface Result {
  readonly hasGap: boolean;
  readonly honors: readonly unknown[];
  readonly report: SupportReport;
}

interface Case {
  /** An diesem Wort haengt der Fall am Operanden — es kommt aus dem Code, nicht aus der Doku. */
  readonly keyword: string;
  readonly label: string;
  readonly skin: Record<string, unknown>;
  /** Was der Report zeigen MUSS, damit der Fall seine Klasse wirklich belegt. */
  readonly evidence: (r: Result) => boolean;
  /**
   * Statuswoerter, die diese Klasse im Report FUEHRT — gemessen am eigenen Lauf und am
   * Kontroll-Lauf. Nur die Farb-Achse hat so etwas: die drei anderen Klassen zeigen sich
   * in Zaehlern (`gap`, `broken`, `honors`), die man nicht als Wort zitieren kann. Genau
   * darum ist die Farb-Achse die Klasse, die eine Doku am leichtesten falsch wiedergibt —
   * und die, fuer die eine Pflichtaussage sich sinnvoll erheben laesst.
   */
  readonly statusWords?: (r: Result, clean: Result) => readonly (string | undefined)[];
}

/** Der Kontroll-Skin: in allen vier Achsen sauber. Ohne ihn belegten die Faelle nichts. */
const CLEAN = { manifest: manifest({}), tiles: {}, styles: AA_STYLES };

const CASES: readonly Case[] = [
  {
    keyword: "gap",
    label: "ein deklarierter Typ ohne Renderer",
    skin: {
      manifest: manifest({
        unsupported: ALL_TYPES.filter((t) => t !== SOME_TYPE),
        widgets: { [SOME_TYPE]: { actions: [] } },
      }),
      tiles: {},
      styles: AA_STYLES,
    },
    evidence: (r) => (r.report.summary.gap ?? 0) > 0,
  },
  {
    keyword: "broken",
    label: "ein Renderer, der an einer Vertrags-Fixture wirft",
    skin: {
      manifest: manifest({
        unsupported: ALL_TYPES.filter((t) => t !== SOME_TYPE),
        widgets: { [SOME_TYPE]: { actions: [] } },
      }),
      tiles: { [SOME_TYPE]: throwing },
      styles: AA_STYLES,
    },
    evidence: (r) => (r.report.summary.broken ?? 0) > 0,
  },
  {
    keyword: "honors",
    label: "ein honors-Token, das der Vertrag nicht kennt",
    skin: {
      manifest: manifest({ layout: { model: "grid", honors: [UNKNOWN_HONOR] } }),
      tiles: {},
      styles: AA_STYLES,
    },
    evidence: (r) => r.honors.length > 0,
  },
  {
    keyword: "a11y",
    label: "ein Skin ohne AA-Deklaration",
    // Kein `a11y`, kein `styles` — der Rest ist sauber. Genau der Fall aus dem Befund:
    // rot, ohne eine einzige gap/broken/honors-Zeile im Report.
    skin: { manifest: manifest({ a11y: undefined }), tiles: {} },
    // Gegen den Kontroll-Lauf, nicht gegen ein getipptes "pass": der Fall belegt seine
    // Klasse dadurch, dass er ANDERS steht als der saubere Skin. Das Wort selbst wird
    // genau einmal festgenagelt — unten im Kontroll-Test.
    evidence: (r) => r.report.a11y?.status !== CLEAN_RESULT.report.a11y?.status,
    statusWords: (r, clean) => [r.report.a11y?.status, clean.report.a11y?.status],
  },
];

/**
 * Alle Laeufe EINMAL, im Sammel-Lauf. Bewusst hier und nicht in den `it`s: der
 * Sammel-Lauf kennt kein `testTimeout`, und dieses Paket teilt seine `vitest.config.ts`
 * mit fremden Specs — eine eigene Zeitgrenze waere dort ein Eingriff in fremde Arbeit.
 */
const RESULTS = await Promise.all(CASES.map((c) => conformance.generateSupport(c.skin)));
const CLEAN_RESULT = await conformance.generateSupport(CLEAN);

/* ─────────────────────────────────────── Was die Doku je Fehlerklasse tragen muss */

interface DocDemand {
  readonly operand: string;
  /** Eines davon muss der Abschnitt nennen (Haelfte A). */
  readonly names: readonly string[];
  /** JEDES davon muss der Abschnitt tragen (Haelfte B) — gemessen, nicht getippt. */
  readonly required: readonly string[];
}

const DOC_DEMANDS: readonly DocDemand[] = FAILURE_CLASSES.map((cls) => {
  const i = CASES.findIndex((c) => cls.keywords.includes(c.keyword));
  const c = i >= 0 ? (CASES[i] as Case) : undefined;
  const measured = c?.statusWords
    ? c
        .statusWords(RESULTS[i] as Result, CLEAN_RESULT)
        .filter((w): w is string => typeof w === "string" && w.length > 0)
        .map((w) => w.toLowerCase())
    : [];
  const required = [...new Set(measured)];
  return { operand: cls.operand, names: [...cls.keywords, ...required], required };
});

/** Wie viele Klassen ueberhaupt eine Pflichtaussage erheben — 0 hiesse: Haelfte B ist blind. */
const DEMANDING = DOC_DEMANDS.filter((d) => d.required.length > 0);

/* ─────────────────────────────────────────────────────────────────────── Die Pruefung */

describe("Die Fehlerklassen des Konformitaets-Gates", () => {
  it("misst ueberhaupt etwas (ohne DOM waere jeder Fall derselbe)", () => {
    expect(
      DOM_OK,
      "keine DOM-faehige Laufzeit — der Generator meldet dann JEDEN Typ als `broken`, " +
        "und die Faelle unten trennen keine Fehlerklassen mehr.",
    ).toBe(true);
    expect(
      FAILURE_CLASSES.length,
      `Aus \`hasGap\` liess sich nur EIN Operand erheben — die Zerlegung trennt hier keine ` +
        `Fehlerklassen mehr. Entweder fuehrt das Gate wirklich nur noch eine Klasse, oder der ` +
        `Ausdruck wurde in eine Form gebracht, die dieser Schnitt nicht liest (Hilfsvariable, ` +
        `Ternaer, if/else). Ueberfluessige Klammern sind es NICHT — die werden rekursiv ` +
        `aufgeloest.${ERHEBUNG}`,
    ).toBeGreaterThan(1);
    // Das honors-Token muss dem Vertrag WIRKLICH unbekannt sein — gegen das
    // Vokabular geprueft, nicht angenommen. Nimmt der Vertrag es eines Tages auf,
    // faellt der honors-Fall sonst still in sich zusammen.
    expect(
      conformance.LAYOUT_HONORS,
      `'${UNKNOWN_HONOR}' steht inzwischen im Vertrags-Vokabular — der honors-Fall unten ` +
        "loest dann keinen Befund mehr aus und belegt nichts.",
    ).not.toContain(UNKNOWN_HONOR);
    for (const cls of FAILURE_CLASSES) {
      expect(
        cls.keywords,
        `Der Operand \`${cls.operand}\` hinterlaesst kein Stichwort — die Doku-Pruefung ` +
          `koennte ihn nicht mehr einfordern. Pruefe die Stoppwort-Liste \`STRUCTURAL\`.${ERHEBUNG}`,
      ).not.toEqual([]);
    }
  });

  it("erhebt eine Pflichtaussage, die die Doku tragen muss (sonst waere Haelfte B blind)", () => {
    // Der klassische Fail-open: eine leere Menge macht ein `every` trivial wahr. Genau
    // deshalb steht hier eine Untergrenze — verschwindet die Farb-Achse aus `hasGap`
    // oder faellt ihr Fall weg, faellt diese Zeile, statt dass die Doku-Pruefung
    // lautlos zur reinen Wort-Anwesenheit zurueckkippt.
    expect(
      DEMANDING.map((d) => d.operand),
      "Keine einzige Fehlerklasse erhebt gemessene Statuswoerter. Die Doku-Pruefung waere " +
        "dann wieder nur eine Token-Suche — und die haben zwei Sabotagen nachweislich " +
        `gruen passiert (Wort in der Befehlszeile; invertierte Aussage).${ERHEBUNG}`,
    ).not.toEqual([]);
    for (const d of DEMANDING) {
      expect(
        d.required.length,
        `Die Klasse \`${d.operand}\` erhebt nur EIN Statuswort (${d.required.join(", ")}). ` +
          "Die Aussage lebt vom GEGENSATZ zweier Woerter (bestanden gegen nicht deklariert); " +
          "eines allein steht schnell zufaellig irgendwo im Abschnitt.",
      ).toBeGreaterThan(1);
      for (const w of d.required) {
        expect(
          w,
          `\`${d.operand}\` erhebt das Statuswort '${w}' — das ist kein zitierbares Wort. ` +
            "Der Generator hat sein Status-Vokabular geaendert; die Pflichtaussage muss nach.",
        ).toMatch(/^[a-z][a-z0-9-]*$/);
      }
    }
  });

  it("ein in allen Achsen sauberer Skin bricht das Gate NICHT", () => {
    // Der Boden unter allem: ohne ihn belegten die vier Faelle nur, dass irgendetwas
    // rot macht — nicht, dass es ihre jeweilige Klasse war.
    expect(CLEAN_RESULT.report.summary.gap ?? 0).toBe(0);
    expect(CLEAN_RESULT.report.summary.broken ?? 0).toBe(0);
    expect(CLEAN_RESULT.honors).toEqual([]);
    // Die EINE Stelle, an der das Wort `pass` festgenagelt ist. Alles andere in dieser
    // Datei liest es von hier ab — auch die Pflichtaussage an die Doku. Benennt der
    // Generator es um, faellt genau diese Zeile und sagt, wo nachzuziehen ist.
    expect(
      CLEAN_RESULT.report.a11y?.status,
      "Der Kontroll-Skin ist AA-gemessen sauber, meldet aber nicht `pass`. Entweder ist die " +
        "Palette oben nicht mehr bestanden, oder der Generator hat sein Status-Vokabular " +
        "umbenannt — dann zieht die Doku-Pflichtaussage automatisch mit, dieser Test aber nicht.",
    ).toBe("pass");
    expect(CLEAN_RESULT.hasGap).toBe(false);
  });

  it.each(CASES.map((c, i) => [c.label, i] as const))(
    "%s bricht das Gate — allein aus seiner Klasse",
    (_label, i) => {
      const c = CASES[i] as Case;
      const r = RESULTS[i] as Result;

      expect(
        c.evidence(r),
        `Der Fall '${c.label}' belegt seine Klasse nicht: der Report zeigt den erwarteten ` +
          `Befund fuer '${c.keyword}' nicht.`,
      ).toBe(true);

      // Isolierung: alles, was NICHT die Klasse dieses Falls ist, muss sauber sein.
      // Sonst belegte ein Fall mit zwei Defekten am Ende die falsche Klasse.
      for (const other of CASES) {
        if (other.keyword === c.keyword) continue;
        expect(
          other.evidence(r),
          `Der Fall '${c.label}' loest zusaetzlich '${other.keyword}' aus und trennt die ` +
            "Fehlerklassen damit nicht mehr.",
        ).toBe(false);
      }

      expect(r.hasGap, `Der Fall '${c.label}' bricht das Gate nicht.`).toBe(true);
    },
  );

  it("jede erhobene Fehlerklasse hat genau einen Beleg — und umgekehrt", () => {
    // Die Kopplung. Kommt ein fuenfter Operand dazu, faellt genau hier auf, dass ihn
    // niemand belegt hat; verschwindet einer, steht ein Beleg ohne Operanden da.
    const unproven = FAILURE_CLASSES.filter(
      (cls) => CASES.filter((c) => cls.keywords.includes(c.keyword)).length !== 1,
    );
    expect(
      unproven.map((c) => c.operand),
      "Der Gate-Ausdruck fuehrt Fehlerklassen, fuer die hier kein (oder mehr als ein) " +
        "Beleg steht. Zwei Ursachen kommen in Frage, und die Liste unten trennt sie: " +
        "(a) eine Fehlerklasse ist DAZUGEKOMMEN — dann ergaenze einen synthetischen Skin, " +
        "der genau sie ausloest, und nenne sie in AGENTS.md; (b) der Ausdruck wurde in eine " +
        "Form umgeschrieben, die dieser Schnitt nicht trennt — dann steht unten ein einziger " +
        `Sammel-Operand mit allen Stichwoertern, und zu reparieren ist die Zerlegung.${ERHEBUNG}`,
    ).toEqual([]);

    const orphans = CASES.filter(
      (c) => FAILURE_CLASSES.filter((cls) => cls.keywords.includes(c.keyword)).length !== 1,
    );
    expect(
      orphans.map((c) => c.keyword),
      "Diese Belege gehoeren zu keinem (oder zu mehr als einem) Operanden von `hasGap` " +
        `mehr — der Generator hat sich bewegt, diese Ratsche nicht.${ERHEBUNG}`,
    ).toEqual([]);
  });
});

/* ──────────────────────────────────────────────────────────── Und nun gegen die Doku */

/**
 * Der Abschnitt, in dem ein Maintainer beim roten Gate nachschlaegt.
 *
 * Drei Grenzen, jede gegen einen nachgemessenen Ausweg:
 *
 *  • Gegen den ABSCHNITT, nicht gegen die Datei — „a11y" steht anderswo im Dokument
 *    womoeglich laengst, waehrend die Aufzaehlung, der ein Leser hier folgt, weiter drei
 *    Gruende nennt.
 *  • Der Abschnitt endet an JEDER Ueberschrift, auch an einer tieferen. Zuvor endete er
 *    erst an `#`/`##`, und eine angehaengte „### Randnotiz" mit dem Stichwort darin lief
 *    gruen. Eine Untersektion ist eine andere Leseeinheit; wer beim roten Gate
 *    nachschlaegt, liest den Absatz unter der Ueberschrift.
 *  • Code-Fences werden fuer die Suche ENTFERNT (fuer die Grenzfindung aber gelesen,
 *    damit eine `##`-Zeile in einem Beispielblock den Abschnitt nicht vorzeitig beendet).
 *    Was in einem Beispiel steht, ist keine Aussage des Abschnitts — auch das lief zuvor
 *    gruen.
 */
function ciGatesSection(text: string, label: string): string {
  const lines = text.split("\n");
  const heads: number[] = [];
  {
    // Fence-bewusst schon beim SUCHEN der Ueberschrift: eine `## CI-Gates`-Zeile in einem
    // Beispielblock ist keine Ueberschrift, und ein `~~~`-Block wurde von der frueheren
    // Buchhaltung gar nicht gesehen.
    let fence: Fence | null = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      if (FENCE_LINE.test(line)) {
        fence = stepFence(line, fence);
        continue;
      }
      if (fence === null && /^#{2,4}\s+CI-Gates\b/.test(line)) heads.push(i);
    }
  }
  if (heads.length === 0) throw new Error(`${label}: Abschnitt 'CI-Gates' nicht gefunden.`);
  if (heads.length > 1) {
    throw new Error(
      `${label}: 'CI-Gates' steht ${heads.length}x (Zeilen ${heads.map((i) => i + 1).join(", ")}). ` +
        "Welcher Abschnitt gilt? Diese Ratsche kann es nicht entscheiden — und ein Leser auch nicht.",
    );
  }
  const start = heads[0] as number;
  const nextHead = /^#{1,6}\s/;
  const body: string[] = [];
  let fence: Fence | null = null;
  let ended = false;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (FENCE_LINE.test(line)) {
      fence = stepFence(line, fence);
      continue;
    }
    if (fence !== null) continue;
    if (nextHead.test(line)) {
      ended = true;
      break;
    }
    body.push(line);
  }
  if (fence !== null) {
    throw new Error(
      `${label}: unbalancierte Code-Fence ab Zeile ${start + 1} — der Abschnitt hat kein Ende. ` +
        "So gelesen umfasst er den Rest der Datei, und diese Ratsche pruefte nichts mehr.",
    );
  }
  const prose = body.join("\n");
  if (prose.trim().length === 0) {
    throw new Error(
      `${label}: der Abschnitt 'CI-Gates' hat ausserhalb von Code-Fences keinen Text` +
        `${ended ? " vor der naechsten Ueberschrift" : ""}. Eine Ratsche gegen einen leeren ` +
        "Abschnitt prueft nichts — die Aussagen gehoeren unter die Ueberschrift, nicht in " +
        "eine Untersektion oder einen Beispielblock.",
    );
  }
  return prose;
}

/** Ganzes Wort, aber nicht zeichen-pingelig: `pass`-Meldung zaehlt, `passieren` nicht. */
function mentions(section: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`).test(section);
}

describe("AGENTS.md ueber die Abbruchgruende des Gates", () => {
  const section = ciGatesSection(AGENTS, "AGENTS.md").toLowerCase();

  it("nennt im Abschnitt 'CI-Gates' jede Fehlerklasse, die das Gate wirklich hat", () => {
    const missing = DOC_DEMANDS.filter((d) => !d.names.some((w) => mentions(section, w)));
    expect(
      missing.map((d) => `${d.names[0]} (aus \`${d.operand}\`)`),
      "AGENTS.md, Abschnitt 'CI-Gates' nennt diese Abbruchgruende des Gates nicht, obwohl " +
        `\`generateSupport()\` sie in \`hasGap\` fuehrt${ERHEBUNG}`,
    ).toEqual([]);
  });

  it("traegt die gemessene Aussage — nicht nur das Stichwort", () => {
    // Haelfte B. Die Nennung allein ist fail-open: „a11y" an die Befehlszeile
    // angehaengt lief 8/8 gruen, und „Die `a11y`-Achse ist rein informativ und bricht
    // das Gate nicht" ebenfalls. Beide nennen das Wort und sagen dem Leser nichts.
    // Verlangt sind deshalb die Statuswoerter, die der Generator an dieser Achse
    // WIRKLICH emittiert — hier gemessen, nicht getippt. Ein Text ohne beide ist nicht
    // von diesem Gegensatz; ein Text mit beiden ist es mindestens.
    const gaps = DEMANDING.map((d) => ({
      operand: d.operand,
      missing: d.required.filter((w) => !mentions(section, w)),
    })).filter((g) => g.missing.length > 0);
    expect(
      gaps.map((g) => `\`${g.operand}\`: ${g.missing.map((w) => `es fehlt „${w}"`).join("; ")}`),
      "AGENTS.md, Abschnitt 'CI-Gates' nennt die Statuswoerter nicht, die der Generator an " +
        "dieser Achse wirklich emittiert. Das Stichwort allein genuegt nicht — es steht auch " +
        "in einer Befehlszeile und in einer Aussage, die das Gegenteil behauptet. Der " +
        "Abschnitt muss sagen, WORAN der Leser die Klasse im Report erkennt: an welchem " +
        "Status sie bestanden ist und an welchem nicht." +
        `${ERHEBUNG}`,
    ).toEqual([]);
  });
});
