// Ratsche gegen Doku, die dem CI-Workflow Schritte, Dateien und Trigger andichtet, die
// er nicht hat.
//
// ══ Der Fehler, gegen den sie steht
//
// Der Abschnitt „Contract-Bump …" (README.md) erklärt einem Maintainer, WARUM die CI beim
// Vertrags-Bump rot ist. Er nannte dafür einen Workflow-Schritt „Recreate dev-link path"
// und schrieb ihm zu, `Micsi/openbridgeserver@feat/visu-mobile-skins` auszuchecken und
// den Vertrag von dort zu bauen. Er tut beides nicht: ausgecheckt wird im vorangehenden,
// NAMENLOSEN `actions/checkout`-Schritt, kompiliert erst in „Build contract". Wer unter
// dem genannten Schritt nach einem fehlgeschlagenen Checkout sucht, findet ihn nie.
//
// ══ Was erhoben wird
//
//   Der Workflow-PFAD kommt aus dem ABSCHNITT, nicht aus einem Literal hier: würde diese
//   Ratsche `.github/workflows/ci.yml` selbst hinschreiben, könnte die Doku auf eine
//   beliebige andere (auch nicht existierende) Datei zeigen und trotzdem grün bleiben.
//   Genau eine Nennung, sonst Wurf — bei zweien wüsste auch ein Maintainer nicht, welche
//   den beschriebenen roten Lauf erzeugt.
//
//   Schritt-Referenzen — aus dem YAML wird für jeden Step eine Referenz erhoben: sein
//   `name`, und falls er namenlos ist, sein `uses` ohne Version (`actions/checkout`). Im
//   Doku-Text wird nach genau diesen Zeichenketten gesucht, begrenzt durch
//   Nicht-Buchstaben. Ob sie in „…", in `…`, in **…** oder blank stehen, ist damit egal —
//   es gibt keinen Zitatstil, der die Erhebung abschaltet. („ESLint" trifft „Lint" nicht:
//   die Begrenzung verlangt links und rechts einen Nicht-Buchstaben.)
//
//   Trigger — die unmittelbaren Kindschlüssel von `on:`. Der Abschnitt muss GENAU sie
//   nennen, nicht mehr und nicht weniger.
//
//   Repo und Ref des fremden Checkouts — aus `repository:`/`ref:` des Checkout-Steps.
//
// ══ Leere Erhebung ist kein Grün
//
// Wirft der Workflow keine Schritte oder keine Trigger ab, fällt die Ratsche, statt still
// trivial wahr zu werden. Dasselbe doku-seitig: nennt der Abschnitt überhaupt keinen
// Schritt des Workflows, ist er als Diagnose-Anleitung wertlos — und diese Ratsche hätte
// nichts zu messen.
//
// ══ YAML
//
// `js-yaml` ist aus diesem Paket nicht auflösbar (nur transitiv im Store). `parseTriggers`
// und `parseSteps` sind darum bewusst eng gefasste Reader, die bei jeder Schreibweise, die
// sie nicht sicher beherrschen, WERFEN statt still leer zu liefern. Beide sind die einzige
// Stelle, die YAML anfasst: mit `js-yaml` als devDependency wird `parseTriggers` zu
// `Object.keys(load(text).on)` und `parseSteps` zu einem Durchlauf über `jobs.*.steps`.
// Nachgestellte Kommentare werden vorher gebleicht (nur ausserhalb von Anführungszeichen,
// damit `path: a#b` unangetastet bleibt).
//
// ══ Gegenproben (alle gefahren, echte Meldungen)
//
// Doku über `DOCS_ROOT`, Workflow über `WORKFLOW_ROOT` — das echte Repo bleibt in beiden
// Richtungen unangetastet.
//
// 1. Im Abschnitt `.github/workflows/ci.yml` durch `.github/workflows/contract.yml`
//    ersetzt → fünf Tests rot zugleich, angeführt von:
//    README.md, Abschnitt 'Contract-Bump …' verweist auf .github/workflows/contract.yml —
//    diese Datei gibt es im Repo nicht. Alles, was der Abschnitt über Schritte und Trigger
//    sagt, ist damit unprüfbar, und ein Maintainer sucht im Nichts.
//
// 2. Die beiden Schrittnamen aus dem Abschnitt genommen und durch eine Umschreibung
//    ersetzt („erst wird … geholt, dann umgehängt, dann kompiliert") →
//    README.md, Abschnitt 'Contract-Bump …' benennt keinen einzigen Schritt aus
//    .github/workflows/ci.yml (vorhanden: actions/checkout, Recreate dev-link path,
//    pnpm/action-setup, actions/setup-node, Build contract, Install (skins), Lint,
//    Typecheck, Test (Vitest), Conformance gate (all skins)).
//
// 3. „Build contract" zu „Fetch contract types" gemacht →
//    Doku nennt in einem Absatz über den Workflow Schritte, die es in
//    .github/workflows/ci.yml nicht gibt: README.md: „Fetch contract types". Vorhanden
//    sind: Recreate dev-link path, Build contract, Install (skins), Lint, Typecheck,
//    Test (Vitest), Conformance gate (all skins).
//
// 4. Den Ref aus `Micsi/openbridgeserver@feat/visu-mobile-skins` gestrichen →
//    README.md, Abschnitt 'Contract-Bump …' nennt nicht, woher der Vertrag kommt — in
//    .github/workflows/ci.yml steht: feat/visu-mobile-skins.
//
// 5. `pull_request` aus der Trigger-Aufzählung des Abschnitts gestrichen →
//    README.md, Abschnitt 'Contract-Bump …' nennt andere Trigger, als
//    .github/workflows/ci.yml hat.: expected [ 'push' ] to deeply equal [ 'pull_request',
//    'push' ]
//
// 6. Reality-Probe über `WORKFLOW_ROOT`: in einer Kopie von `ci.yml` den Schlüssel
//    `steps:` umbenannt → die Erhebung fällt LAUT statt still leer zu werden:
//    .github/workflows/ci.yml liefert keine Schritte — entweder ist der Workflow leer oder
//    die Erhebung hier ist blind. In beiden Fällen prüfen die folgenden Tests nichts.
//
// ══ Was diese Ratsche NICHT prüft
//
// **Ob ein Satz einem Schritt die richtige OPERATION zuordnet.** Die Vorfassung hatte
// zwei Prüfungen dafür — „nennt zu jeder behaupteten Operation den Schritt, der sie
// ausführt" und „nennt dort, wo sie den Vertrags-Checkout erklärt, den Schritt, der ihn
// ausführt". Beide sind gefallen.
//
// Die erste hing an einem Verbstamm-Vokabular (`bau|gebaut|kompilier|erzeug|generier|
// übersetz`, `check|ausgecheckt|klon`, `symlink|verlink`). Der Kopf der Vorfassung sagte
// selbst, diese Liste sei „NICHT vollständig" — und das ist keine Lücke, die sich
// schliessen liesse: „holt den Vertrag herein und macht daraus die Typen" enthält kein
// einziges dieser Wörter und behauptet dasselbe. Umgekehrt liest die Prüfung positiv,
// ohne Verneinung: ein Satz, der einem Schritt die Operation ABSPRICHT („dort wird nicht
// gebaut"), fällt ihr als Behauptung zur Last. Sie zwang die korrigierte Doku damit in
// eine bestimmte Formulierung.
//
// Die zweite kam ohne Verben aus, hing aber an der SATZGRENZE: „… `Micsi/openbridgeserver`
// … . Ausgecheckt wird das in „Checkout"." erfüllt sie in zwei Sätzen nicht mehr und ist
// trotzdem richtig; umgekehrt genügt ein Nebensatz, der den richtigen Schritt bloss
// mit-nennt, ohne ihm etwas zuzuordnen. Eine Zuordnung in deutscher Prosa ist nicht
// messbar — sie gehört ins Review.
//
// Was bleibt, trägt ohne jedes Verb: der genannte Workflow existiert, die genannten
// Schrittnamen existieren, Repo und Ref stehen da, und die Trigger stimmen genau.
//
// **Ob die Kausalität stimmt.** Die Vorfassung verbot Sätze der Art „ein bestehender
// grüner Check wird vom Contract-Bump rot", solange der Workflow keinen extern feuerbaren
// Trigger hat. Gebaut war das aus sechs Regexen über Prosa, darunter eine Verneinungs-
// Lookahead-Konstruktion (`bleibt … grün` zählt nur ohne `nicht|nichts|kein` dazwischen)
// und eine Liste von Rerun-Umschreibungen. Der Kritiker hat sie mit „und damit jeden PR,
// der gerade offen ist" und „daran bleibt nichts grün" ausgehebelt; repariert wurde gegen
// genau diese zwei. Die nächste steht schon daneben: „jeder Check an `main` schlägt bis
// dahin fehl" nennt `main`, behauptet dasselbe und enthält kein einziges Wort der
// Rot-Liste (rot · trifft · betrifft · erbt · kippt · fällt). Ein Wächter mit dieser
// Fehlerfläche erzeugt Vertrauen, das er nicht deckt.
//
// Die Trigger-Prüfung bleibt und ist die harte Hälfte derselben Sache: sie hält die
// Aufzählung im Abschnitt exakt gegen `on:`. Wer daraus die falsche Kausalität ableitet,
// tut es wenigstens vor den richtigen Tatsachen.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FENCE_LINE, section, stepFence, type Fence } from "./markdown.js";

