// Ratsche gegen Doku, die die Prüftiefe der `honors`-Achse breiter behauptet, als der
// Generator sie einlöst.
//
// ══ Der Fehler, gegen den sie steht
//
// AGENTS.md sagte über die `honors`-Achse als GANZE:
//
//   „Die `honors`-Achse mountet die Seite mit Vue in ein echtes DOM und feuert echte
//    Klicks."
//
// Gemessen wird so aber genau EIN Token. `checkHonors` prüft jedes deklarierte Token
// gegen das Vertrags-Vokabular (`contract.schema.json → layoutHonors`, heute acht
// Token) — das ist eine Tippfehler-Sperre, kein Verhaltensnachweis. Gemountet und
// geklickt wird nur für `link`. Für `order`, `grouping`, `role`, `position`, `nav`,
// `layers` und `popup` mountet der Lauf nichts, rendert nichts und klickt nichts.
//
// Das ist keine Wortklauberei, sondern eine falsche Zusage an den Skin-Autor: wer
// `honors: ["layers"]` deklariert und einen sauberen Report sieht, glaubt nach diesem
// Satz, sein Layer-Verhalten sei ausgeführt worden. Es wurde nur sein Wörterbuch
// geprüft.
//
// ══ Was erhoben wird — und warum das keine Liste in dieser Datei ist
//
// Zwei Mengen, beide bei jedem Lauf aus dem Repo:
//
//   VOKABULAR — `layoutHonors` aus `contract.schema.json`. Nicht aus einer Kopie hier
//   und auch nicht aus einem Pfad-Literal: aufgelöst wird über `createRequire` von der
//   Generator-Datei aus, also über exakt denselben `@obs/visu-contract`-Link, den der
//   Generator selbst benutzt. Hängt jemand den Vertrag per `scripts/contract-link.sh`
//   um, misst diese Ratsche gegen denselben Vertrag wie das Gate.
//
//   VERHALTENSGEPRÜFT — die Token, für die `checkHonors` einen Zweig hat, DER WIRKLICH
//   MOUNTET. Geprüft wird zweierlei zusammen: das Token steht als String-Literal in der
//   BEDINGUNG eines `if`, UND irgendwo in dieser `if`/`else`-Kette wird eine Funktion
//   gerufen, deren eigener Rumpf `.mount(` enthält. Heute trifft das auf
//   `declared.includes("link")` mitsamt der Gegenrichtung im `else` zu — und auf sonst
//   nichts.
//
// Warum es diese engere Fassung ist und nicht „das Token steht irgendwo im Rumpf":
// letztere hebt ein versprengtes `"nav"` in einem `findings.push({ token: "nav" })`
// still zu „verhaltensgeprüft" — und verlangte dann von der Doku eine FALSCHAUSSAGE.
// Ein Zweig ohne Mount zählt umgekehrt nicht.
//
// Die Grenze ist benannt, nicht verschwiegen: wird die Zuordnung morgen über ein
// `switch (token)` oder eine Tabelle AUSSERHALB der Funktion geschrieben, sieht der
// Scanner sie nicht mehr. Dann ist die erhobene Menge LEER — und der Erhebungs-Test
// unten wird rot, statt still grün zu bleiben.
//
// Das geschärfte Prädikat (Bedingung + Mount) ist gegen synthetische Generator-Rümpfe
// gefahren — wortgleiche Portierung der Erhebung, damit der echte Generator dafür nicht
// angefasst werden muss:
//   • Rumpf, der nur `findings.push({ token: "link" })` tut, ohne Probelauf → LEER
//   • versprengtes `"nav"` in einem `findings.push` neben dem link-Zweig → weiter nur
//     `link`
//   • Zuordnung über eine Tabelle ausserhalb der Funktion → LEER
//   • `switch (…) { case "link": … }` statt `if` → LEER
//   • Zweig, der eine Hilfsfunktion OHNE `.mount(` ruft → LEER
//   • zweiter Probelauf für `nav` → `nav, link` (die Doku-Ratsche zieht mit)
// LEER heisst dabei immer: der Erhebungs-Test wird rot, nicht still grün.
//
// ══ Was am Text geprüft wird
//
// Erhoben werden alle BLÖCKE von AGENTS.md (Aufzählungspunkt oder Absatz), in denen
// `honors` vorkommt — nicht ein Abschnitt mit festem Titel und keine Zeilennummer,
// damit der Wächter eine Umsortierung der Datei überlebt. Fällt die Blockmenge leer
// aus, ist das ein Befund und kein grüner Lauf.
//
// Darin gilt:
//
//   • Jedes Token des Vertrags-Vokabulars muss vorkommen. Ein neues Token im Vertrag
//     zwingt die Doku so zum Nachziehen — genau der Fall „neues honors-Token".
//   • Kein Wort in Backticks, das wie ein Bezeichner aussieht, darf im Quelltext unter
//     `packages/` fehlen. Ein erfundenes `deeplink` fällt damit auf, obwohl es kein
//     Vertrags-Token ist und die Token-Prüfungen es nie zu sehen bekämen.
//   • Jede Mengenangabe vor „Token" (Zahlwort ODER Ziffer) muss einer der drei
//     erhobenen Mengen entsprechen: verhaltensgeprüft, nur Vokabular, Vokabular gesamt.
//
// ══ Gegenproben (alle gefahren, echte Meldungen)
//
// 1–4 gegen eine Kopie der Doku unter `DOCS_ROOT`; 5 in einer Sandbox-Kopie des Repos.
//
// 1. `popup` aus der Aufzählung der nur-Vokabular-Token gestrichen →
//    AGENTS.md nennt diese honors-Token des Vertrags-Vokabulars nicht: popup
//    (verhaltensgeprüft: link · nur Vokabular: order, grouping, role, position, nav,
//    layers, popup).
//
// 2. Erfundenes Token `deeplink` in den honors-Block →
//    AGENTS.md nennt in den honors-Bloecken Woerter in Backticks, die im Quelltext unter
//    packages/ nicht vorkommen: deeplink.
//
// 3. „Die übrigen sieben Token" → „Die übrigen fünf Token" →
//    AGENTS.md beziffert die honors-Mengen falsch: „fünf Token“ (erhoben —
//    verhaltensgeprüft: 1 · nur Vokabular: 7 · Vokabular gesamt: 8)
//
// 4. In `AGENTS.md` jedes `honors` durch „Layout-Achse" ersetzt — die Erhebung wird leer
//    und meldet sich, statt still grün zu bleiben →
//    AGENTS.md: kein Aufzählungspunkt und kein Absatz handelt von `honors`. Die Achse ist
//    die zentrale gemessene Eigenschaft dieses Repos — steht sie nicht mehr da, ist das
//    ein Befund, kein grüner Lauf.
//
// 5. In der Sandbox dem link-Probelauf den `app.mount(container)` genommen →
//    packages/tooling/conformance/index.ts: 'checkHonors' ruft keine Funktion, die in ein
//    Dokument mountet. Die Doku behauptet für die honors-Achse echtes DOM und echte Klicks
//    — ohne Mount ist schon diese Zusage stehengeblieben, nicht erst ihre Reichweite.
//
// ══ Was diese Ratsche NICHT prüft
//
// **Ob ein Satz Ausführung über die richtige Reichweite behauptet.** Die Vorfassung
// hatte dafür fünf satzweise Prüfungen, gebaut aus vier Wortlisten: Ausführungsverben
// (mountet · DOM · Klick · rendert · feuert), Ganzheits-Marker („die Achse", „jedes
// Token"), Begrenzungswörter (genau · nur · ausschliesslich · lediglich) und
// Nicht-Messungs-Wörter (nie · nicht · kein · ungemessen). Alle fünf sind gefallen. Was
// an ihnen nachweislich vorbeiging:
//
//   • „Die `honors`-Achse mountet … und feuert echte Klicks (Achse `link`
//     eingeschlossen)." — ein Klammerzusatz, der nichts begrenzt, aber wie eine
//     Begrenzung aussieht. Genau daran ist die ERSTE Fassung gescheitert; die zweite
//     fing ihn, und die dritte Mutationsrunde fand die nächsten:
//   • Plural statt Singular, Synonym statt Verb aus der Liste („die Seite wird
//     hochgezogen", „ein echter Zeiger geht darauf nieder").
//   • Dieselbe Aussage als TABELLE statt als Satz — Satzzerlegung findet dort keine
//     Sätze, und eine Tabellenzeile ohne das Wort `honors` fällt sogar aus der
//     Blockmenge heraus.
//   • Zwei Sätze statt einem: Ausführungsverb im ersten, Token im zweiten.
//   • Doppelte Verneinung („nicht so, dass nichts gemessen würde").
//
// Das ist keine Reihe behebbarer Lücken, sondern die Eigenschaft von Prosa: sie hat eine
// unbegrenzte Formenvielfalt, und ein Wächter über Aussagen darin hat dieselbe
// unbegrenzte Fehlerfläche. Er ist dann schlimmer als keiner, weil er Vertrauen erzeugt,
// das er nicht deckt. Die Reichweite der Aussage gehört ins Review.
//
// **Ob ein genanntes Token an der RICHTIGEN Stelle steht.** Dass `link` in einem
// Ausführungs-Block und `layers` in einem Vokabular-Block steht, ist eine Zuordnung in
// Prosa. Geprüft wird nur noch, DASS jedes Token vorkommt.
//
// **Eine Menge ohne Zahl.** Streicht jemand jede Zahlenangabe, ist die Bezifferung grün.
// Und die Zahl wird nur gegen die drei erhobenen Mengen gehalten, nicht mehr gegen die
// im selben Satz genannten Token: „acht Token" statt „sieben Token" bleibt damit grün,
// weil 8 die Grösse des Vokabulars ist. Was trägt, ist der Fall, gegen den die Prüfung
// steht — ein neuntes Vertrags-Token macht jede der drei Zahlen falsch.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FENCE_LINE, stepFence, type Fence } from "./markdown.js";

