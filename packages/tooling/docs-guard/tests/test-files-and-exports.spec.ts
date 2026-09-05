// Ratsche gegen Doku, die die beim Contract-Bump rot werdenden Testdateien falsch
// aufzählt, falsch beziffert oder auf Pfade zeigt, die es nicht gibt.
//
// ══ Der Fehler, gegen den sie steht
//
// `README.md → „Contract-Bump …"` ist die Anleitung, an der ein Maintainer einen roten
// Lauf EINSTUFT: welche Dateien werden erwartbar rot, wie viele sind es, und wie
// verifiziert man den fehlenden Vertrags-Export. Jede dieser drei Angaben veraltet
// still, wenn das Repo weiterzieht:
//
//   • Eine fünfte Spec, die ein festgeschriebenes `targetsContract` gegen den Vertrag
//     hält, wird beim Bump rot — steht sie nicht in der Liste, sucht der Leser den
//     Fehler bei sich.
//   • Eine Datei, die in der Liste steht, beim Bump aber grün bleibt (weil ihr Manifest
//     erst im Test aus dem Vertrag entsteht), ist dieselbe Fehleinstufung in die andere
//     Richtung: ein ECHTER Fehler wird dem erwarteten Zwischenschritt zugeschlagen.
//   • „in einer der drei Dateien oben" bleibt stehen, während es vier sind.
//   • Ein frei erfundenes `./scripts/verify-contract-export.sh` macht aus der
//     Verifikation eine Behauptung.
//
// Nichts davon steht als Literal in dieser Datei. Erhoben wird aus dem Repo: alle von
// Git verfolgten `*.spec.ts` unter `packages/<gruppe>/<paket>/tests/`, gefiltert auf
// „misst `targetsContract` gegen `contractVersion`" UND „das gemessene Manifest ist
// eingecheckt und schreibt die Version als Literal fest".
//
// ══ Gegenproben (alle gefahren, echte Meldungen)
//
// 1–7 laufen gegen eine Kopie der (korrigierten) Doku unter `DOCS_ROOT`; 8 braucht ein
// Repo und läuft deshalb in einer Sandbox-Kopie mit eigenem `git`-Index.
//
// 1. `packages/skins/ionic/tests/smoke.spec.ts` aus der Aufzählung entfernt →
//    README.md, Abschnitt 'Contract-Bump …' nennt diese Testpfade nicht, obwohl sie beim
//    Contract-Bump rot werden: packages/skins/ionic/tests/smoke.spec.ts
//
// 2. `packages/tooling/create-skin/tests/scaffold.spec.ts` mit in die Liste genommen —
//    ein Spec, dessen Manifest erst im Test aus dem Vertrag entsteht →
//    README.md, Abschnitt 'Contract-Bump …' führt diese Testpfade als beim Bump rot auf,
//    obwohl sie grün bleiben: packages/tooling/create-skin/tests/scaffold.spec.ts. Rot
//    werden nur: …
//
// 3. „der vier Dateien oben" → „der drei Dateien oben" →
//    README.md, Abschnitt 'Contract-Bump …': die Doku beziffert die Dateimenge falsch,
//    erhoben sind 4: …: expected [ 'drei Dateien' ] to deeply equal []
//
// 4. Den Glob `packages/skins/*/tests/*.spec.ts` in den Abschnitt gesetzt →
//    README.md: der Glob 'packages/skins/*/tests/*.spec.ts' trifft nicht die Dateien, die
//    beim Contract-Bump rot werden.: expected [ …(22) ] to deeply equal [ …(4) ]
//
// 5. „Am schnellsten siehst du es in `smoke.spec.ts`." in den Abschnitt →
//    README.md nennt smoke.spec.ts ohne Pfad, obwohl die Assertion in 4 verschieden
//    benannten Dateien steht (…).
//
// 6. Im Kommandoblock `./scripts/contract-link.sh` durch einen Platzhalter ersetzt →
//    README.md, Abschnitt 'Contract-Bump …': der Verifikationsschritt nennt kein
//    ausführbares Skript aus scripts/ (gefunden: keins). Ohne einen real fahrbaren Weg
//    bleibt 'fehlender Export = erwartet' eine Behauptung.
//
// 7. Ein frei erfundenes `./scripts/verify-contract-export.sh` in den Kommandoblock —
//    genau die `./`-Schreibweise, die das alte Lookbehind `(?<![\w/.-])` durchliess →
//    README.md, Abschnitt 'Contract-Bump …' nennt nicht existierende Pfade:
//    scripts/verify-contract-export.sh
//
// 8. In der Sandbox `contractVersion` in allen vier roten Specs umbenannt →
//    Keine Spec hält ein festgeschriebenes `targetsContract` gegen `contractVersion` —
//    entweder ist die Assertion verschwunden (dann ist der Bump-Schutz weg) oder die
//    Erhebung hier ist blind.: expected 0 to be greater than 0
//
// ══ Was diese Ratsche NICHT prüft
//
// **Ob die Diagnose-Anleitung sachlich RICHTIG erklärt, warum es rot ist.** Der
// Abschnitt darf jede Kausalität behaupten, solange die Pfade existieren, die Menge
// stimmt und die Zahl passt. Der Grund ist nicht Bequemlichkeit: die Erklärung steht in
// deutscher Prosa, und Prosa hat eine unbegrenzte Formenvielfalt. Die Vorfassungen
// dieses Pakets haben das durchgemessen — ein Klammerzusatz („(Achse `link`
// eingeschlossen)"), ein Synonym statt des Verbs aus der Liste, ein Nebensatz, der den
// richtigen Schritt mit-nennt, eine Tabelle statt eines Satzes: jedes Mal blieb der
// Wächter grün, ohne dass sich an der Falschaussage etwas geändert hätte. Ein Wächter
// mit dieser Fehlerfläche ist schlimmer als keiner, weil er Vertrauen erzeugt, das er
// nicht deckt. Dafür gibt es das Review.
//
// **Eine Menge ohne Zahl.** Nennt der Abschnitt gar keine Zahl, ist die
// Bezifferungs-Prüfung grün — dann behauptet der Text auch keine. Wer „die Dateien
// oben" schreibt statt „die vier Dateien oben", entkommt ihr; wer „vier Orte" statt
// „vier Dateien" schreibt ebenso, denn das Nomen muss die erhobene Dateimenge benennen
// (Stamm: datei/pfad/spec/test/file). Die Aufzählungs-Prüfungen darüber tragen diesen
// Fall: eine fehlende oder überzählige Datei fällt dort auf, unabhängig von jeder Zahl.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { codeBlocks, section } from "./markdown.js";