/** Wurzel des Workspace (packages/tooling/docs-guard/tests → 4 Ebenen hoch). */
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Wurzel, unter der die DOKU gesucht wird — überschreibbar, damit ein Korrekturvorschlag
 * in einer Kopie grün bzw. rot nachgewiesen werden kann, ohne die geteilten `README.md`
 * und `AGENTS.md` anzufassen.
 */
const DOCS_ROOT = process.env.DOCS_ROOT ?? ROOT;

/**
 * Wurzel, unter der der WORKFLOW gesucht wird — überschreibbar aus demselben Grund in der
 * Gegenrichtung: die Reality-Proben (Kommentar-Kosmetik, umbenanntes Bau-Skript, `"on":`,
 * zusätzlicher Trigger) verändern `ci.yml`, und in diesem Worktree arbeiten mehrere.
 * Im normalen Lauf zeigt beides auf das echte Repo.
 */
const WORKFLOW_ROOT = process.env.WORKFLOW_ROOT ?? ROOT;

interface Doc {
  readonly label: string;
  readonly text: string;
}

const DOCS: readonly Doc[] = ["README.md", "AGENTS.md"].map((label) => ({
  label,
  text: readFileSync(join(DOCS_ROOT, label), "utf8"),
}));

const README = readFileSync(join(DOCS_ROOT, "README.md"), "utf8");

