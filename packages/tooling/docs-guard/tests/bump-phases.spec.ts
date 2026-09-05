// Ratsche gegen Doku, die die Fehlerbilder des Contract-Bumps frei zitiert.
//
// ══ Der Fehler, gegen den sie steht
//
// Der Abschnitt „Contract-Bump …" ist die Stelle, an der ein Maintainer ein CI-Log
// EINSTUFT. Dafür muss er die Zeichenfolge, die er dort sieht, im Text wiederfinden.
// Rot ist es beim Bump zweimal, mit zwei verschiedenen Fehlerbildern:
//
//   Phase 1, VOR dem Contract-Merge: die Skins referenzieren einen Typ, den der
//   eingehängte Vertrag noch nicht hat → tsc meldet `has no exported member 'X'`.
//
//   Phase 2, NACH dem Contract-Merge: die CI baut den neuen Vertrag, die Skin-Manifeste
//   tragen aber noch die alte `targetsContract`-Version → `expected '<alt>' to be
//   '<neu>'`.
//
// Die Doku zitierte für Phase 1 „hat keinen exportierten Member X" — eine Zeichenfolge,
// die in KEINEM Log auftaucht. Wer danach im CI-Log sucht, findet nichts und schliesst,
// er habe ein anderes Problem.
//
// ══ Woher die Fehlerbilder kommen — beide gemessen, keines behauptet
//
// Versionsbild: zweistufig erhoben.
//   1. Welche Specs beim Bump rot werden, erhebt diese Datei genauso wie
//      `test-files-and-exports.spec.ts` (dort ausführlich begründet): alle von Git
//      verfolgten `*.spec.ts` unter `packages/<gruppe>/<paket>/tests/`, gefiltert auf
//      „misst `targetsContract` gegen `contractVersion`" UND „das gemessene Manifest ist
//      eingecheckt und schreibt die Version als Literal fest". Der Erhebungsteil ist von
//      dort kopiert statt importiert — die fremde Spec-Datei wird nicht angefasst.
//   2. Die Meldungsform kommt von vitest: diese Specs vergleichen mit `.toBe(` (wird
//      geprüft), also wird hier eine echte `.toBe`-Assertion zum Scheitern gebracht und
//      aus ihrer Meldung das Wortgerüst abgeleitet.
//   Die Wortinseln allein („expected", „to be") wären zu lax — sie decken auch
//   `expected undefined to be defined`, ein real existierendes vitest-Bild, das beim Bump
//   nie erscheint. Die Doku dürfte dann eine Zeichenfolge zitieren, nach der niemand im
//   Log fündig wird. Deshalb sind die beiden Werteplätze an die GEMESSENE Grösse
//   gekoppelt: die Anführungszeichen stammen aus der vitest-Meldung (Strings werden
//   quotiert), und dazwischen steht die Gestalt der wirklich festgeschriebenen
//   `targetsContract`-Literale (`1.13` → `[0-9]+(\.[0-9]+)+`) oder ein Platzhalter in
//   spitzen Klammern. Passt ein eingecheckter Wert nicht mehr auf diese Gestalt, fällt
//   die Erhebungsprüfung, statt still die falsche Zeichenfolge zu bewachen.
//
// Export-Bild: mit einem echten tsc-Lauf erhoben.
//
//   $ tsc --noEmit --pretty false --skipLibCheck a.ts b.ts
//   b.ts(1,10): error TS2305: Module '"./a"' has no exported member 'ZZ_MEMBER_ZZ'.
//   b.ts(5,8): error TS2339: Property 'ZZ_PROP_ZZ' does not exist on type 'ZZ_TYPE_ZZ'.
//
// tsc meldet englisch. Nachgemessen: `LANG=de_DE.UTF-8` ändert daran nichts, nur
// `--locale de` tut es — und dann lautet die Meldung „Das Modul ""./a"" weist keinen
// exportierten Member "ZZ_MEMBER_ZZ" auf.", also auch nicht wie zitiert. Kein Workflow
// und kein Skript dieses Repos setzt `--locale`; das wird mitgeprüft, damit die Erhebung
// nicht still an einer anderen Sprachfassung vorbeiläuft. Diese Ratsche baut die beiden
// Typfehler bei jedem Lauf selbst und leitet die Muster aus der Ausgabe ab — sie kann
// also keine Fassung erzwingen, die tsc gar nicht schreibt.
//
// ══ Gegenproben (alle gefahren, echte Meldungen)
//
// 1–4 laufen gegen eine Kopie der Doku unter `DOCS_ROOT`; 5 in einer Sandbox-Kopie des
// Repos mit eigenem `git`-Index.
//
// 1. Im README `expected '<alt>' to be '<neu>'` durch `expected undefined to be defined`
//    ersetzt — ein REAL existierendes vitest-Bild, das beim Bump nur nie erscheint →
//    README.md, Abschnitt 'Contract-Bump …' nennt das Fehlerbild der Phase NACH dem
//    Contract-Merge nicht (erwartet die Form
//    'expected\s+'(?:<[^>\s]{1,24}>|[0-9]+(?:\.[0-9]+)+)'\s+to\s+be\s+'…'', wie sie
//    4 Specs beim Bump werfen: …)
//
// 2. Im README beide Vorkommen von `has no exported member 'X'` durch die deutsche
//    Umschreibung ersetzt, die dort ursprünglich stand →
//    README.md, Abschnitt 'Contract-Bump …' nennt das Fehlerbild der Phase VOR dem
//    Contract-Merge nicht in der Fassung, die tsc wirklich schreibt
//    ('has\s+no\s+exported\s+member\s+'(?:<[^>\s]{1,24}>|[A-Za-z_$][\w$]*)'' — gerade
//    eben gemessen, siehe Kopfkommentar).
//
// 3. Im README `Property 'Y' does not exist on type 'Z'` frei zitiert →
//    README.md, Abschnitt 'Contract-Bump …' nennt das zweite tsc-Bild der ersten Phase
//    nicht in der gemessenen Fassung
//    ('Property\s+'…'\s+does\s+not\s+exist\s+on\s+type\s+'…'').
//
// 4. In `AGENTS.md` das Export-Bild umschrieben →
//    AGENTS.md, Abschnitt 'Contract-Bump …' nennt nicht beide Fehlerbilder in der Fassung,
//    die die Werkzeuge wirklich ausgeben (…): expected [ Array(1) ] to deeply equal []
//
// 5. In der Sandbox `contractVersion` in allen vier roten Specs umbenannt →
//    Keine Spec hält ein festgeschriebenes `targetsContract` gegen `contractVersion` —
//    entweder ist der Bump-Schutz weg oder die Erhebung hier ist blind. In beiden Fällen
//    prüft diese Ratsche das Fehlerbild der zweiten Phase gegen nichts.
//
// ══ Was diese Ratsche NICHT prüft
//
// **Dass die beiden Fehlerbilder je EINER Phase zugeordnet sind, in der richtigen
// Reihenfolge, jedes mit seiner auflösenden Bedingung.** Die Vorfassung hatte dafür
// einen „positiven Boden": sie zerlegte den Abschnitt in Textblöcke und verlangte je
// Phase einen Block, der genau ein Fehlerbild nennt, sich mit „vor/nach dem
// Contract-Merge" einordnet und unter einem Label „Auflösende Bedingung:" die richtige
// Seite nennt. Und ein Verbot: kein Satz der Form „rot … bis/solange <X>" durfte in
// seinem Teilsatz ab „bis" nur eine der beiden Seiten nennen.
//
// Beides ist gefallen, weil beides Aussagen in deutscher Prosa prüfen will:
//
//   • Der positive Boden schrieb dem Text eine SCHREIBWEISE vor — ein Label pro Phase.
//     Eine Doku, die dieselbe Zuordnung als Tabelle mit den Spalten „Phase | Meldung |
//     wird grün durch" trifft, ist tadellos und wäre rot geworden. Ein Wächter, der
//     korrekte Doku rot macht, wird abgeschaltet, nicht befolgt.
//   • Das Verbot las den Teilsatz ab „bis"/„solange" und suchte darin Seitenwörter.
//     Nachgemessen sind daran vorbeigekommen: ein Nebensatz, der die andere Seite
//     „mit-nennt", ohne dass sie in der Bedingung steht; und eine Formulierung ganz ohne
//     „bis"/„solange" („grün wird es erst, wenn drüben gemergt ist").
//   • Ob eine Reihenfolge-Aussage stimmt, ist eine Bedeutungsfrage. Ein Wortlautvergleich
//     sieht sie nicht, und eine Wortliste wäre geraten statt gemessen.
//
// Was bleibt, ist die Hälfte, die sich nicht wegformulieren lässt: die Zeichenfolgen, die
// die Werkzeuge WIRKLICH ausgeben, stehen im Text — in README.md wie in AGENTS.md. Ob
// der Text sie richtig einordnet, ist Sache des Reviews.
//
// **Ob AGENTS.md beide auflösenden Bedingungen benennt.** Die Vorfassung verlangte
// zusätzlich die Wörter „Contract-PR/-Merge" und „Manifest-Bump/-PR/-Merge". Das ist eine
// Wortliste über Prosa: „der Merge des Vertrags-PRs drüben" und „wenn die Manifeste hier
// nachgezogen sind" sagen dasselbe und stehen in keiner davon.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { section, stripFences } from "./markdown.js";