/** Wurzel des Workspace (packages/tooling/docs-guard/tests → 4 Ebenen hoch). */
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Wurzel, unter der die DOKUMENTE gelesen werden — der Notausgang, den die übrigen
 * sechs Specs dieses Pakets schon haben und der hier als einzigem fehlte.
 *
 * Ohne ihn liess sich ein Korrekturvorschlag nicht gegenproben, ohne `README.md` im
 * geteilten Worktree anzufassen, an dem gleichzeitig andere arbeiten. Nur die Doku
 * wandert mit: `git ls-files`, die Manifeste und die Existenzprüfung der genannten
 * Pfade fragen immer das ECHTE Repo. Sonst liesse sich mit einer Doku-Kopie auch
 * gleich ein passendes Repo dazu erfinden. `tests/docs-root-guard.spec.ts` erhebt
 * selbst, wer den Notausgang liest, und verbietet ihn in CI-Läufen.
 */
const DOCS_ROOT = process.env.DOCS_ROOT ?? ROOT;

const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");
const readDoc = (rel: string): string => readFileSync(join(DOCS_ROOT, rel), "utf8");
const toPosix = (p: string): string => p.split("\\").join("/");

const README = readDoc("README.md");
const AGENTS = readDoc("AGENTS.md");

/** Alle von Git verfolgten Dateien unter `packages/`, repo-relativ. */
const TRACKED: readonly string[] = execFileSync("git", ["ls-files", "-z", "--", "packages"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean);

/** Jede verfolgte `*.spec.ts` unter `packages/<gruppe>/<paket>/tests/`, sortiert. */
const SPEC_FILES: readonly string[] = TRACKED.filter((p) =>
  /^packages\/[^/]+\/[^/]+\/tests\/.+\.spec\.ts$/.test(p),
).sort();

/** Paketname → repo-relatives Verzeichnis, aus den `package.json` des Workspace. */
const WORKSPACE: ReadonlyMap<string, string> = new Map(
  TRACKED.filter((p) => /^packages\/[^/]+\/[^/]+\/package\.json$/.test(p)).flatMap((p) => {
    const name = (JSON.parse(read(p)) as { name?: string }).name;
    return name ? [[name, p.slice(0, p.lastIndexOf("/"))] as [string, string]] : [];
  }),
);

/**
 * Löst eine im Spec vorkommende Pfad-/Modulangabe auf einen repo-relativen Pfad auf —
 * oder auf `null`, wenn sie nicht auf eine Datei IM REPO zeigt.
 *
 * Genau dieses `null` trennt die beiden Fälle: `import manifest from "../manifest.json"`
 * (eingecheckt, festgeschrieben) von `join(tmpDir, "manifest.json")` (erst im Test
 * erzeugt, aus dem Vertrag abgeleitet).
 */
function resolveRef(specFile: string, ref: string): string | null {
  if (ref.startsWith("./") || ref.startsWith("../")) {
    return toPosix(normalize(join(dirname(specFile), ref)));
  }
  for (const [name, dir] of WORKSPACE) {
    if (ref.startsWith(`${name}/`)) return `${dir}/${ref.slice(name.length + 1)}`;
  }
  return ref.startsWith("packages/") ? ref : null;
}

/**
 * Die eingecheckten `manifest.json`, die diese Spec-Datei erreicht und die ihr
 * `targetsContract` als LITERAL festschreiben. Ein solches Literal ist die Ursache des
 * roten Laufs: der Vertrag zieht weiter, das Literal bleibt stehen.
 */
function pinnedManifests(specFile: string, src: string): string[] {
  const refs = new Set(
    [...src.matchAll(/["'`]([^"'`\n]*manifest\.json)["'`]/g)].map((m) => m[1] as string),
  );
  const out: string[] = [];
  for (const ref of refs) {
    const rel = resolveRef(specFile, ref);
    if (!rel || !existsSync(join(ROOT, rel))) continue;
    const pinned = (JSON.parse(read(rel)) as { targetsContract?: unknown }).targetsContract;
    if (typeof pinned === "string") out.push(rel);
  }
  return out;
}

/**
 * Misst die Datei die Vertragsversion des Manifests gegen den Vertrag selbst?
 *
 * Bewusst zwei lose Signale statt einer Regex auf die heutige Schreibweise
 * `expect(m.targetsContract).toBe(contractVersion)`: wer die Assertion morgen mit
 * `assert.equal` oder über eine Hilfsfunktion schreibt, wird trotzdem erfasst. Die
 * Ratsche irrt damit in Richtung „mehr dokumentieren", nie in Richtung „übersehen".
 */
const measuresContractVersion = (src: string): boolean =>
  /\.targetsContract\b/.test(src) && /\bcontractVersion\b/.test(src);

/** Die Dateien, die beim Contract-Bump tatsächlich rot werden. */
const RED_ON_BUMP: readonly string[] = SPEC_FILES.filter((p) => {
  const src = read(p);
  return measuresContractVersion(src) && pinnedManifests(p, src).length > 0;
});

/** Basenamen dieser Dateien — heute vier verschiedene, genau darum der Befund. */
const RED_BASENAMES = [...new Set(RED_ON_BUMP.map((p) => p.slice(p.lastIndexOf("/") + 1)))];

/** Deutsche Zahlwörter, wie die Doku sie schreibt. */
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

/**
 * „der drei Dateien oben", „die vier aktuellen Pfade", „in einer der 3 Spec-Files":
 * Zahl + optionales Adjektiv + ein Nomen, das die erhobene Dateimenge benennt.
 *
 * Zwei Verengungen der Vorfassung liessen die Prüfung still abschalten, und in beiden
 * Fällen stand danach eine FALSCHE, prüfbare Zahl im Text, ohne dass hier etwas fiel:
 *
 *   - Nur ausgeschriebene Zahlwörter. „in einer der 3 Dateien oben" lieferte keinen
 *     Treffer, `matchAll` war leer, und eine Prüfung über der leeren Menge ist wahr.
 *     Darum jetzt auch Ziffern.
 *   - Eine feste Nomen-Liste. „in einer der drei Spec-Files oben" stand nicht darin
 *     und ging durch. Statt die Liste zu verlängern (die nächste Schreibweise fehlte
 *     wieder), wird das Nomen an einem STAMM erkannt: es muss Dateien, Pfade, Specs
 *     oder Tests benennen. Damit sind „Testdateien", „Spec-Files" und „Testpfade"
 *     miterfasst, „die vier Gates" dagegen nicht — das ist keine Aussage über die
 *     erhobene Dateimenge.
 *
 * GAR KEINE Zahl bleibt bewusst grün: dann behauptet der Text auch keine.
 */
const COUNT_RE =
  /\b(\d{1,3}|ein|eine|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\b(?:\s+[A-Za-zÄÖÜäöüß-]+)?\s+([A-Za-zÄÖÜäöüß-]*(?:datei|pfad|spec|test|file)[A-Za-zÄÖÜäöüß-]*)\b/gi;

/** Ziffer oder Zahlwort → Zahl; `null`, wenn es keins von beiden ist. */
function countValue(token: string): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token.toLowerCase()] ?? null;
}

/**
 * Ein Repo-Pfad, wie die Doku ihn schreibt — mit oder ohne führendes `./`.
 *
 * Das `(?:\.\/)?` ist nicht Kosmetik. Die Vorfassung hatte nur das Lookbehind
 * `(?<![\w/.-])`, und vor `scripts` in `./scripts/…` steht ein `/`: die Schreibweise,
 * die der Abschnitt SELBST für seinen Kommandoblock benutzt, war damit von der
 * Existenzprüfung ausgenommen. Ein frei erfundenes `./scripts/check-export.sh` oder
 * ein `- ./packages/skins/gibtsnicht/tests/nope.spec.ts` in der Pfadliste ging glatt
 * durch — genau der Rückfall, gegen den dieser Block antritt.
 *
 * Das Lookbehind bleibt: ohne es würde `packages/…` auch mitten aus einer längeren
 * URL herausgeschnitten und als fehlender Repo-Pfad gemeldet.
 */
const REPO_PATH_RE =
  /(?<![\w/.-])(?:\.\/)?(?:packages|scripts|tools|docs|\.github)\/[A-Za-z0-9._/*-]+/g;

/** Ein Skript-Pfad im Kommandoblock — GANZ, inklusive Unterverzeichnissen. */
const SCRIPT_RE = /(?<![\w/.-])(?:\.\/)?scripts\/[A-Za-z0-9._/-]+/g;

/** Führendes `./` und Satzzeichen am Ende weg — `ci.yml)` ist `ci.yml`. */
const cleanPath = (p: string): string => p.replace(/^\.\//, "").replace(/[.,)]+$/, "");

const DOCS: readonly (readonly [string, string])[] = [
  ["README.md", README],
  ["AGENTS.md", AGENTS],
];

const CONTRACT_BUMP = /^#{2,4}\s+Contract-Bump/;

const SECTIONS: readonly (readonly [string, string])[] = DOCS.map(
  ([name, text]) =>
    [name as string, section(text as string, CONTRACT_BUMP, name as string)] as const,
);

/** Der README-Abschnitt, an dem die Diagnose-Anleitung hängt. */
const README_SECTION = section(README, CONTRACT_BUMP, "README.md");

/**
 * Die Testpfade, die der Abschnitt als „wird beim Bump rot" AUFZÄHLT.
 *
 * `*` ist im Zeichenvorrat nicht enthalten: Globs gehören dem Glob-Test weiter unten,
 * der sie gegen `SPEC_FILES` auflöst.
 */
const LISTED_SPECS: readonly string[] = [
  ...new Set(
    [
      ...README_SECTION.matchAll(
        /(?:\.\/)?packages\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/tests\/[A-Za-z0-9._-]+\.spec\.ts/g,
      ),
    ].map((m) => (m[0] as string).replace(/^\.\//, "")),
  ),
].sort();

describe("Doku über die Testdateien des Contract-Bumps", () => {
  it("findet die Vertragsversions-Assertion überhaupt (sonst misst die Ratsche nichts)", () => {
    expect(
      RED_ON_BUMP.length,
      "Keine Spec hält ein festgeschriebenes `targetsContract` gegen `contractVersion` — " +
        "entweder ist die Assertion verschwunden (dann ist der Bump-Schutz weg) oder die " +
        "Erhebung hier ist blind.",
    ).toBeGreaterThan(0);
  });

  it("README.md nennt im Abschnitt jede Datei, die beim Bump rot wird, mit vollem Pfad", () => {
    // Bewusst gegen den ABSCHNITT, nicht gegen die ganze Datei: sonst genügt es, die
    // Pfade irgendwo ans Ende zu kleben, während der Abschnitt, der auf „die Dateien
    // oben" verweist, keine mehr nennt.
    const missing = RED_ON_BUMP.filter((p) => !README_SECTION.includes(p));
    expect(
      missing,
      "README.md, Abschnitt 'Contract-Bump …' nennt diese Testpfade nicht, obwohl sie " +
        `beim Contract-Bump rot werden: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("README.md führt im Abschnitt keine Datei auf, die beim Bump grün bleibt", () => {
    // Unterdeckung allein reicht nicht. Wer `create-skin/tests/scaffold.spec.ts` mit in
    // die Liste nimmt, weist eine Datei als „wird rot" aus, die beim Bump per
    // Konstruktion grün bleibt (ihr Manifest entsteht erst im Test aus dem Vertrag).
    // Das ist dieselbe Fehlklassifikation, gegen die diese Ratsche antritt, nur in die
    // andere Richtung: wer der Checkliste folgt, ordnet dann einen ECHTEN Fehler dem
    // erwarteten Zwischenschritt zu und wartet auf einen Merge, der ihn nie behebt.
    const extra = LISTED_SPECS.filter((p) => !RED_ON_BUMP.includes(p));
    expect(
      extra,
      `README.md, Abschnitt 'Contract-Bump …' führt diese Testpfade als beim Bump rot auf, ` +
        `obwohl sie grün bleiben: ${extra.join(", ")}. Rot werden nur: ${RED_ON_BUMP.join(", ")}`,
    ).toEqual([]);
  });

  it.each(SECTIONS)("%s beziffert die Menge dieser Dateien richtig", (name, section) => {
    // „in einer der drei Dateien oben" bleibt sonst stehen, während es vier sind: ein
    // vierter Eintrag in der Liste macht den Satz still falsch, nicht die Ratsche rot.
    const wrong = [...section.matchAll(COUNT_RE)].filter(
      (m) => countValue(m[1] as string) !== RED_ON_BUMP.length,
    );
    expect(
      wrong.map((m) => m[0].replace(/\s+/g, " ")),
      `${name}, Abschnitt 'Contract-Bump …': die Doku beziffert die Dateimenge falsch, ` +
        `erhoben sind ${RED_ON_BUMP.length}: ${RED_ON_BUMP.join(", ")}`,
    ).toEqual([]);
  });

  it.each(DOCS)("%s nennt keinen Skin-Test-Glob, der die falschen Dateien trifft", (name, text) => {
    const globs = [...text.matchAll(/packages\/skins\/\*\/tests\/[A-Za-z0-9._*-]+/g)].map(
      (m) => m[0],
    );
    for (const glob of globs) {
      const re = new RegExp(
        `^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`,
      );
      const hits = SPEC_FILES.filter((p) => re.test(p)).sort();
      expect(
        hits,
        `${name}: der Glob '${glob}' trifft nicht die Dateien, die beim Contract-Bump rot werden.`,
      ).toEqual([...RED_ON_BUMP]);
    }
  });

  it.each(DOCS)("%s nennt keinen dieser Dateinamen ohne seinen Pfad", (name, text) => {
    // Solange die Namen auseinandergehen, ist ein nackter Basename irreführend: er
    // liest sich als „die eine Datei", meint aber nur einen von vier Orten.
    if (RED_BASENAMES.length < 2) return;
    const bare = [...text.matchAll(/(?<![/\w-])([A-Za-z0-9._-]+\.spec\.ts)\b/g)]
      .map((m) => m[1] as string)
      .filter((b) => RED_BASENAMES.includes(b));
    expect(
      [...new Set(bare)],
      `${name} nennt ${[...new Set(bare)].join(", ")} ohne Pfad, obwohl die Assertion in ` +
        `${RED_BASENAMES.length} verschieden benannten Dateien steht (${RED_ON_BUMP.join(", ")}).`,
    ).toEqual([]);
  });
});

describe("Doku über den fehlenden Vertrags-Export", () => {
  it("hängt die Einstufung an einen ausführbaren, existierenden Verifikationsschritt", () => {
    const fences = codeBlocks(README_SECTION);
    expect(
      fences.length,
      "README.md, Abschnitt 'Contract-Bump …': die Einstufung eines fehlenden " +
        "Vertrags-Exports als erwartet hängt an keinem ausführbaren Verifikationsschritt " +
        "(kein Kommandoblock im Abschnitt).",
    ).toBeGreaterThan(0);

    const scripts = [
      ...new Set([...fences.join("\n").matchAll(SCRIPT_RE)].map((m) => cleanPath(m[0] as string))),
    ];
    /**
     * `isFile()` zusätzlich zum Ausführungsbit: ein VERZEICHNIS hat `mode & 0o111`
     * gesetzt. Solange die Skript-Regex an `/` abbrach, zerfiel `./scripts/lib/verify.sh`
     * zu `scripts/lib` — und dieses Verzeichnis galt der Prüfung als „ausführbares
     * Skript". Beides ist gefixt: die Regex nimmt den ganzen Pfad, und eine Datei muss
     * es auch sein.
     */
    const runnable = scripts.filter((s) => {
      const st = statSync(join(ROOT, s), { throwIfNoEntry: false });
      return st !== undefined && st.isFile() && (st.mode & 0o111) !== 0;
    });
    expect(
      runnable,
      "README.md, Abschnitt 'Contract-Bump …': der Verifikationsschritt nennt kein " +
        `ausführbares Skript aus scripts/ (gefunden: ${scripts.join(", ") || "keins"}). ` +
        "Ohne einen real fahrbaren Weg bleibt 'fehlender Export = erwartet' eine Behauptung.",
    ).not.toEqual([]);
  });

  it("nennt in diesem Abschnitt nur Repo-Pfade, die es wirklich gibt", () => {
    // Deckt genau den Rückfall ab, den die Ratsche oben sonst einlädt: irgendein
    // plausibel klingendes `scripts/…` in den Block schreiben und grün sein.
    const paths = [...README_SECTION.matchAll(REPO_PATH_RE)]
      .map((m) => cleanPath(m[0] as string))
      .filter((p) => !p.includes("*"));
    const absent = [...new Set(paths)].filter((p) => !existsSync(join(ROOT, p)));
    expect(
      absent,
      `README.md, Abschnitt 'Contract-Bump …' nennt nicht existierende Pfade: ${absent.join(", ")}`,
    ).toEqual([]);
  });
});