const SECTION = section(README, /^#{2,4}\s+Contract-Bump/, "README.md");

/* ──────────────────────────── Anker: die Workflow-Datei ──────────────────────────── */

/**
 * Der Workflow-Pfad, den der ABSCHNITT nennt. Kein Literal: würde die Ratsche selbst
 * `.github/workflows/ci.yml` hinschreiben, könnte die Doku auf eine beliebige andere
 * (auch nicht existierende) Datei zeigen und trotzdem grün bleiben.
 */
const WORKFLOW_REL: string = (() => {
  const hits = [
    ...new Set(
      [...SECTION.matchAll(/(?<![\w/.-])\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml/g)].map(
        (m) => m[0],
      ),
    ),
  ];
  if (hits.length === 0) {
    throw new Error(
      "README.md, Abschnitt 'Contract-Bump …' nennt keine Workflow-Datei. Der Abschnitt " +
        "erklärt, warum die CI rot ist — ohne den Verweis auf den Workflow ist die Erklärung " +
        "nicht nachprüfbar, und diese Ratsche hätte nichts zu messen.",
    );
  }
  if (hits.length > 1) {
    throw new Error(
      `README.md, Abschnitt 'Contract-Bump …' nennt ${hits.length} Workflow-Dateien ` +
        `(${hits.join(", ")}). Welche erzeugt den beschriebenen roten Lauf? Diese Ratsche ` +
        "kann es nicht entscheiden — und ein Maintainer beim Debuggen auch nicht.",
    );
  }
  return hits[0] as string;
})();

const WORKFLOW_EXISTS = existsSync(join(WORKFLOW_ROOT, WORKFLOW_REL));

/* ─────────────────────────────── YAML: enge Reader ───────────────────────────────── */

/**
 * Entfernt YAML-Kommentare — ganzzeilige UND nachgestellte, aber nur ausserhalb von
 * Anführungszeichen. Ein `#` ohne führenden Leerraum (z. B. in `path: a#b` oder in einer
 * URL mit Fragment) ist kein Kommentar und bleibt stehen.
 */
function bleachComments(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] as string;
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1] as string))) {
      return line.slice(0, i);
    }
  }
  return line;
}

const WORKFLOW_YAML = WORKFLOW_EXISTS
  ? readFileSync(join(WORKFLOW_ROOT, WORKFLOW_REL), "utf8")
      .split("\n")
      .map(bleachComments)
      .join("\n")
  : "";