/** Wurzel des Workspace (packages/tooling/docs-guard/tests → 4 Ebenen hoch). */
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Wurzel der DOKU. Überschreibbar, damit ein Korrekturvorschlag gegen eine Kopie
 * geprüft werden kann, ohne die gemeinsam bearbeiteten Dateien im Repo anzufassen.
 * Der CODE kommt immer aus `ROOT` — sonst misst die Ratsche eine Kopie gegen eine
 * Kopie.
 */
const DOCS_ROOT = process.env.DOCS_ROOT ?? ROOT;

const readRepo = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");
const AGENTS = readFileSync(join(DOCS_ROOT, "AGENTS.md"), "utf8");

/** Alle von Git verfolgten Dateien unter `packages/`, repo-relativ. */
const TRACKED: readonly string[] = execFileSync("git", ["ls-files", "-z", "--", "packages"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean);

// ───────────────────────────── Quelltext-Scanner ─────────────────────────────

interface StringLiteral {
  readonly start: number;
  readonly value: string;
}

interface Scanned {
  /** Gleich lang wie die Quelle; Kommentare und String-INHALTE sind Leerzeichen. */
  readonly code: string;
  readonly literals: readonly StringLiteral[];
}

/**
 * Bleicht Kommentare und String-Inhalte aus, LÄNGENTREU.
 *
 * Längentreu, weil danach über Indizes weitergearbeitet wird (Klammer-Matching,
 * Rumpf-Ausschnitt). Und überhaupt nötig, weil beides sonst mitzählt: die deutschen
 * Kommentare in `index.ts` nennen `link` mehrfach, und ein Template-Literal wie
 * `${LAYOUT_HONORS.join(" · ")}` brächte fremde Anführungszeichen und Klammern in die
 * Zählung.
 *
 * Regex-Literale versteht der Scanner NICHT als solche. Enthält eines ein
 * Anführungszeichen, verrutscht ab dort die Zählung — dann fliegt beim Klammer-Matching
 * ein Fehler, der Datei, Zeile und Ursache nennt. Laut, nicht still.
 */
function scan(src: string): Scanned {
  const out: string[] = [];
  const literals: StringLiteral[] = [];
  const blank = (text: string): string => text.replace(/[^\n]/g, " ");
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      const stop = end === -1 ? src.length : end;
      out.push(blank(src.slice(i, stop)));
      i = stop;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out.push(blank(src.slice(i, stop)));
      i = stop;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const start = i;
      let value = "";
      i++;
      while (i < src.length) {
        const ch = src[i] as string;
        if (ch === "\\") {
          value += src[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (ch === c) {
          i++;
          break;
        }
        value += ch;
        i++;
      }
      literals.push({ start, value });
      out.push(blank(src.slice(start, i)));
      continue;
    }
    out.push(c);
    i++;
  }
  return { code: out.join(""), literals };
}

/** Findet zur öffnenden Klammer an `open` die zugehörige schliessende. */
function matchBracket(code: string, open: number, where: string): number {
  const pairs: Readonly<Record<string, string>> = { "(": ")", "{": "}", "[": "]" };
  const opener = code[open] as string;
  const closer = pairs[opener] as string;
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i] as string;
    if (c === opener) depth++;
    else if (c === closer) {
      depth--;
      if (depth === 0) return i;
    }
  }
  const line = code.slice(0, open).split("\n").length;
  throw new Error(
    `${where}: unbalanciertes '${opener}' ab Zeile ${line} (Position ${open}). Der ` +
      `Mini-Scanner dieser Spec kennt keine Regex-Literale — steht dort eines mit einem ` +
      `Anführungszeichen oder einer Klammer darin, verrutscht ab da die Zählung.`,
  );
}

