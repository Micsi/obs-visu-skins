// Ratsche gegen Doku, die die Abhängigkeitsgrenze zwischen Skin und Vertrag falsch zieht.
//
// ══ Die zwei Fehler, gegen die sie steht
//
//   1. `AGENTS.md` sagte über den Vertrag: „dieses Repo kennt es nur über einen Dev-Link,
//      nicht über eine Abhängigkeit im Code." Gemeint ist eine RICHTIGE Grenze — Skins
//      kennen den App-Code nie. Dagestanden hat aber eine falsche: sechs der sieben
//      Workspace-Pakete führen `@obs/visu-contract` in ihren `dependencies` und
//      importieren seine Typen quer durch die Renderer. Der Dev-Link ist der AUFLÖSUNGS-
//      weg dieser Abhängigkeit, nicht ihr Ersatz.
//
//   2. `README.md → „U2 — Paketname …"` versprach, das Repo referenziere den Paketnamen
//      „nur über eine einzige Konstante". Erhoben: der Name steht als Modulspezifizierer
//      in 68 Dateien, und `CONTRACT_PACKAGE` wird im ganzen Repo NIRGENDS gelesen. Wer
//      auf diese Zusage hin umbenennt, kalkuliert einen Ein-Zeilen-Wechsel und findet
//      ein repo-weites Suchen-und-Ersetzen.
//
// ══ Was erhoben wird — und warum nichts davon ein Literal ist
//
//   Der Paketname des Vertrags steht NICHT in dieser Datei. Er wird aus dem Repo gelesen,
//   und zwar aus genau der Stelle, die das README zur Einzelquelle erklärt: dem einen
//   exportierten `const`, dessen Wert wie ein npm-Paketname aussieht (`@scope/name`).
//   Findet die Ratsche keins oder mehrere, wirft sie — beides widerlegt die Zusage
//   „eine einzige Konstante" schon vor jeder Textprüfung. Gegengeprüft wird der Fund
//   zusätzlich an den `package.json`: der Name MUSS dort als Dependency-Key vorkommen,
//   sonst hat die Ratsche die falsche Konstante gegriffen und sagt das.
//
//   Daraus folgen drei Mengen, alle aus `git ls-files`:
//     • DEPENDENTS — verfolgte `packages/<gruppe>/<paket>/package.json`, die den Namen in
//       irgendeinem Dependency-Feld führen.  Heute 6 von 7.
//     • HARDCODED  — verfolgte Quelldateien unter `packages/`, die den Namen als
//       Modulspezifizierer ausschreiben (`from "…"`, `import(…)`, `require(…)`,
//       `vi.mock(…)`).  Ausgenommen sind die Definitionsdatei der Konstante und dieses
//       Doku-Guard-Paket selbst: Wächter ZITIEREN Import-Zeilen in ihren Kommentarköpfen,
//       benutzen sie aber nicht — sonst wüchse die Zahl im README mit den Wächtern statt
//       mit dem Code.  Heute 68 Dateien mit 82 Vorkommen in 6 Paketen.
//
//   `git ls-files` statt Verzeichnis-Walk ist Pflicht, nicht Geschmack: `create-skin`
//   scaffoldet während `pnpm -r test` transient ein Skin nach `packages/skins/` —
//   samt Renderer-Datei, die den Vertrag importiert. Ein Walk zählte je nach Zeitpunkt
//   68 oder 69, und diese Ratsche wäre ein Flake.
//
// ══ Was übrig bleibt: vier strukturelle Prüfungen
//
//   • Die Erhebung greift die richtige Konstante und findet den Namen im Code.
//   • `AGENTS.md` NENNT den erhobenen Paketnamen überhaupt.
//   • Jede Zahl, die der U2-Abschnitt vor „Dateien"/„Pakete" setzt, stimmt mit der
//     erhobenen Menge überein.
//   • Der U2-Abschnitt nennt die Datei, in der die Konstante steht.
//
// ══ Gegenproben (alle gefahren, echte Meldungen)
//
// 1–3 laufen gegen eine Kopie der Doku unter `DOCS_ROOT`; 4 braucht ein Repo und läuft
// in einer Sandbox-Kopie mit eigenem `git`-Index.
//
// 1. `@obs/visu-contract` in `AGENTS.md` durchgehend durch „den Vertrag" ersetzt →
//    AGENTS.md nennt den Paketnamen des Vertrags nirgends. Ein Agent liest dann nirgends,
//    dass es ihn gibt — und erst recht nicht, dass Vertragsänderungen ihn betreffen
//    (erhoben: 6 Pakete mit Dependency, 68 Dateien mit Import).: expected false to be true
//
// 2. Im U2-Text „erhoben sind 68 Dateien" auf „12 Dateien" gesetzt →
//    README.md, Abschnitt 'Paketname …': die Doku beziffert die Menge falsch (erhoben:
//    68 Dateien, 6 Pakete).: expected [ '12 Dateien' ] to deeply equal []
//
// 3. Den Pfad der Konstante aus dem U2-Abschnitt genommen („Ein Paket unter
//    `packages/tooling/` hält ihn als Konstante bereit") →
//    README.md, Abschnitt 'Paketname …' nennt packages/tooling/contract-ref/index.ts
//    nicht.
//
// 4. In der Sandbox `CONTRACT_PACKAGE` auf `"@obs/erfunden"` gesetzt — beide
//    Erhebungs-Wächter fallen, und zwar mit verschiedenen Meldungen →
//    Die gefundene Konstante CONTRACT_PACKAGE = "@obs/erfunden"
//    (packages/tooling/contract-ref/index.ts) kommt in keiner package.json als Dependency
//    vor. Dann misst diese Ratsche etwas anderes als den Vertrag — die Erhebung ist blind,
//    nicht die Doku sauber.
//    Keine Quelldatei unter packages/ importiert "@obs/erfunden". Entweder ist der
//    Vertragsbezug verschwunden, oder die Spezifizierer-Erhebung hier greift ins Leere.
//
// ══ Was diese Ratsche NICHT prüft
//
// **Ob ein deutscher Satz die Grenze richtig ZIEHT.** Die Vorfassung hatte dafür zwei
// Prüfungen, und beide sind gefallen:
//
//   • „kein Satz in AGENTS.md verneint eine Code-Abhängigkeit zum Vertrag" — gebaut aus
//     Satzzerlegung plus einer Muster-Familie aus Negations- und Abhängigkeitswörtern.
//     Sie fiel schon an der Zeilenbreite: die Doku bricht mitten im Satz um, und die
//     Muster liessen zwischen ihren Teilen kein `\n` zu; die Gegenprobe „alten
//     Falschsatz wiederherstellen" blieb GRÜN, sobald er auf zwei Zeilen passte.
//     Repariert war sie danach gegen die BEKANNTEN Formen — „ist von ihm nicht
//     abhängig", „hat keine Code-Abhängigkeit". Nicht gegen „der Vertrag ist hier
//     Beiwerk", „eingebunden wird nichts", „bringt nur Typen mit, sonst nichts".
//   • „der U2-Abschnitt führt die Einzelquellen-Zusage nur, solange sie stimmt" — drei
//     Regex-Familien gegen drei Formulierungen. Eine vierte („der Name wohnt an einer
//     Stelle") kannte keine davon.
//
// Beides ist Prosa-Analyse und damit per Umformulierung umgehbar. Was an ihre Stelle
// tritt, ist keine schwächere Heuristik, sondern dieser Absatz: die Aussage gehört ins
// Review. Die Zahlenprüfung darunter ist die wortlaut-unabhängige Hälfte und trägt
// weiter — sie fällt auch bei einer Neuformulierung, die kein Muster kennen konnte.
//
// **Eine Menge ohne Zahl.** Nennt der U2-Abschnitt gar keine Zahl mehr, ist die
// Bezifferung grün. Die Vorfassung hatte dagegen eine eigene Prüfung („beziffert
// überhaupt"), aber sie verlangte eine Schreibweise: Zahl plus eines der Nomen
// „Datei(en)"/„Paket(e)". „68 Quelldateien", „68 Stellen" oder „68×" liessen sie rot
// werden, obwohl der Text richtig ist — ein Wächter, der korrekte Doku rot macht, wird
// abgeschaltet, nicht befolgt.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { section } from "./markdown.js";