function unquote(token: string): string {
  return token.replace(/^["']|["']$/g, "");
}

/**
 * Die unmittelbaren Kindschlüssel von `on:` — die Events, die diesen Workflow feuern.
 *
 * Bewusst eng: erkannt werden `on:` als Block-Mapping bzw. Block-Sequenz, `on: [a, b]`,
 * `on: a` und die wegen des YAML-`on`/`true`-Fallstricks übliche Schreibweise `"on":` /
 * `'on':`. ALLES andere wirft. Ein stiller leerer Rückgabewert wäre der schlimmere Fehler:
 * er machte die Trigger-Prüfung trivial wahr und die Kausalitäts-Prüfung blind.
 *
 * Einzige YAML-Stelle neben `parseSteps` — mit `js-yaml` schrumpft sie auf
 * `Object.keys(load(text).on)`.
 */
function parseTriggers(yamlText: string): string[] {
  const lines = yamlText.split("\n");
  const at = lines.findIndex((l) => /^(?:on|"on"|'on')\s*:/.test(l));
  if (at < 0) {
    throw new Error(
      `${WORKFLOW_REL} hat keinen erkennbaren \`on:\`-Schlüssel auf oberster Ebene. Ohne die ` +
        "Trigger lässt sich nicht prüfen, ob die Doku die Ursache roter Läufe richtig erklärt.",
    );
  }
  const head = /^(?:on|"on"|'on')\s*:(.*)$/.exec(lines[at] as string) as RegExpExecArray;
  const rest = (head[1] as string).trim();

  if (rest.startsWith("[")) {
    if (!rest.endsWith("]")) {
      throw new Error(
        `${WORKFLOW_REL}: mehrzeilige Flow-Sequenz hinter \`on:\` — dieser enge Reader ` +
          "beherrscht sie nicht und liefert lieber gar nichts, als still das Falsche.",
      );
    }
    return rest
      .slice(1, -1)
      .split(",")
      .map((t) => unquote(t.trim()))
      .filter((t) => t.length > 0)
      .sort();
  }
  if (rest.length > 0) {
    if (!/^["']?[A-Za-z_][A-Za-z0-9_-]*["']?$/.test(rest)) {
      throw new Error(
        `${WORKFLOW_REL}: \`on: ${rest}\` ist eine Schreibweise, die dieser enge Reader nicht ` +
          "sicher versteht (Flow-Mapping, Anker, Alias?). Er wirft, statt sie zu raten.",
      );
    }
    return [unquote(rest)];
  }

  const out: string[] = [];
  let childIndent = -1;
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.trim() === "") continue;
    const indent = (/^\s*/.exec(line) as RegExpExecArray)[0].length;
    if (indent === 0) break;
    if (childIndent === -1) childIndent = indent;
    if (indent !== childIndent) continue;
    const seq = /^\s*-\s*(\S+)\s*$/.exec(line);
    if (seq) {
      out.push(unquote(seq[1] as string));
      continue;
    }
    const key = /^\s*(["']?)([A-Za-z_][A-Za-z0-9_-]*)\1\s*:/.exec(line);
    if (key) out.push(key[2] as string);
  }
  return out.sort();
}

const TRIGGERS: readonly string[] = WORKFLOW_EXISTS ? parseTriggers(WORKFLOW_YAML) : [];

/** Bekannte GitHub-Actions-Events — nur um im Doku-Text Triggernamen von anderem
 *  Backtick-Text (`main`, `pnpm typecheck`, …) zu unterscheiden. */
const EVENT_VOCAB = new Set([
  "repository_dispatch",
  "workflow_run",
  "check_run",
  "check_suite",
  "create",
  "delete",
  "deployment",
  "fork",
  "issue_comment",
  "issues",
  "merge_group",
  "page_build",
  "pull_request",
  "pull_request_review",
  "pull_request_target",
  "push",
  "registry_package",
  "release",
  "schedule",
  "status",
  "watch",
  "workflow_call",
  "workflow_dispatch",
]);

/* ──────────────────────────────── Erhebung: Schritte ─────────────────────────────── */

interface Step {
  readonly name: string | null;
  readonly uses: string | null;
  readonly repository: string | null;
  readonly ref: string | null;
}

/**
 * Die `steps:`-Listenelemente des Workflows. Zweiter (und letzter) YAML-Zugriff; mit
 * `js-yaml` wäre das ein Durchlauf über `jobs.*.steps`.
 */
function parseSteps(yamlText: string): Step[] {
  const lines = yamlText.split("\n");
  const out: Step[] = [];
  for (let i = 0; i < lines.length; i++) {
    const head = /^(\s*)steps:\s*$/.exec(lines[i] as string);
    if (!head) continue;
    const stepsIndent = (head[1] as string).length;
    let item: string[] | null = null;
    let itemIndent = -1;
    const flush = (): void => {
      if (!item) return;
      const block = item.join("\n");
      const field = (key: string): string | null => {
        const m = new RegExp(`^\\s*(?:-\\s+)?${key}:\\s*(.+?)\\s*$`, "m").exec(block);
        return m ? unquote(m[1] as string) : null;
      };
      out.push({
        name: field("name"),
        uses: field("uses"),
        repository: field("repository"),
        ref: field("ref"),
      });
      item = null;
    };
    for (i++; i < lines.length; i++) {
      const line = lines[i] as string;
      if (line.trim() === "") {
        if (item) item.push(line);
        continue;
      }
      const indent = (/^\s*/.exec(line) as RegExpExecArray)[0].length;
      if (indent <= stepsIndent) {
        i--;
        break;
      }
      if (/^\s*-\s/.test(line) && (itemIndent === -1 || indent === itemIndent)) {
        flush();
        itemIndent = indent;
        item = [line];
      } else if (item) {
        item.push(line);
      }
    }
    flush();
  }
  return out;
}

const STEPS: readonly Step[] = WORKFLOW_EXISTS ? parseSteps(WORKFLOW_YAML) : [];

/**
 * Wie die Doku einen Schritt benennen KANN: über seinen `name`, und wenn er namenlos ist,
 * über sein `uses` ohne Version. Genau diese Zeichenketten werden im Text gesucht — damit
 * ist die Erhebung unabhängig davon, ob die Doku „…", `…` oder **…** benutzt.
 */
const STEP_REFS: readonly string[] = [
  ...new Set(
    STEPS.map((step) => step.name ?? step.uses?.split("@")[0] ?? null).filter(
      (r): r is string => r !== null,
    ),
  ),
];

const NAMED_STEP_NAMES = STEPS.map((s) => s.name).filter((n): n is string => n !== null);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Begrenzt durch Nicht-Buchstaben/-Ziffern — damit `ESLint` den Schritt `Lint` nicht trifft. */
function refRe(ref: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9ÄÖÜäöüß])${escapeRe(ref)}(?![A-Za-z0-9ÄÖÜäöüß])`);
}

/** Die Schritt-Referenzen, die dieser Text benennt. */
function refsIn(text: string): string[] {
  return STEP_REFS.filter((ref) => refRe(ref).test(text));
}

/**
 * Markdown in Blöcke zerlegen: Absätze, Überschriften und Listenpunkte je für sich, Code-
 * Fences ganz heraus. Ohne diese Trennung klebte eine Überschrift (ohne Satzzeichen) am
 * folgenden Absatz, und ein Beispiel-Codeblock lieferte Sätze, die niemand geschrieben hat.
 */
function blocks(text: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let fence: Fence | null = null;
  const flush = (): void => {
    if (current.length > 0) out.push(current.join(" "));
    current = [];
  };
  for (const line of text.split("\n")) {
    if (FENCE_LINE.test(line)) {
      flush();
      fence = stepFence(line, fence);
      continue;
    }
    if (fence !== null) continue;
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (/^\s*#{1,6}\s/.test(line) || /^\s*(?:[-*+]|\d+\.)\s/.test(line)) flush();
    current.push(line.trim());
  }
  flush();
  return out;
}

/** Absätze/Listenpunkte beider Dokumente, die vom Workflow handeln. */
interface DocBlock {
  readonly doc: string;
  readonly text: string;
}

/**
 * Ein Block handelt vom Workflow, wenn er dessen Datei oder einen echten Schrittnamen
 * nennt.
 *
 * Die Vorfassung liess zusätzlich das blosse Wort „Schritt" zählen. Das ist gefallen: es
 * ist eine Vokabel und keine Tatsache, und wer „Stufe" oder „Job" schreibt, entkommt ihr
 * ohnehin. Was hier bleibt, hängt an Zeichenketten aus dem YAML.
 */
const WORKFLOW_BLOCKS: readonly DocBlock[] = DOCS.flatMap((doc) =>
  blocks(doc.text)
    .filter((text) => text.includes(WORKFLOW_REL) || refsIn(text).length > 0)
    .map((text) => ({ doc: doc.label, text })),
);

/* ─────────────────────────────────────── Tests ───────────────────────────────────── */

describe("Doku über den CI-Workflow des Contract-Bumps", () => {
  it("nennt eine Workflow-Datei, die es wirklich gibt", () => {
    expect(
      WORKFLOW_EXISTS,
      `README.md, Abschnitt 'Contract-Bump …' verweist auf ${WORKFLOW_REL} — diese Datei gibt ` +
        "es im Repo nicht. Alles, was der Abschnitt über Schritte und Trigger sagt, ist damit " +
        "unprüfbar, und ein Maintainer sucht im Nichts.",
    ).toBe(true);
  });

  it("misst gegen einen Workflow, der Schritte UND Trigger hat", () => {
    expect(
      STEPS.length,
      `${WORKFLOW_REL} liefert keine Schritte — entweder ist der Workflow leer oder die ` +
        "Erhebung hier ist blind. In beiden Fällen prüfen die folgenden Tests nichts.",
    ).toBeGreaterThan(0);
    expect(
      TRIGGERS.length,
      `${WORKFLOW_REL} liefert keine Trigger — dann ist die Kausalitäts-Prüfung blind, und ` +
        "eine leere Erhebung darf hier nicht als Grün durchgehen.",
    ).toBeGreaterThan(0);
  });

  it("benennt im Abschnitt überhaupt Schritte des Workflows", () => {
    const named = refsIn(SECTION.replace(/\s+/g, " "));
    expect(
      named,
      `README.md, Abschnitt 'Contract-Bump …' benennt keinen einzigen Schritt aus ` +
        `${WORKFLOW_REL} (vorhanden: ${STEP_REFS.join(", ")}). Als Anleitung ` +
        "zum Debuggen eines roten Laufs taugt er dann nicht — und diese Ratsche hätte nichts " +
        "zu messen: eine leere Erhebung ist hier kein Grün.",
    ).not.toEqual([]);
  });

  it("erfindet keine Schrittnamen", () => {
    const QUOTE_RE = /„([^„"“”]+)["“”]/g;
    const known = new Set(NAMED_STEP_NAMES);
    // Ein Zitat direkt hinter `<datei>.md →` ist ein Verweis auf einen fremden Abschnitt,
    // kein Schrittname. Beide Dokumente benutzen diese Schreibweise mehrfach.
    const CROSS_REF = /\.md\s*→\s*$/;
    const bogus = WORKFLOW_BLOCKS.flatMap((b) =>
      [...b.text.matchAll(QUOTE_RE)]
        .filter((m) => !CROSS_REF.test(b.text.slice(Math.max(0, m.index - 40), m.index)))
        .map((m) => m[1] as string)
        .filter((q) => !known.has(q))
        .map((q) => `${b.doc}: „${q}"`),
    );
    expect(
      [...new Set(bogus)],
      `Doku nennt in einem Absatz über den Workflow Schritte, die es in ${WORKFLOW_REL} nicht ` +
        `gibt: ${bogus.join(", ")}. Vorhanden sind: ${NAMED_STEP_NAMES.join(", ")}.`,
    ).toEqual([]);
  });

  it("nennt das fremde Repo und den Ref, die der Workflow wirklich auscheckt", () => {
    const missing = STEPS.filter((s) => s.repository !== null).flatMap((s) =>
      [s.repository, s.ref].filter((v): v is string => v !== null && !SECTION.includes(v)),
    );
    expect(
      missing,
      `README.md, Abschnitt 'Contract-Bump …' nennt nicht, woher der Vertrag kommt — in ` +
        `${WORKFLOW_REL} steht: ${missing.join(", ")}. Ohne Repo und Ref kann ein Maintainer ` +
        "nicht nachsehen, ob die vermissten Typen dort schon liegen.",
    ).toEqual([]);
  });
});

describe("Doku über die Ursache roter Läufe", () => {
  it("nennt genau die Trigger des Workflows", () => {
    const named = [
      ...new Set(
        [...SECTION.matchAll(/`([a-z_]+)`/g)]
          .map((m) => m[1] as string)
          .filter((t) => EVENT_VOCAB.has(t)),
      ),
    ].sort();
    expect(
      named,
      named.length === 0
        ? `README.md, Abschnitt 'Contract-Bump …' nennt keinen einzigen Trigger. Er erklärt, ` +
            `warum die CI rot wird — ohne die Trigger (${TRIGGERS.join(", ")}) bleibt offen, ` +
            "wodurch ein Lauf überhaupt entsteht, und genau daran hängt die ganze Erklärung."
        : `README.md, Abschnitt 'Contract-Bump …' nennt andere Trigger, als ${WORKFLOW_REL} hat.`,
    ).toEqual([...TRIGGERS]);
  });
});