/** Wurzel des Workspace (packages/tooling/docs-guard/tests → 4 Ebenen hoch). */
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Wurzel, aus der die DOKU gelesen wird — überschreibbar, damit sich rot und grün an
 * einer Kopie nachweisen lassen, ohne die echte Doku anzufassen. Das Repo selbst
 * (Git-Erhebung, Spec-Quellen, tsc) wird immer unter `REPO_ROOT` gelesen.
 */
const DOCS_ROOT = process.env["DOCS_ROOT"] ?? REPO_ROOT;

const readRepo = (rel: string): string => readFileSync(join(REPO_ROOT, rel), "utf8");
const toPosix = (p: string): string => p.split("\\").join("/");
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const README = readFileSync(join(DOCS_ROOT, "README.md"), "utf8");
const AGENTS = readFileSync(join(DOCS_ROOT, "AGENTS.md"), "utf8");

// ───────────────────────────────────────────────────────────────────────────────
// Erhebung: welche Specs werden beim Contract-Bump rot, und auf welche Version sind
// sie festgenagelt?
//
// Übernommen aus `packages/tooling/docs-guard/tests/test-files-and-exports.spec.ts`
// (Kopie mit Verweis, damit die fremde Datei unangetastet bleibt). Die Begründung für
// „von Git verfolgt", „festgeschriebenes Manifest-Literal" und den weiten Suchraum
// steht dort im Kopfkommentar und wird hier nicht wiederholt.
// ───────────────────────────────────────────────────────────────────────────────