/** Wurzel des Workspace (packages/tooling/docs-guard/tests → 4 Ebenen hoch). */
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Wurzel, aus der die DOKU gelesen wird — überschreibbar.
 *
 * Der Repo-Teil (git ls-files, package.json, Quelldateien) kommt immer aus `ROOT`. Nur
 * `README.md`/`AGENTS.md` sind umlenkbar, damit sich ein Doku-Vorschlag in einer Kopie
 * nachweisen lässt, ohne die echten Dateien anzufassen.
 */
const DOCS_ROOT = process.env["DOCS_ROOT"] ?? ROOT;

const readRepo = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");
const readDoc = (rel: string): string => readFileSync(join(DOCS_ROOT, rel), "utf8");

const README = readDoc("README.md");
const AGENTS = readDoc("AGENTS.md");

/** Alle von Git verfolgten Dateien, repo-relativ. */
const TRACKED: readonly string[] = execFileSync("git", ["ls-files", "-z"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean);

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ───────────────────────────────────────────────────────────────────────────────
// Erhebung 1: die Konstante, die das README zur Einzelquelle erklärt
// ───────────────────────────────────────────────────────────────────────────────

interface ContractConst {
  readonly file: string;
  readonly name: string;
  readonly value: string;
}

/**
 * Der eine exportierte String-`const` unter `packages/`, dessen Wert wie ein npm-Scope-
 * Paketname aussieht.
 *
 * Absichtlich über die FORM des Werts gesucht statt über den Bezeichner: hiesse die
 * Konstante morgen `CONTRACT_PKG`, fände die Ratsche sie weiterhin. Und absichtlich
 * „genau einer": zwei solche Konstanten widerlegen die Zusage „eine einzige Konstante"
 * bereits, bevor irgendein Text geprüft wird.
 */
function findContractConst(): ContractConst {
  const re =
    /export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*"(@[a-z0-9._-]+\/[a-z0-9._-]+)"/g;
  const hits: ContractConst[] = [];
  for (const file of TRACKED.filter((p) => /^packages\/.+\.ts$/.test(p))) {
    for (const m of readRepo(file).matchAll(re)) {
      hits.push({ file, name: m[1] as string, value: m[2] as string });
    }
  }
  if (hits.length !== 1) {
    throw new Error(
      `Erwartet: genau eine exportierte Paketnamen-Konstante unter packages/. Gefunden: ` +
        `${hits.length} (${hits.map((h) => `${h.name} in ${h.file}`).join(", ") || "keine"}). ` +
        `Ohne sie kann diese Ratsche den Vertragsnamen nicht aus dem Repo erheben — und die ` +
        `README-Zusage „nur über eine einzige Konstante" ist damit ohnehin hinfällig.`,
    );
  }
  return hits[0] as ContractConst;
}

const CONTRACT = findContractConst();

// ───────────────────────────────────────────────────────────────────────────────
// Erhebung 2: wer den Vertrag als Dependency führt
// ───────────────────────────────────────────────────────────────────────────────

const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const PACKAGE_JSONS: readonly string[] = TRACKED.filter((p) =>
  /^packages\/[^/]+\/[^/]+\/package\.json$/.test(p),
).sort();

/** Repo-relative Verzeichnisse der Pakete, die den Vertrag in einem Dependency-Feld führen. */
const DEPENDENTS: readonly string[] = PACKAGE_JSONS.filter((p) => {
  const json = JSON.parse(readRepo(p)) as Record<string, Record<string, string> | undefined>;
  return DEP_FIELDS.some((f) => json[f]?.[CONTRACT.value] !== undefined);
}).map((p) => p.slice(0, p.lastIndexOf("/")));

// ───────────────────────────────────────────────────────────────────────────────
// Erhebung 3: wo der Name hartkodiert steht und ob die Konstante gelesen wird
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Dieses Paket selbst, aus dem eigenen Dateipfad abgeleitet — es REDET über den Vertrag,
 * es benutzt ihn nicht.
 *
 * Ohne diese Ausnahme zählte jede Doku-Ratsche, die eine Import-Zeile im Kommentarkopf
 * zitiert, als weitere „hartkodierte Stelle" mit — die Zahl im README wüchse mit den
 * Wächtern statt mit dem Code, und der nächste Spec-Kopf hier machte den README-Satz
 * still falsch.
 */
const SELF_PACKAGE = fileURLToPath(new URL("../", import.meta.url))
  .slice(ROOT.length)
  .split("\\")
  .join("/")
  .replace(/\/$/, "");

const SOURCE_FILES: readonly string[] = TRACKED.filter(
  (p) => /^packages\/.+\.(?:ts|tsx|js|mjs|cjs|vue)$/.test(p) && !p.startsWith(`${SELF_PACKAGE}/`),
).sort();

/**
 * Modulspezifizierer, die den Paketnamen ausschreiben — inklusive Subpfaden wie
 * `…/fixtures.json`. Verankert an `from` / `import` / `require` / `vi.mock`, damit blosse
 * Prosa-Erwähnungen in Kommentaren nicht mitzählen: die kosten bei einer Umbenennung
 * zwar auch eine Änderung, aber sie sind kein Code, und die Zusage handelt vom Code.
 */
const SPECIFIER_RE = new RegExp(
  `(?:from|import|require|vi\\.mock)\\s*\\(?\\s*["'\`]${escapeRe(CONTRACT.value)}(?:/[^"'\`]*)?["'\`]`,
);

const HARDCODED_FILES: readonly string[] = SOURCE_FILES.filter(
  (p) => p !== CONTRACT.file && SPECIFIER_RE.test(readRepo(p)),
);

const HARDCODED_PACKAGES: readonly string[] = [
  ...new Set(HARDCODED_FILES.map((p) => p.split("/").slice(0, 3).join("/"))),
].sort();

/** Pakete, die eine Umbenennung anfassen muss — Dependency-Eintrag oder Import oder beides. */
const RENAME_PACKAGES: readonly string[] = [
  ...new Set([...DEPENDENTS, ...HARDCODED_PACKAGES]),
].sort();

// ───────────────────────────────────────────────────────────────────────────────
// Prüfungen
// ───────────────────────────────────────────────────────────────────────────────

describe("Erhebung", () => {
  it("greift die richtige Konstante (ihr Wert ist ein echter Dependency-Key)", () => {
    expect(
      DEPENDENTS,
      `Die gefundene Konstante ${CONTRACT.name} = "${CONTRACT.value}" (${CONTRACT.file}) kommt ` +
        `in keiner package.json als Dependency vor. Dann misst diese Ratsche etwas anderes ` +
        `als den Vertrag — die Erhebung ist blind, nicht die Doku sauber.`,
    ).not.toEqual([]);
  });

  it("findet den Paketnamen überhaupt im Code (sonst prüft die Ratsche nichts)", () => {
    expect(
      HARDCODED_FILES.length,
      `Keine Quelldatei unter packages/ importiert "${CONTRACT.value}". Entweder ist der ` +
        `Vertragsbezug verschwunden, oder die Spezifizierer-Erhebung hier greift ins Leere.`,
    ).toBeGreaterThan(0);
  });
});

describe("AGENTS.md über die Grenze Skin ↔ Vertrag", () => {
  it("nennt den Paketnamen des Vertrags überhaupt", () => {
    // Was hier bleibt, ist der Namensbezug — nicht die Aussage darum herum. Verschwindet
    // der Name, steht in AGENTS.md gar nichts mehr über den Vertragsbezug, und ein Agent
    // vermutet ihn nicht einmal. Was der Satz um den Namen herum BEHAUPTET, prüft diese
    // Datei nicht mehr; die Begründung steht im Kopf.
    expect(
      AGENTS.includes(CONTRACT.value),
      `AGENTS.md nennt den Paketnamen des Vertrags nirgends. Ein Agent liest dann nirgends, ` +
        `dass es ihn gibt — und erst recht nicht, dass Vertragsänderungen ihn betreffen ` +
        `(erhoben: ${DEPENDENTS.length} Pakete mit Dependency, ${HARDCODED_FILES.length} ` +
        `Dateien mit Import).`,
    ).toBe(true);
  });
});

describe("README.md über den Paketnamen des Vertrags", () => {
  const LABEL = "README.md, Abschnitt 'Paketname …'";
  const SECTION = section(README, /^#{2,4}\s+.*\bPaketname\b/, "README.md");

  /** „68 Dateien", „sechs Pakete" — Zahl (Ziffer oder Wort) + optionales Füllwort + Nomen. */
  const COUNT_RE =
    /\b(\d+|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+(?:[A-Za-zÄÖÜäöüß-]+\s+){0,2}(Dateien|Datei|Pakete|Paketen|Paket)\b/g;

  const NUMBER_WORDS: Readonly<Record<string, number>> = {
    ein: 1,
    eine: 1,
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

  const counts = [...SECTION.replace(/\s+/g, " ").matchAll(COUNT_RE)].map((m) => {
    const raw = (m[1] as string).toLowerCase();
    const noun = (m[2] as string).toLowerCase();
    return {
      text: m[0].replace(/\s+/g, " "),
      value: NUMBER_WORDS[raw] ?? Number(raw),
      expected: noun.startsWith("datei") ? HARDCODED_FILES.length : RENAME_PACKAGES.length,
    };
  });

  const measured = `erhoben: ${HARDCODED_FILES.length} Dateien, ${RENAME_PACKAGES.length} Pakete`;

  it("beziffert die Menge, die eine Umbenennung berührt, richtig", () => {
    // Die wortlaut-unabhängige Hälfte: sie fällt, wenn das Repo weiterzieht und die Doku
    // stehenbleibt — unabhängig davon, wie der Satz um die Zahl herum formuliert ist.
    // GAR KEINE Zahl bleibt bewusst grün; dann behauptet der Text auch keine.
    const wrong = counts.filter((c) => c.value !== c.expected).map((c) => c.text);
    expect(wrong, `${LABEL}: die Doku beziffert die Menge falsch (${measured}).`).toEqual([]);
  });

  it("nennt die Datei, in der die Konstante steht", () => {
    // Sonst schickt der Abschnitt den Umbenenner auf die Suche nach einem Ort, den er
    // laut Text zuerst anfassen soll.
    expect(SECTION.replace(/\s+/g, " "), `${LABEL} nennt ${CONTRACT.file} nicht.`).toContain(
      CONTRACT.file,
    );
  });
});