/** Rumpf einer benannten Funktion `function <name>(…) { … }`, oder `null`. */
function functionBody(
  scanned: Scanned,
  name: string,
  where: string,
): { start: number; end: number } | null {
  const decl = new RegExp(`\\bfunction\\s+${name}\\s*\\(`).exec(scanned.code);
  if (!decl) return null;
  const paren = scanned.code.indexOf("(", decl.index);
  const brace = scanned.code.indexOf("{", matchBracket(scanned.code, paren, where));
  if (brace === -1) return null;
  return { start: brace, end: matchBracket(scanned.code, brace, where) };
}

// ───────────────────────────── Erhebung aus dem Repo ─────────────────────────────

/** Die eine verfolgte Datei, die `checkHonors` definiert. */
const GENERATOR: string = (() => {
  const hits = TRACKED.filter(
    (p) => p.endsWith(".ts") && /\bfunction\s+checkHonors\s*\(/.test(scan(readRepo(p)).code),
  );
  if (hits.length !== 1) {
    throw new Error(
      `Erwartet: genau eine verfolgte Datei mit 'function checkHonors(' — gefunden: ` +
        `${hits.join(", ") || "keine"}. Diese Ratsche misst die Prüftiefe der honors-Achse; ` +
        `ohne eindeutige Fundstelle misst sie nichts.`,
    );
  }
  return hits[0] as string;
})();

const SCANNED = scan(readRepo(GENERATOR));

/**
 * Das anerkannte `honors`-Vokabular — aus dem Vertrag, über denselben Paket-Link, den
 * der Generator benutzt (Auflösung von der Generator-Datei aus).
 */
const LAYOUT_HONORS: readonly string[] = (() => {
  const requireFromGenerator = createRequire(join(ROOT, GENERATOR));
  const schemaPath = requireFromGenerator.resolve("@obs/visu-contract/contract.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as { layoutHonors?: unknown };
  const honors = schema.layoutHonors;
  if (!Array.isArray(honors) || honors.some((t) => typeof t !== "string")) {
    throw new Error(
      `${schemaPath}: 'layoutHonors' ist keine String-Liste. Genau daraus zieht der ` +
        `Generator sein Vokabular (LAYOUT_HONORS) — ohne sie prüft diese Ratsche nichts.`,
    );
  }
  return Object.freeze(honors as string[]);
})();

const CHECK_HONORS_BODY = (() => {
  const body = functionBody(SCANNED, "checkHonors", GENERATOR);
  if (!body) throw new Error(`${GENERATOR}: Rumpf von 'checkHonors' nicht auffindbar.`);
  return body;
})();

/** Funktionen, die `checkHonors` ruft und die in ihrem eigenen Rumpf `.mount(` haben. */
const MOUNTING_HELPERS: readonly string[] = (() => {
  const body = SCANNED.code.slice(CHECK_HONORS_BODY.start, CHECK_HONORS_BODY.end);
  const called = new Set(
    [...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1] as string),
  );
  return [...called].filter((name) => {
    const helper = functionBody(SCANNED, name, GENERATOR);
    if (!helper) return false;
    return /\.mount\s*\(/.test(SCANNED.code.slice(helper.start, helper.end));
  });
})();

interface IfChain {
  /** Klammern der Bedingung. */
  readonly condStart: number;
  readonly condEnd: number;
  /** Von `if` bis zum Ende der gesamten `if`/`else if`/`else`-Kette. */
  readonly start: number;
  readonly end: number;
}

/** Alle `if`-Ketten in einem Bereich des ausgebleichten Quelltextes. */
function ifChains(code: string, from: number, to: number, where: string): IfChain[] {
  const chains: IfChain[] = [];
  for (const m of code.slice(from, to).matchAll(/\bif\s*\(/g)) {
    const start = from + (m.index as number);
    const paren = code.indexOf("(", start);
    const condEnd = matchBracket(code, paren, where);
    let i = condEnd + 1;
    for (;;) {
      while (i < code.length && /\s/.test(code[i] as string)) i++;
      if (code[i] === "{") {
        i = matchBracket(code, i, where) + 1;
      } else {
        const semi = code.indexOf(";", i);
        i = semi === -1 ? code.length : semi + 1;
      }
      let j = i;
      while (j < code.length && /\s/.test(code[j] as string)) j++;
      if (!/^else\b/.test(code.slice(j, j + 5))) break;
      j += 4;
      while (j < code.length && /\s/.test(code[j] as string)) j++;
      if (/^if\s*\(/.test(code.slice(j, j + 8))) {
        const p = code.indexOf("(", j);
        i = matchBracket(code, p, where) + 1;
        continue;
      }
      i = j;
    }
    chains.push({ condStart: paren, condEnd, start, end: i });
  }
  return chains;
}

const CHAINS = ifChains(SCANNED.code, CHECK_HONORS_BODY.start, CHECK_HONORS_BODY.end, GENERATOR);

/**
 * Die verhaltensgeprüften Token: Token in einer `if`-BEDINGUNG, deren Kette eine
 * mountende Hilfsfunktion ruft.
 *
 * Nicht „steht irgendwo im Rumpf": ein `findings.push({ token: "nav" })` machte `nav`
 * sonst still zu einem Token mit Probelauf — und die Doku damit zur Lügnerin.
 */
const PROBED: readonly string[] = LAYOUT_HONORS.filter((token) =>
  CHAINS.some((chain) => {
    const inCondition = SCANNED.literals.some(
      (l) => l.start > chain.condStart && l.start < chain.condEnd && l.value === token,
    );
    if (!inCondition) return false;
    const region = SCANNED.code.slice(chain.start, chain.end);
    return MOUNTING_HELPERS.some((helper) => new RegExp(`\\b${helper}\\s*\\(`).test(region));
  }),
);

const VOCAB_ONLY: readonly string[] = LAYOUT_HONORS.filter((t) => !PROBED.includes(t));

/** Kommt das Wort im verfolgten Quelltext unter `packages/` überhaupt vor? */
const knownInCode = (word: string): boolean =>
  spawnSync(
    "git",
    [
      "grep",
      "--quiet",
      "--fixed-strings",
      "--word-regexp",
      "-e",
      word,
      "--",
      "packages",
      ":(exclude)packages/tooling/docs-guard",
    ],
    { cwd: ROOT },
  ).status === 0;

// ───────────────────────────── Erhebung aus der Doku ─────────────────────────────

/**
 * Blöcke eines Markdown-Textes: jeder Aufzählungspunkt und jeder Absatz für sich,
 * Fortsetzungszeilen eingeschlossen.
 *
 * Absätze zählen mit, weil eine Falschaussage sonst nur eine Zeile Prosa vom Wächter
 * entfernt wäre. Die Fence-Buchhaltung kommt aus `markdown.ts` und kennt ``` wie ~~~ —
 * eine `# `-Zeile in einem `~~~`-Block ist damit keine Überschrift mehr.
 */
function blocks(md: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let fence: Fence | null = null;
  const flush = (): void => {
    if (current.length) out.push(current.join("\n"));
    current = [];
  };
  for (const line of md.split("\n")) {
    if (FENCE_LINE.test(line)) {
      fence = stepFence(line, fence);
      current.push(line);
      continue;
    }
    if (fence !== null) {
      current.push(line);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*[-*]\s+\S/.test(line) || /^#{1,6}\s/.test(line)) flush();
    current.push(line);
  }
  flush();
  return out;
}

/** Die Blöcke, die von der `honors`-Achse handeln. */
const HONORS_BLOCKS: readonly string[] = blocks(AGENTS).filter((b) => /honors/i.test(b));

/** Wörter in Backticks, die wie ein Bezeichner aussehen (`link`, nicht `support.json`). */
const backtickedWords = (s: string): string[] =>
  [...s.matchAll(/`([a-z][A-Za-z0-9]*)`/g)].map((m) => m[1] as string);

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  ein: 1,
  eine: 1,
  einen: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
};

/**
 * Mengenangabe vor „Token" — Zahlwort ODER Ziffer.
 *
 * `ein/eine/einen` zählt nur nach `genau`/`nur`/`lediglich` — sonst wäre jeder
 * unbestimmte Artikel („ein Token ohne Probelauf") eine Mengenangabe. Ziffern zählen
 * immer: „die übrigen 8 Token" ist genau dieselbe Behauptung wie „die übrigen acht".
 */
const COUNT_RE =
  /\b(?:(?:genau|nur|lediglich)\s+(ein|eine|einen)|(zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)|(\d+))\b(?:\s+[A-Za-zÄÖÜäöüß-]+)?\s+Tokens?\b/g;

// ───────────────────────────── Die Prüfungen ─────────────────────────────

describe("Erhebung (fällt sie aus, prüft der Rest nichts)", () => {
  it("kennt das honors-Vokabular des Vertrags", () => {
    expect(
      LAYOUT_HONORS.length,
      "Das Vertrags-Vokabular 'layoutHonors' ist leer — dann kann diese Ratsche weder " +
        "verhaltensgeprüfte noch nur geprüfte Token auseinanderhalten.",
    ).toBeGreaterThan(0);
  });

  it("belegt, dass checkHonors überhaupt in ein Dokument mountet", () => {
    expect(
      MOUNTING_HELPERS,
      `${GENERATOR}: 'checkHonors' ruft keine Funktion, die in ein Dokument mountet. Die ` +
        `Doku behauptet für die honors-Achse echtes DOM und echte Klicks — ohne Mount ist ` +
        `schon diese Zusage stehengeblieben, nicht erst ihre Reichweite.`,
    ).not.toEqual([]);
  });

  it("findet die Token, für die checkHonors einen mountenden Zweig hat", () => {
    expect(
      PROBED,
      `${GENERATOR}: kein Token des Vertrags-Vokabulars steht in der Bedingung eines 'if', ` +
        `dessen Kette eine mountende Hilfsfunktion ruft (${MOUNTING_HELPERS.join(", ")}). ` +
        `Entweder ist der token-spezifische Probelauf verschwunden (dann ist die DOM-Messung ` +
        `weg), oder die Zuordnung wurde umgebaut — etwa in ein 'switch' oder eine Tabelle ` +
        `ausserhalb der Funktion. Dann erhebt diese Ratsche die Prüftiefe nicht mehr und muss ` +
        `nachgezogen werden.`,
    ).not.toEqual([]);
  });

  it("findet die Doku-Stellen, die von der honors-Achse handeln", () => {
    expect(
      HONORS_BLOCKS.length,
      "AGENTS.md: kein Aufzählungspunkt und kein Absatz handelt von `honors`. Die Achse ist " +
        "die zentrale gemessene Eigenschaft dieses Repos — steht sie nicht mehr da, ist das " +
        "ein Befund, kein grüner Lauf. Achtung: auch eine Umformulierung, die das Wort " +
        "`honors` aus dem Absatz nimmt, schiebt ihn hier heraus.",
    ).toBeGreaterThan(0);
  });
});

describe("AGENTS.md über das honors-Vokabular", () => {
  it("nennt jedes Token des Vertrags-Vokabulars", () => {
    // Ein neues Vertrags-Token zwingt die Doku so zum Nachziehen — sonst liest sich
    // „die übrigen" weiter als die alte, kleinere Menge. Geprüft ist die MENGE, nicht
    // die Stelle: wo ein Token steht und was der Satz darum herum behauptet, prüft
    // diese Datei nicht mehr (siehe Kopf).
    const text = HONORS_BLOCKS.join("\n");
    const missing = LAYOUT_HONORS.filter(
      (t) => !new RegExp(`(?<![\\w-])${t}(?![\\w-])`).test(text),
    );
    expect(
      missing,
      `AGENTS.md nennt diese honors-Token des Vertrags-Vokabulars nicht: ${missing.join(", ")} ` +
        `(verhaltensgeprüft: ${PROBED.join(", ") || "keins"} · nur Vokabular: ` +
        `${VOCAB_ONLY.join(", ") || "keins"}).`,
    ).toEqual([]);
  });

  it("nennt nur Wörter in Backticks, die der Quelltext kennt", () => {
    // Ein erfundenes Token faellt den Token-Pruefungen nicht auf — es steht ja in keiner
    // Vertragsliste. Diese hier misst gegen den Quelltext unter `packages/`.
    const wrong = [
      ...new Set(
        HONORS_BLOCKS.flatMap(backtickedWords).filter(
          (w) => !LAYOUT_HONORS.includes(w) && !knownInCode(w),
        ),
      ),
    ];
    expect(
      wrong,
      "AGENTS.md nennt in den honors-Bloecken Woerter in Backticks, die im Quelltext unter " +
        `packages/ nicht vorkommen: ${wrong.join(", ")}.`,
    ).toEqual([]);
  });

  it("beziffert die Mengen richtig, wo sie sie beziffert", () => {
    // Nur gegen die drei ERHOBENEN Mengen, nicht mehr gegen die im selben Satz genannten
    // Token: die Satz-Kopplung war Prosa-Analyse und ist gefallen. Was bleibt, faellt bei
    // einem neunten Vertrags-Token — dann stimmt keine der drei Zahlen mehr.
    const allowed = new Set([PROBED.length, VOCAB_ONLY.length, LAYOUT_HONORS.length]);
    const wrong = [
      ...new Set(
        [...HONORS_BLOCKS.join("\n").replace(/\s+/g, " ").matchAll(COUNT_RE)]
          .filter((m) => {
            const word = (m[1] ?? m[2]) as string | undefined;
            const n = word ? (NUMBER_WORDS[word.toLowerCase()] as number) : Number(m[3]);
            return !allowed.has(n);
          })
          .map((m) => m[0].replace(/\s+/g, " ")),
      ),
    ];
    expect(
      wrong,
      `AGENTS.md beziffert die honors-Mengen falsch: ${wrong.map((w) => `„${w}“`).join(" · ")} ` +
        `(erhoben — verhaltensgeprüft: ${PROBED.length} · nur Vokabular: ${VOCAB_ONLY.length} · ` +
        `Vokabular gesamt: ${LAYOUT_HONORS.length})`,
    ).toEqual([]);
  });
});