const TRACKED: readonly string[] = execFileSync("git", ["ls-files", "-z"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean);

const SPEC_FILES: readonly string[] = TRACKED.filter((p) =>
  /^packages\/[^/]+\/[^/]+\/tests\/.+\.spec\.ts$/.test(p),
).sort();

const WORKSPACE: ReadonlyMap<string, string> = new Map(
  TRACKED.filter((p) => /^packages\/[^/]+\/[^/]+\/package\.json$/.test(p)).flatMap((p) => {
    const name = (JSON.parse(readRepo(p)) as { name?: string }).name;
    return name ? [[name, p.slice(0, p.lastIndexOf("/"))] as [string, string]] : [];
  }),
);

function resolveRef(specFile: string, ref: string): string | null {
  if (ref.startsWith("./") || ref.startsWith("../")) {
    return toPosix(normalize(join(dirname(specFile), ref)));
  }
  for (const [name, dir] of WORKSPACE) {
    if (ref.startsWith(`${name}/`)) return `${dir}/${ref.slice(name.length + 1)}`;
  }
  return ref.startsWith("packages/") ? ref : null;
}

/** Die in einer Spec gemessenen, eingecheckten Manifeste samt festgeschriebener Version. */
function pinnedManifests(specFile: string, src: string): { file: string; version: string }[] {
  const refs = new Set(
    [...src.matchAll(/["'`]([^"'`\n]*manifest\.json)["'`]/g)].map((m) => m[1] as string),
  );
  const out: { file: string; version: string }[] = [];
  for (const ref of refs) {
    const rel = resolveRef(specFile, ref);
    if (!rel || !existsSync(join(REPO_ROOT, rel))) continue;
    const pinned = (JSON.parse(readRepo(rel)) as { targetsContract?: unknown }).targetsContract;
    if (typeof pinned === "string") out.push({ file: rel, version: pinned });
  }
  return out;
}

const measuresContractVersion = (src: string): boolean =>
  /\.targetsContract\b/.test(src) && /\bcontractVersion\b/.test(src);

/** Die Dateien, die beim Contract-Bump tatsächlich rot werden. */
const RED_ON_BUMP: readonly string[] = SPEC_FILES.filter((p) => {
  const src = readRepo(p);
  return measuresContractVersion(src) && pinnedManifests(p, src).length > 0;
});

/** Von diesen: welche vergleichen wirklich mit `.toBe(`? Davon hängt die Meldungsform ab. */
const COMPARED_WITH_TO_BE: readonly string[] = RED_ON_BUMP.filter((p) =>
  /\.targetsContract\s*\)\s*\.toBe\s*\(/.test(readRepo(p)),
);

/** Die Werte, die beim Bump auseinanderlaufen — sie bestimmen die Gestalt der Werteplätze. */
const PINNED_VERSIONS: readonly { file: string; version: string }[] = RED_ON_BUMP.flatMap((p) =>
  pinnedManifests(p, readRepo(p)),
);

// ───────────────────────────────────────────────────────────────────────────────
// Fehlerbild 1 — das Versionsbild: Wortgerüst von vitest, Werteplätze von den
// eingecheckten `targetsContract`-Literalen.
// ───────────────────────────────────────────────────────────────────────────────

const SENTINEL_ACTUAL = "«ALT»";
const SENTINEL_EXPECTED = "«NEU»";

/** Gestalt der eingecheckten Versionen (`1.13`). Wird gegen die echten Werte geprüft. */
const VERSION_SHAPE = "[0-9]+(?:\\.[0-9]+)+";
/** Was die Doku statt einer echten Version einsetzen darf: `<alt>`, `<neu>`, `<x.y>`. */
const PLACEHOLDER_SHAPE = "<[^>\\s]{1,24}>";
const VERSION_SLOT = `(?:${PLACEHOLDER_SHAPE}|${VERSION_SHAPE})`;
const NAME_SLOT = `(?:${PLACEHOLDER_SHAPE}|[A-Za-z_$][\\w$]*)`;

/**
 * Baut aus Literalteilen und Werteplätzen ein Muster: Wortabstände werden tolerant
 * (`\s+`, damit ein Zeilenumbruch im Fliesstext nichts kaputt macht), alles andere —
 * insbesondere die Anführungszeichen um die Werte — bleibt buchstäblich stehen.
 */
function patternFrom(parts: readonly string[], slot: string): RegExp {
  const literal = (part: string): string =>
    part.trim().split(/\s+/).filter(Boolean).map(escapeRe).join("\\s+");
  return new RegExp(parts.map(literal).join(slot), "i");
}

/**
 * Bringt eine echte `.toBe`-Assertion zum Scheitern und zerlegt ihre Meldung.
 *
 * `expect('«ALT»').toBe('«NEU»')` meldet „expected '«ALT»' to be '«NEU»' // Object.is
 * equality". Übrig bleiben die Literalteile `expected '`, `' to be '`, `'` — die
 * Anführungszeichen gehören dazu, denn sie sind der Unterschied zwischen dem Bild, das
 * beim Bump wirklich erscheint, und `expected undefined to be defined`.
 */
function versionMismatchPattern(): RegExp {
  let message = "";
  try {
    expect(SENTINEL_ACTUAL).toBe(SENTINEL_EXPECTED);
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  if (!message.includes(SENTINEL_ACTUAL) || !message.includes(SENTINEL_EXPECTED)) {
    throw new Error(
      "Konnte das Fehlerbild der Vertragsversions-Assertion nicht erheben: vitest meldete " +
        `'${message}', darin stehen die verglichenen Werte nicht mehr. Solange das so ist, ` +
        "prüft diese Ratsche das Versionsbild ins Blaue — deshalb bricht sie hier ab.",
    );
  }
  const core = ((message.split("\n")[0] as string).split("//")[0] as string).trim();
  const parts = core
    .split(SENTINEL_ACTUAL)
    .join("\u0000")
    .split(SENTINEL_EXPECTED)
    .join("\u0000")
    .split("\u0000");
  return patternFrom(parts, VERSION_SLOT);
}

const VERSION_MISMATCH = versionMismatchPattern();

// ───────────────────────────────────────────────────────────────────────────────
// Fehlerbild 2 — das Export-Bild: aus einem echten tsc-Lauf erhoben.
// ───────────────────────────────────────────────────────────────────────────────

const TS_TYPE = "ZZ_TYPE_ZZ";
const TS_MEMBER = "ZZ_MEMBER_ZZ";
const TS_PROP = "ZZ_PROP_ZZ";

/** Workflows/Skripte, die tsc eine Sprache aufzwingen — dann zitierte die Doku evtl. eine andere. */
const LOCALE_FORCED: readonly string[] = TRACKED.filter(
  (p) => /^\.github\/workflows\/.+\.ya?ml$/.test(p) || /^(?:package\.json|scripts\/.+)$/.test(p),
).filter((p) => /--locale\b|\bLC_ALL=|\bLANG=/.test(readRepo(p)));

/**
 * Baut zwei echte Typfehler und leitet aus tsc' Ausgabe die Muster ab.
 *
 * Der variable Teil vor dem Platzhalter (`Module '"./a"' `) wird abgeschnitten: von den
 * Anführungszeichen vor dem Platzhalter ist das letzte dessen eigenes, das vorletzte
 * schliesst den Modulpfad — ab dort beginnt der feste Wortlaut. Der Schlusspunkt fällt
 * weg, den zitiert keine Doku mit.
 */
function tscPatterns(): { missingExport: RegExp; missingProperty: RegExp } {
  const requireHere = createRequire(import.meta.url);
  let tsc = "";
  try {
    tsc = requireHere.resolve("typescript/bin/tsc");
  } catch {
    throw new Error(
      "typescript ist von hier aus nicht auflösbar — dann kann diese Ratsche das " +
        "Fehlerbild der ersten Phase nicht messen und würde es nur behaupten. Genau das " +
        "war der Befund: die Doku zitierte eine Meldung, die es nicht gibt.",
    );
  }

  const dir = mkdtempSync(join(tmpdir(), "docs-guard-tsc-"));
  let out = "";
  try {
    writeFileSync(
      join(dir, "a.ts"),
      `export interface ${TS_TYPE} { real: number }\nexport const real = 1;\n`,
    );
    writeFileSync(
      join(dir, "b.ts"),
      `import { ${TS_MEMBER} } from "./a";\n` +
        `import type { ${TS_TYPE} } from "./a";\n` +
        `declare const v: ${TS_TYPE};\n` +
        `void ${TS_MEMBER};\n` +
        `void v.${TS_PROP};\n`,
    );
    try {
      out = execFileSync(
        process.execPath,
        // `--skipLibCheck` spart das Prüfen der Bibliotheks-Deklarationen (Sekunden), ohne
        // die beiden erzeugten Diagnosen zu verändern — sie entstehen in `b.ts`.
        [
          tsc,
          "--noEmit",
          "--pretty",
          "false",
          "--skipLibCheck",
          join(dir, "a.ts"),
          join(dir, "b.ts"),
        ],
        { encoding: "utf8" },
      );
    } catch (err) {
      // tsc endet bei Fehlern mit Code 2 — die Diagnosen stehen auf stdout.
      out = String((err as { stdout?: string }).stdout ?? "");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const lines = out.split("\n").map((l) => l.trim());
  const diagnostic = (sentinel: string): string => {
    const hit = lines.find((l) => /error TS\d+:/.test(l) && l.includes(sentinel));
    if (!hit) {
      throw new Error(
        `tsc hat für '${sentinel}' keine Diagnose geliefert (Ausgabe: ${out.trim() || "leer"}). ` +
          "Diese Ratsche misst das Fehlerbild der ersten Phase am echten Compiler; ohne " +
          "Messung bewachte sie ein Zitat aus dem Kopf — der Fehler, gegen den sie steht.",
      );
    }
    return (hit.split(/error TS\d+:\s*/)[1] as string).replace(/\.\s*$/, "");
  };

  const build = (msg: string, sentinels: readonly string[]): RegExp => {
    const first = Math.min(...sentinels.map((s) => msg.indexOf(s)).filter((i) => i >= 0));
    const before = msg.slice(0, first);
    const quotes = [...before.matchAll(/'/g)].map((m) => m.index as number);
    const cut = quotes.length >= 2 ? (quotes[quotes.length - 2] as number) + 1 : 0;
    let rest = msg.slice(cut);
    for (const s of sentinels) rest = rest.split(s).join("\u0000");
    return patternFrom(rest.split("\u0000"), NAME_SLOT);
  };

  return {
    missingExport: build(diagnostic(TS_MEMBER), [TS_MEMBER]),
    missingProperty: build(diagnostic(TS_PROP), [TS_PROP, TS_TYPE]),
  };
}

const TSC_PATTERNS = tscPatterns();
const MISSING_EXPORT = TSC_PATTERNS.missingExport;
const MISSING_PROPERTY = TSC_PATTERNS.missingProperty;

/**
 * Der Abschnitt ohne Code-Fences.
 *
 * Der Kommandoblock nennt `<vermisster-Member>` und Kommentarzeilen mit Satzzeichen —
 * geprüft wird ausschliesslich der erklärende Text. Die Fence-Buchhaltung liegt in
 * `markdown.ts` und kennt ``` wie ~~~.
 */
const CONTRACT_BUMP = /^#{2,4}\s+Contract-Bump/;
const README_PROSE = stripFences(section(README, CONTRACT_BUMP, "README.md"));
const AGENTS_PROSE = stripFences(section(AGENTS, CONTRACT_BUMP, "AGENTS.md"));

describe("Doku über die Fehlerbilder des Contract-Bumps", () => {
  it("erhebt beide Fehlerbilder überhaupt (sonst misst die Ratsche nichts)", () => {
    expect(
      RED_ON_BUMP.length,
      "Keine Spec hält ein festgeschriebenes `targetsContract` gegen `contractVersion` — " +
        "entweder ist der Bump-Schutz weg oder die Erhebung hier ist blind. In beiden " +
        "Fällen prüft diese Ratsche das Fehlerbild der zweiten Phase gegen nichts.",
    ).toBeGreaterThan(0);

    expect(
      [...COMPARED_WITH_TO_BE],
      "Diese Specs messen die Vertragsversion, aber nicht mit `.toBe(` — dann ist die aus " +
        "vitest erhobene Meldungsform nicht die, die beim Bump wirklich erscheint, und das " +
        `Muster '${VERSION_MISMATCH.source}' bewacht die falsche Zeichenfolge: ` +
        `${RED_ON_BUMP.filter((p) => !COMPARED_WITH_TO_BE.includes(p)).join(", ")}`,
    ).toEqual([...RED_ON_BUMP]);

    const oddVersions = PINNED_VERSIONS.filter(
      ({ version }) => !new RegExp(`^${VERSION_SHAPE}$`).test(version),
    );
    expect(
      oddVersions.map(({ file, version }) => `${file}: ${version}`),
      "Diese festgeschriebenen `targetsContract`-Werte passen nicht auf die Gestalt " +
        `'${VERSION_SHAPE}', an die die Werteplätze des Versionsbilds gekoppelt sind. Das ` +
        "Muster bewacht dann eine Form, die in der Meldung gar nicht mehr auftaucht — " +
        "Gestalt hier nachziehen, nicht die Doku.",
    ).toEqual([]);

    expect(
      [...LOCALE_FORCED],
      "Diese Dateien zwingen tsc eine Sprache auf (`--locale`, `LANG=`, `LC_ALL=`). Das " +
        "Export-Fehlerbild wird hier aus einem tsc-Lauf ohne solche Vorgabe erhoben, so wie " +
        "die CI ihn fährt — stimmt das nicht mehr, zitiert die Doku womöglich die falsche " +
        "Sprachfassung, und diese Ratsche merkte es nicht.",
    ).toEqual([]);

    expect(
      MISSING_EXPORT.source,
      "Aus dem tsc-Lauf ist kein brauchbares Muster für den fehlenden Export entstanden — " +
        `erhoben wurde '${MISSING_EXPORT.source}'.`,
    ).toMatch(/member/i);
  });

  it("README.md nennt beide Fehlerbilder in der Fassung, die die Werkzeuge ausgeben", () => {
    // Ein Abschnitt, der nur eins von beiden nennt, beschreibt nur eine der beiden
    // Phasen. Und ein Abschnitt, der ein Bild in einer erfundenen Fassung zitiert, ist
    // keinen Deut besser: der Leser sucht im Log nach einer Zeichenfolge, die dort nie
    // steht. Genau das war der Fall — die zitierte deutsche tsc-Meldung existiert nicht.
    expect(
      VERSION_MISMATCH.test(README_PROSE),
      "README.md, Abschnitt 'Contract-Bump …' nennt das Fehlerbild der Phase NACH dem " +
        `Contract-Merge nicht (erwartet die Form '${VERSION_MISMATCH.source}', wie sie ` +
        `${RED_ON_BUMP.length} Specs beim Bump werfen: ${RED_ON_BUMP.join(", ")}). Die ` +
        "Werteplätze sind an die eingecheckten `targetsContract`-Literale gekoppelt: ein " +
        "anderes vitest-Bild (etwa `expected undefined to be defined`) zählt hier nicht.",
    ).toBe(true);

    expect(
      MISSING_EXPORT.test(README_PROSE),
      "README.md, Abschnitt 'Contract-Bump …' nennt das Fehlerbild der Phase VOR dem " +
        `Contract-Merge nicht in der Fassung, die tsc wirklich schreibt ('${MISSING_EXPORT.source}' ` +
        "— gerade eben gemessen, siehe Kopfkommentar). Eine übersetzte oder umschriebene " +
        "Fassung hilft dem Leser nicht: er sucht im CI-Log nach genau dieser Zeichenfolge.",
    ).toBe(true);

    expect(
      MISSING_PROPERTY.test(README_PROSE),
      "README.md, Abschnitt 'Contract-Bump …' nennt das zweite tsc-Bild der ersten Phase " +
        `nicht in der gemessenen Fassung ('${MISSING_PROPERTY.source}'). Der Abschnitt führt ` +
        "beide Typfehler an; wird einer davon frei zitiert, sucht der Leser wieder ins Leere.",
    ).toBe(true);
  });

  it("nennt beide Fehlerbilder auch in AGENTS.md", () => {
    // AGENTS.md soll den Sachverhalt nicht ausbreiten — aber wer nur EIN Fehlerbild
    // nennt, macht aus dem eingebauten Zwischenschritt der anderen Phase einen Fehler des
    // Lesers. Geprüft sind nur die beiden gemessenen Zeichenfolgen; ob der Text sie
    // richtig einordnet, steht nicht mehr hier (siehe Kopf).
    const missing: string[] = [];
    if (!VERSION_MISMATCH.test(AGENTS_PROSE)) missing.push("das Versionsbild");
    if (!MISSING_EXPORT.test(AGENTS_PROSE)) missing.push("das Export-Bild (in tsc' Fassung)");
    expect(
      missing,
      "AGENTS.md, Abschnitt 'Contract-Bump …' nennt nicht beide Fehlerbilder in der Fassung, " +
        `die die Werkzeuge wirklich ausgeben ('${VERSION_MISMATCH.source}' bzw. ` +
        `'${MISSING_EXPORT.source}'). Wer nur eine Hälfte nennt, lässt den Leser die andere ` +
        "Phase für einen echten Fehler halten.",
    ).toEqual([]);
  });
});
