// Ratsche gegen zwei frei formulierte Fassungen derselben Goldenen Regeln.
//
// ══ Der Fehler, gegen den sie steht
//
// `AGENTS.md` sagt einem Agenten, wo die verbindlichen Konventionen wohnen:
//
//   | `README.md` | … **Goldene Regeln** (verbindlich) … |
//   Die Goldenen Regeln stehen **nur** im README — sie hier zu wiederholen hiesse,
//   zwei Fassungen zu pflegen, die auseinanderdriften.
//
// Das „nur" stimmt nicht. `docs/authoring-skins.md` — in derselben Tabelle als
// Pflichtlektüre geführt — hat einen Abschnitt „Goldene Regeln (immer)" mit einer
// eigenen, frei formulierten Liste: kein State, Adressierung über den Typ-Schlüssel,
// `unsupported` als Pflicht, AA. Die versprochene einzige Quelle existiert also nicht,
// und die beiden Fassungen sind bereits auseinander:
//
//   * Das README führt sieben Regeln, der Guide vier. Es fehlen dort „Kein Datenfork",
//     „Reihenfolge + Gruppierung als Layout-Boden" und „Daten als JSON, Verhalten als
//     TS/JS" — ausgerechnet der Layout-Boden, den der Guide weiter unten ausführlich
//     bespricht (`order`/`grouping` als `layoutHonors`).
//   * Beide Listen sind von 1 an durchnummeriert, aber verschieden. Der Guide verweist
//     im Fliesstext dreimal auf „Goldene Regel 3"/„Goldene Regel 4" — und welche Regel
//     das ist, hängt davon ab, welche Liste der Leser gerade vor sich hat. Unter der
//     Guide-Nummerierung ist Regel 4 die AA-Pflicht, unter der des README ist es „Der
//     Skin besitzt nie State". Die Stelle bei `navTree` meint sichtbar die zweite.
//
// ══ Die Entscheidung: Vorrang festschreiben, nicht das Duplikat löschen
//
// Der Befund lässt beide Wege offen. Gewählt ist der zweite — Vorrang plus Ratsche —
// aus drei Gründen:
//
//   1. Der Guide ist als durchgehende Anleitung geschrieben, die jemand beim ersten Skin
//      von oben nach unten liest. Ein Verweis „die Regeln stehen woanders" an Position 1
//      schickt genau diesen Leser weg, bevor er angefangen hat.
//   2. Die Wiedergabe ist nicht redundant, sie ist angereichert: `d.x = …`,
//      `data-action`, `tiles[type]`, der `a11y`-Block. Diese Praxis gehört in den Guide
//      und nicht ins README, das die Regel abstrakt formuliert.
//   3. Die drei Fliesstext-Verweise auf „Goldene Regel N" brauchen ohnehin EINE gültige
//      Nummerierung. Bindet man die Wiedergabe an die Nummern des README, werden sie
//      eindeutig — und zwar ohne ihre Aussage anzufassen, denn unter der README-Zählung
//      meinen sie bereits die richtige Regel.
//
// Der Preis ist die Driftgefahr, und genau die ist der Befund. Deshalb ist der Vorrang
// hier keine Zusage in Prosa, sondern eine Form, die sich messen lässt. Sie ist im Guide
// selbst ausgeschrieben, damit ein Autor sie kennen kann, und lautet:
//
//   * Jeder Punkt der Wiedergabe beginnt mit `**Regel <n>** · ` und danach wörtlich mit
//     dem Satz aus dem README; die eigene Erläuterung folgt erst dahinter.
//   * Jeder Verweis im Fliesstext lautet `(Goldene Regel <n>: **<Wortlaut>**)` — Nummer
//     UND Wortlaut, denn die Nummer allein wird bei einer Umnummerierung still falsch.
//
// ══ Was geprüft wird — und was bewusst nicht
//
// Nichts an den Regeln steht in dieser Datei. Erhoben wird aus dem Repo:
//
//   Dokumentenmenge — alle von Git verfolgten `*.md`. Zwei Pfade, die dieselbe Datei
//   sind, zählen einmal: `CLAUDE.md` ist ein Symlink auf `AGENTS.md`, und zwei
//   Meldungen über denselben Text wären nur Lärm. Entschieden wird das an der IDENTITÄT
//   (Symlink-Ziel bzw. byte-gleicher Inhalt), NICHT am Git-Modus. Der Unterschied ist
//   kein Feinschliff: wer `CLAUDE.md` als echte Datei mit altem Inhalt eincheckt, hat
//   genau die zweite Fassung hergestellt, gegen die diese Datei steht — am Modus wäre
//   sie unsichtbar, an der Identität fällt sie auf.
//
//   Fassungsart — pro Abschnitt aus der Form abgeleitet, nicht aus einer Liste hier:
//   trägt JEDER Listenpunkt einen Anker `**Regel <n>** · …`, ist es eine Wiedergabe;
//   trägt KEINER einen, ist es eine Originalfassung; hat der Abschnitt gar keine
//   Listenpunkte, ist es ein blosser Verweis. Der Weg „Duplikat entfernen" bleibt damit
//   ausdrücklich offen: ein Abschnitt, der nur noch aufs README zeigt, ist grün, und ein
//   ganz gelöschter Abschnitt fällt aus der Menge. Diese Ratsche bewacht die Invariante
//   („es gibt genau eine verbindliche Fassung, jede Wiedergabe ist an sie gebunden"),
//   nicht eine bestimmte Lösung.
//
// ══ Was diese Ratsche NICHT prüft
//
// **Eine Zweitfassung, die auf Auszeichnung verzichtet.** Die Vorfassung hatte dagegen
// eine Prüfung: mehr als eine fettgesetzte Behauptung (`**…**`) in einem Absatz eines
// nicht-verbindlichen Abschnitts galt als „Aufzählung ohne Aufzählungszeichen". Sie ist
// gefallen. Sie liest einen Betonungsmarker, und der ist reine Schreibweise: dieselben
// vier Regeln ohne Fettsatz, als Tabelle, oder mit `<b>` statt `**` gehen glatt durch.
// Umgekehrt macht sie einen völlig harmlosen Absatz mit zwei hervorgehobenen Begriffen
// rot. Beide Irrtümer sind Umformulierungen, keine Sachfragen.
//
// Was diesen Fall trägt, ist die Prüfung darunter, und sie ist nicht formabhängig: wer
// zwei Regelsätze WÖRTLICH aus dem README übernimmt, ohne sie zu binden, fällt auf —
// egal ob als Liste, als Absatz oder in einer Tabelle.
//
// **Ob ein deutscher Satz Vorrang BEHAUPTET.** Die prüfbare Aussage ist schmaler und
// wird hier auch nur als solche geführt: dass jede nicht-verbindliche Fassung die
// verbindliche beim DATEINAMEN nennt, und dass ihre Regeln wörtlich mit der Vorlage
// BEGINNEN. Dieses „beginnen" ist die Grenze: ein angehängter Nachsatz kann zurücknehmen,
// was der zitierte Satz gibt. Gefahren und nicht abgefangen: „**Regel 4** · **Der Skin
// besitzt nie State.** Das gilt allerdings nur für den Erst-Render: bei Animationen darfst
// du `d.x = …` setzen" bleibt grün. Ob ein Folgesatz eine Regel aushöhlt, ist eine
// Bedeutungsfrage; eine Wortliste („allerdings", „Ausnahme") wäre geraten statt gemessen.
// Was die Ratsche dafür leistet, ist das Gegenteil: die zitierte Vorlage kann nicht mehr
// still umformuliert werden.
//
// **Eine Paraphrase in eigenen Worten.** Fassungen werden an drei Merkmalen gefunden — an
// der Überschrift (tolerant, jede Beugung, an beliebiger Stelle der Zeile), an wörtlich
// übernommenen Regelsätzen und an zitierten Regelnummern. Wer die Regeln unter „Was immer
// gilt" neu erzählt, entkommt allen dreien. Das bliebe nur mit einem Bedeutungsvergleich
// zu fassen, und der gehört nicht in eine Ratsche.
//
// **Dass die Wiedergabe die RICHTIGE Teilmenge wählt.** Welche der sieben Regeln ein Autor
// beim ersten Skin braucht, ist eine redaktionelle Frage. Prüfbar ist nur, dass jede
// gewählte Regel es wirklich gibt und wörtlich stimmt.
//
// **Dass die verbindliche Fassung überhaupt Regeln führt.** Diese Zeile stand hier als
// Erhebungs-Wächter und war eine TOTE Ratsche: `kind === "origin"` setzt bereits
// `items.length > 0` voraus (ohne Listenpunkte ist ein Abschnitt ein `pointer`), also
// hat `ORIGIN` per Konstruktion immer Punkte, und die Zusicherung konnte nie fallen.
// Gegenprobe gefahren — die Regelliste des README zu Fliesstext gemacht: der Abschnitt
// wird zum `pointer`, `ORIGINS` ist leer, `ORIGIN` ist `null`, und der Test stieg vor
// seiner Assertion aus. Rot wurde stattdessen „führt die Regeln in genau einem Dokument
// frei aus", und genau die trägt den Fall auch.
//
// ══ Gegenproben (alle gefahren, echte Meldungen)
//
// 1–8 laufen gegen eine Kopie der drei Dokumente unter `DOCS_ROOT`; 9 und 10 brauchen
// eine eigene Dokumentenmenge und laufen in einer Sandbox-Kopie des Repos mit eigenem
// `git`-Index (`git ls-files` fragt immer das echte Repo, nicht `DOCS_ROOT`).
//
// 1. Im Guide einem Punkt den Anker genommen (`- **Regel 3** · …` → `- …`) →
//    Diese Dokumente mischen verankerte und freie Regeln in einer Liste. Dann ist nicht
//    entscheidbar, welche Punkte an die verbindliche Fassung gebunden sind und welche
//    eigene Behauptungen aufstellen — und genau in dieser Lücke driftet es.:
//    expected [ 'docs/authoring-skins.md' ] to deeply equal []
//
// 2. Im Guide ALLE Anker entfernt — die Wiedergabe wird zur zweiten Originalfassung →
//    2 Dokumente führen eine eigene, verbindlich gemeinte Fassung der Goldenen Regeln:
//    README.md, docs/authoring-skins.md. Nur eine kann gelten — die andere bindet ihre
//    Punkte als '**Regel <n>** · <Wortlaut der Vorlage>' an sie oder verweist bloss auf sie.
//
// 3. Aus dem Guide-Abschnitt den Verweis auf `README.md` entfernt →
//    docs/authoring-skins.md gibt die Goldenen Regeln wieder, nennt im Abschnitt aber
//    nicht die verbindliche Fassung (README.md). Wer nur dieses Dokument liest, hält die
//    Wiedergabe für die Regel.
//
// 4. Ein Wort im wiedergegebenen Wortlaut geändert („nach Typ adressiert" → „anhand des
//    Typs adressiert") →
//    docs/authoring-skins.md, Regel 2 gibt README.md nicht wörtlich wieder.
//      README.md: **Renderer werden nach Typ adressiert** …
//      docs/authoring-skins.md: **Renderer werden anhand des Typs adressiert** …
//
// 5. Eine erfundene achte Regel als EINGERÜCKTER Unterpunkt angehängt →
//    docs/authoring-skins.md: der Anker '**Regel 8**' steht nicht am Anfang eines
//    Listenpunkts der obersten Ebene im Abschnitt 'Goldene Regeln'. Als Unterpunkt oder
//    mitten im Fliesstext wird er von keiner Wortlautprüfung erreicht.
//
// 6. Im Fliesstext-Verweis den Wortlaut gegen den einer anderen Regel getauscht →
//    AGENTS.md verweist auf 'Goldene Regel 6' mit dem Wortlaut Der Skin besitzt nie State
//    — README.md führt unter 6 aber: **AA-Kontrast ist Pflicht**, auch an den
//    Tweak-Extremen.
//
// 7. In `AGENTS.md` die Zweitfassung an beiden Stellen verschwiegen (Tabellenzelle und
//    Absatz darunter) →
//    AGENTS.md verschweigt, dass diese Dokumente die Goldenen Regeln führen:
//    docs/authoring-skins.md. Wer den Wegweiser nimmt, findet die zweite Fassung erst,
//    wenn sie ihn bereits in die Irre geführt hat.
//    Nur EINE der beiden Stellen zu entschärfen ist absichtlich grün: die Zuschreibung
//    wird auf Absatz-, nicht auf Zeilenebene gemessen. Woran ein Umbruch entscheidet, darf
//    kein Gate hängen.
//
// 8. In `AGENTS.md` einem Dokument ohne Regelabschnitt die Regeln zugeschrieben →
//    AGENTS.md schreibt diesen Dokumenten die Goldenen Regeln zu, obwohl sie keinen
//    solchen Abschnitt (mehr) haben: packages/skins/ionic/fonts/MANROPE-PROVENANCE.md.
//
// 9. In der Sandbox ein neues `docs/spickzettel.md` angelegt, das drei Regelsätze
//    wörtlich aus dem README übernimmt — ohne Abschnittsüberschrift, ohne Anker →
//    docs/spickzettel.md gibt 3 Regelsätze aus README.md wörtlich wieder, ohne sie zu
//    binden: nach typ adressiert · der skin besitzt nie state. · aa-kontrast ist pflicht.
//    Eine Wiedergabe gehört in einen Abschnitt 'Goldene Regeln' und trägt je Punkt
//    '**Regel <n>** · '.
//
// 10. In der Sandbox jede Überschrift „Goldene Regeln" in „Grundsätze" umbenannt →
//    Kein verfolgtes Markdown-Dokument führt einen Abschnitt 'Goldene Regeln'. Entweder
//    sind die Regeln verschwunden, oder diese Erhebung ist blind.
//
// 11. GEGENPROBE ZUR GEGENPROBE, und der Grund für eine Streichung: die Regelliste des
//    README zu Fliesstext gemacht, um die Zusicherung „die verbindliche Fassung führt
//    überhaupt Regeln" rot zu bekommen. Sie blieb GRÜN (12 von 13 Tests grün, rot wurde
//    nur „führt die Regeln in genau einem Dokument frei aus"). Die Zusicherung war eine
//    tote Ratsche und ist entfernt — Begründung unten unter „Was diese Ratsche NICHT
//    prüft".
//
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FENCE_LINE, stepFence, type Fence } from "./markdown.js";

/** Wurzel des Repos (packages/tooling/docs-guard/tests → 4 Ebenen hoch). */
const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/**
 * Wurzel, aus der die DOKUMENTE gelesen werden — überschreibbar.
 *
 * Getrennt von `ROOT`, weil beides verschiedene Rollen hat: `git ls-files` fragt immer
 * das echte Repo (welche Dokumente gibt es?), der Textvergleich darf gegen einen
 * Arbeitsstand laufen. Genau so lässt sich der grüne Beweis einer Doku-Korrektur führen,
 * ohne die Dokumente im Worktree anzufassen. Fehlt eine Datei unter `DOCS_ROOT`, gilt
 * die des Repos — eine Teilkopie mit nur den geänderten Dokumenten genügt also.
 *
 * Dass dieser Notausgang der CI verschlossen bleibt, prüft `docs-root-guard.spec.ts`
 * einmal für alle Specs dieses Pakets.
 */
const DOCS_ROOT = process.env.DOCS_ROOT ?? ROOT;

/** Pfad, unter dem ein Dokument gelesen wird: `DOCS_ROOT` wenn dort vorhanden, sonst Repo. */
function docPath(rel: string): string {
  const candidate = join(DOCS_ROOT, rel);
  return existsSync(candidate) ? candidate : join(ROOT, rel);
}

const read = (rel: string): string => readFileSync(docPath(rel), "utf8");

/** Alle von Git verfolgten `*.md`, unbereinigt. */
const TRACKED: readonly string[] = execFileSync("git", ["ls-files", "-z", "--", "*.md"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean)
  .sort();

/**
 * Zeigt `rel` als Symlink auf ein anderes verfolgtes Dokument? Dann ist es kein zweites
 * Dokument, sondern derselbe Text unter zwei Namen.
 */
function symlinkAlias(rel: string): string | null {
  let target: string;
  try {
    if (!lstatSync(docPath(rel)).isSymbolicLink()) return null;
    target = readlinkSync(docPath(rel));
  } catch {
    return null;
  }
  return posix.normalize(posix.join(posix.dirname(rel), target));
}

/**
 * Die Dokumentenmenge — Aliase zusammengefasst, entschieden an der IDENTITÄT.
 *
 * Zwei Prüfungen, beide inhaltlich: ein Symlink auf ein anderes verfolgtes Dokument, und
 * byte-gleicher Inhalt. Der Git-Modus wird NICHT benutzt: „ist als Symlink eingecheckt"
 * ist eine Aussage über die Ablage, nicht über den Text, und ein `CLAUDE.md` mit ALTEM
 * Inhalt als echte Datei ist die zweite Fassung, die diese Ratsche fangen soll.
 */
const MD_DOCS: readonly string[] = ((): string[] => {
  const tracked = new Set(TRACKED);
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const rel of TRACKED) {
    const alias = symlinkAlias(rel);
    if (alias !== null && tracked.has(alias)) continue;
    const text = read(rel);
    if (seen.has(text)) continue;
    seen.set(text, rel);
    out.push(rel);
  }
  return out;
})();

/** Inline-Code entfernen — sonst zählt eine Formangabe wie `**Regel <n>** · ` als Aussage. */
const stripCode = (s: string): string => s.replace(/`[^`]*`/g, " ");

/** Auf eine Zeile normalisieren. */
const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Wortlaut-Normalform für Vergleiche: ohne Auszeichnung, ohne Anführungszeichen, klein. */
const wording = (s: string): string =>
  s
    .replace(/[*_`„“”"»«]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Dieselbe Form, ohne `g` — für `exec` auf einem einzelnen Text (kein `lastIndex`-Zustand). */
const FIRST_BOLD_RE = /\*\*([^*]+)\*\*/;

/** Der Anker einer Wiedergabe, überall im Text gesucht. */
const INLINE_ANCHOR_RE = /\*\*Regel\s+(\d+)\*\*/g;

/** Ein Fliesstext-Verweis auf eine Regelnummer. */
const REFERENCE_RE = /Goldene[nrs]?\s+Regel\s+(\d+)/g;

/** Der Wortlaut-Anker, der unmittelbar hinter einem Verweis stehen MUSS. */
const REFERENCE_WORDING_RE = /^\s*[:·,–—-]?\s*\*\*([^*]+)\*\*/;

/**
 * Der Abschnitt „… Goldene Regeln …" eines Dokuments — bis zur nächsten Überschrift
 * gleicher oder höherer Ebene, `null`, wenn es keinen gibt.
 *
 * Die Überschrift wird TOLERANT gefunden: irgendwo in der Zeile, jede Beugung, egal ob
 * gross oder klein geschrieben. „## Die Goldenen Regeln (immer)" ist derselbe Abschnitt
 * wie „## Goldene Regeln (immer)" — an einem Artikel darf die Bindung nicht hängen.
 *
 * Zeilenweise und fence-bewusst, nicht per Regex über den ganzen Text: eine Überschrift
 * in einem Codeblock ist keine, und eine unbalancierte Fence macht den Abschnitt kaputt
 * statt ihn stillschweigend bis zum Dateiende zu dehnen — sonst zählte jeder Verweis
 * IRGENDWO im Dokument als „im Abschnitt genannt".
 *
 * Zwei gleichnamige Abschnitte in einem Dokument sind ein Wurf: welcher gälte? Diese
 * Ratsche kann es nicht entscheiden, ein Leser auch nicht.
 */
function goldenRulesSection(doc: string, text: string): string | null {
  const lines = text.split("\n");
  const heads: number[] = [];
  let fence: Fence | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (FENCE_LINE.test(line)) {
      fence = stepFence(line, fence);
      continue;
    }
    if (fence === null && /^#{1,6}\s+.*Goldene[nrs]?\s+Regeln/i.test(line)) heads.push(i);
  }
  if (fence !== null) {
    throw new Error(
      `${doc}: unbalancierte Code-Fence — die Abschnittsgrenzen dieses Dokuments sind nicht ` +
        `bestimmbar, und diese Ratsche prüfte daran nichts mehr.`,
    );
  }
  if (heads.length === 0) return null;
  if (heads.length > 1) {
    throw new Error(
      `${doc}: eine Überschrift „Goldene Regeln" steht ${heads.length}× (Zeilen ${heads.map((i) => i + 1).join(", ")}). ` +
        `Welcher Abschnitt gilt? Diese Ratsche kann es nicht entscheiden — und ein Leser auch nicht.`,
    );
  }
  const start = heads[0] as number;
  const level = (/^#+/.exec(lines[start] as string) as RegExpExecArray)[0].length;
  const nextHead = new RegExp(`^#{1,${level}}\\s`);
  let end = lines.length;
  fence = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (FENCE_LINE.test(line)) {
      fence = stepFence(line, fence);
      continue;
    }
    if (fence === null && nextHead.test(line)) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

/** Ein Block eines Abschnitts: ein Listenpunkt oder ein Absatz. */
interface Block {
  readonly kind: "item" | "prose";
  /** Einrückung des Listenzeichens; `0` = oberste Ebene. */
  readonly indent: number;
  readonly text: string;
}

/** Beginnt hier ein neuer Markdown-Block, der keine lazy continuation sein kann? */
const BLOCK_START_RE = /^\s*(?:#{1,6}\s|>|\||-{3,}\s*$|\*{3,}\s*$)/;

/**
 * Die Blöcke eines Abschnitts — Listenpunkte (auch eingerückte) und Absätze.
 *
 * Markdown-treu in zwei Punkten, die beide schon durchgerutscht sind:
 *
 *   * **lazy continuation.** Eine NICHT eingerückte Zeile direkt hinter einem
 *     Listenpunkt gehört in Markdown zu diesem Punkt. Ein `/^\s/`-Test wirft sie weg —
 *     und damit eine materielle Änderung der verbindlichen Regel, die ein Prettier-Reflow
 *     versehentlich herstellen kann. Erst eine LEERZEILE beendet den Punkt gegenüber
 *     einer nicht eingerückten Folgezeile (sonst zöge der Absatz hinter der Liste in den
 *     letzten Punkt hinein).
 *   * **verschachtelte Punkte.** Ein eingerückter Listenpunkt ist ein eigener Punkt, kein
 *     Fortsetzungstext — sonst verschwindet eine erfundene Regel im Rumpf der vorigen.
 */
function blocksOf(section: string): readonly Block[] {
  const out: Block[] = [];
  let open: { kind: "item" | "prose"; indent: number; lines: string[] } | null = null;
  let fence: Fence | null = null;
  let blank = false;
  const flush = (): void => {
    if (open) out.push({ kind: open.kind, indent: open.indent, text: norm(open.lines.join(" ")) });
    open = null;
  };
  for (const line of section.split("\n")) {
    if (FENCE_LINE.test(line)) {
      const next = stepFence(line, fence);
      if (fence === null) flush();
      fence = next;
      blank = false;
      continue;
    }
    if (fence !== null) continue;
    if (line.trim() === "") {
      blank = true;
      continue;
    }
    const item = /^(\s*)(?:\d+[.)]|[-*+])\s+/.exec(line);
    if (item) {
      flush();
      open = {
        kind: "item",
        indent: (item[1] as string).length,
        lines: [line.slice(item[0].length)],
      };
      blank = false;
      continue;
    }
    const indented = /^\s/.test(line);
    if (open && !BLOCK_START_RE.test(line) && (indented || !blank)) {
      open.lines.push(line.trim());
      blank = false;
      continue;
    }
    flush();
    open = { kind: "prose", indent: 0, lines: [line.trim()] };
    blank = false;
  }
  flush();
  return out;
}

/** Ein Regelpunkt der obersten Ebene. */
interface RuleItem {
  /** Nummer aus dem Anker `**Regel <n>** · …`, oder `null` bei einer Originalfassung. */
  readonly ref: number | null;
  /** Der Text hinter dem Anker (bzw. der ganze Punkt). */
  readonly body: string;
}

/** `**Regel 4** · …` — Trennzeichen bewusst grosszügig, der Anker ist die Nummer. */
const ANCHOR_RE = /^\*\*Regel\s+(\d+)\*\*\s*[·:.–—-]?\s*(.*)$/s;

interface RuleDoc {
  readonly doc: string;
  readonly section: string;
  readonly items: readonly RuleItem[];
  /** `origin` = eigene Fassung, `restatement` = wörtliche Wiedergabe, `pointer` = nur Verweis. */
  readonly kind: "origin" | "restatement" | "pointer" | "mixed";
}

const RULE_DOCS: readonly RuleDoc[] = MD_DOCS.flatMap((doc) => {
  const section = goldenRulesSection(doc, read(doc));
  if (section === null) return [];
  const blocks = blocksOf(section);
  const items = blocks
    .filter((b) => b.kind === "item" && b.indent === 0)
    .map((b): RuleItem => {
      const m = ANCHOR_RE.exec(b.text);
      return m
        ? { ref: Number(m[1]), body: norm(m[2] as string) }
        : { ref: null, body: norm(b.text) };
    });
  const anchored = items.filter((i) => i.ref !== null).length;
  const kind =
    items.length === 0
      ? "pointer"
      : anchored === 0
        ? "origin"
        : anchored === items.length
          ? "restatement"
          : "mixed";
  return [
    {
      doc,
      section,
      items,
      kind,
    } as RuleDoc,
  ];
});

const ORIGINS = RULE_DOCS.filter((d) => d.kind === "origin");
const DERIVED = RULE_DOCS.filter((d) => d.kind !== "origin");
const ORIGIN = ORIGINS.length === 1 ? (ORIGINS[0] as RuleDoc) : null;

describe("Goldene Regeln: genau eine verbindliche Fassung", () => {
  it("findet überhaupt einen Regelabschnitt (sonst misst die Ratsche nichts)", () => {
    expect(
      RULE_DOCS.map((d) => d.doc),
      "Kein verfolgtes Markdown-Dokument führt einen Abschnitt 'Goldene Regeln'. Entweder " +
        "sind die Regeln verschwunden, oder diese Erhebung ist blind.",
    ).not.toEqual([]);
  });

  it("hat keine Fassung, die halb Original und halb Wiedergabe ist", () => {
    const mixed = RULE_DOCS.filter((d) => d.kind === "mixed");
    expect(
      mixed.map((d) => d.doc),
      "Diese Dokumente mischen verankerte und freie Regeln in einer Liste. Dann ist nicht " +
        "entscheidbar, welche Punkte an die verbindliche Fassung gebunden sind und welche " +
        "eigene Behauptungen aufstellen — und genau in dieser Lücke driftet es.",
    ).toEqual([]);
  });

  it("führt die Regeln in genau einem Dokument frei aus", () => {
    // Der eigentliche Befund. Heute schreiben README.md und docs/authoring-skins.md je
    // eine eigene, unabhängig formulierte Liste — die versprochene einzige Quelle gibt es
    // nicht. Zwei Auswege sind zulässig und beide grün: die Zweitfassung entfernen (dann
    // bleibt ein Verweis oder gar kein Abschnitt) oder sie an die Vorlage binden
    // (`**Regel <n>** · <Wortlaut der Vorlage>`).
    expect(
      ORIGINS.map((d) => d.doc),
      `${ORIGINS.length} Dokumente führen eine eigene, verbindlich gemeinte Fassung der Goldenen ` +
        `Regeln: ${ORIGINS.map((d) => d.doc).join(", ")}. Nur eine kann gelten — die ` +
        `andere bindet ihre Punkte als '**Regel <n>** · <Wortlaut der Vorlage>' an sie ` +
        `oder verweist bloss auf sie.`,
    ).toHaveLength(1);
  });
});

describe("Goldene Regeln: jede Wiedergabe ist an die Vorlage gebunden", () => {
  it("jede nicht-verbindliche Fassung nennt die verbindliche beim Namen", () => {
    if (!ORIGIN) return; // ohne eindeutige Vorlage ist die Frage nicht gestellt
    const silent = DERIVED.filter((d) => !d.section.includes(ORIGIN.doc));
    expect(
      silent.map((d) => d.doc),
      `${silent.map((d) => d.doc).join(", ")} gibt die Goldenen Regeln wieder, nennt im ` +
        `Abschnitt aber nicht die verbindliche Fassung (${ORIGIN.doc}). Wer nur dieses ` +
        `Dokument liest, hält die Wiedergabe für die Regel.`,
    ).toEqual([]);
  });

  it("jede wiedergegebene Regel beginnt wörtlich mit ihrer Vorlage", () => {
    // Der Kern. „Nicht driften" ist als Bedeutungsvergleich nicht prüfbar — als
    // Wortlautvergleich schon: der Anker nennt die Nummer, der Text danach BEGINNT mit
    // genau dem Satz aus der Vorlage, die eigene Erläuterung folgt erst dahinter. Wer
    // eine Seite umformuliert, macht diesen Lauf rot; wer beide zugleich umformuliert,
    // hat genau das getan, was ohne Ratsche vergessen wird. Was ein Folgesatz der Regel
    // wieder nimmt, sieht dieser Vergleich nicht — die Grenze steht im Kopf der Datei.
    if (!ORIGIN) return;
    const problems: string[] = [];
    for (const d of DERIVED) {
      const seen = new Set<number>();
      for (const item of d.items) {
        if (item.ref === null) continue; // freie Punkte meldet bereits die 'mixed'-Prüfung
        const ref = item.ref;
        if (seen.has(ref)) {
          problems.push(`${d.doc} gibt dieselbe Regel mehrfach wieder: Regel ${ref}.`);
          continue;
        }
        seen.add(ref);
        const source = ORIGIN.items[ref - 1];
        if (!source) {
          problems.push(
            `${d.doc} nennt Regel ${ref}; ${ORIGIN.doc} führt nur die Regeln 1–${ORIGIN.items.length}.`,
          );
          continue;
        }
        if (!item.body.startsWith(source.body)) {
          problems.push(
            `${d.doc}, Regel ${ref} gibt ${ORIGIN.doc} nicht wörtlich wieder.\n` +
              `  ${ORIGIN.doc}: ${source.body}\n` +
              `  ${d.doc}: ${item.body}`,
          );
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("kein Anker versteckt sich ausserhalb der Wiedergabe-Liste", () => {
    // `**Regel 8** · Jeder Skin liefert eine eigene theme.json` als EINGERÜCKTER
    // Unterpunkt wurde als Fortsetzungstext der vorigen Regel gelesen — eine erfundene
    // Regel, die keine Prüfung mehr sah. Ein Anker gehört an den Anfang eines
    // Listenpunkts der obersten Ebene; überall sonst ist er eine Behauptung, die sich
    // als Wiedergabe tarnt.
    const problems: string[] = [];
    for (const doc of MD_DOCS) {
      const found = [...stripCode(read(doc)).matchAll(INLINE_ANCHOR_RE)].map((m) => Number(m[1]));
      const asItems = (RULE_DOCS.find((d) => d.doc === doc)?.items ?? [])
        .map((i) => i.ref)
        .filter((r): r is number => r !== null);
      const rest = [...found];
      for (const ref of asItems) {
        const at = rest.indexOf(ref);
        if (at >= 0) rest.splice(at, 1);
      }
      for (const ref of rest) {
        problems.push(
          `${doc}: der Anker '**Regel ${ref}**' steht nicht am Anfang eines Listenpunkts der ` +
            `obersten Ebene im Abschnitt 'Goldene Regeln'. Als Unterpunkt oder mitten im ` +
            `Fliesstext wird er von keiner Wortlautprüfung erreicht.`,
        );
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("jeder Fliesstext-Verweis trägt den Wortlaut der Regel, auf die er zeigt", () => {
    // Der wahrscheinlichste reale Driftfall: eine Regel fällt weg, alles wird
    // umnummeriert, die Anker der Wiedergabe zieht man mit — und die drei
    // „(Goldene Regel N)" im Fliesstext bleiben stehen und zeigen ab jetzt auf die
    // falsche Regel. Eine reine Bereichsprüfung (1..N) sieht das nie. Deshalb führt jeder
    // Verweis den Wortlaut mit: `(Goldene Regel 4: **Der Skin besitzt nie State**)`.
    // Verlangt wird, dass der Anker im Wortlaut der Vorlage VORKOMMT — nicht, dass er die
    // ganze Regel zitiert; ein Verweis soll lesbar bleiben.
    if (!ORIGIN) return;
    const problems: string[] = [];
    for (const doc of MD_DOCS) {
      const text = stripCode(read(doc));
      for (const m of text.matchAll(REFERENCE_RE)) {
        const n = Number(m[1]);
        const source = ORIGIN.items[n - 1];
        if (!source) {
          problems.push(
            `${doc} nennt Regel ${n}; ${ORIGIN.doc} führt nur die Regeln 1–${ORIGIN.items.length}.`,
          );
          continue;
        }
        const tail = text.slice((m.index ?? 0) + m[0].length);
        const anchor = REFERENCE_WORDING_RE.exec(tail);
        if (!anchor) {
          problems.push(
            `${doc} verweist auf 'Goldene Regel ${n}' ohne Wortlaut-Anker. Verlangt ist ` +
              `'(Goldene Regel ${n}: **<Wortlaut aus ${ORIGIN.doc}>**)' — eine blosse Nummer ` +
              `wird bei der nächsten Umnummerierung still falsch.`,
          );
          continue;
        }
        const quoted = wording(anchor[1] as string);
        if (!wording(source.body).includes(quoted)) {
          problems.push(
            `${doc} verweist auf 'Goldene Regel ${n}' mit dem Wortlaut ${norm(anchor[1] as string)} — ` +
              `${ORIGIN.doc} führt unter ${n} aber: ${source.body}`,
          );
        }
      }
    }
    expect([...new Set(problems)], [...new Set(problems)].join("\n")).toEqual([]);
  });

  it("kein Dokument übernimmt Regelsätze wörtlich, ohne sie zu binden", () => {
    // Der Copy-Paste-Weg in ein neues Dokument: die Regeln stehen plötzlich in
    // `docs/irgendwas.md`, ohne Abschnittsüberschrift und ohne Anker. Gemessen wird die
    // Kernaussage jeder Regel — ihre erste fettgesetzte Stelle. Zwei davon in einem
    // Dokument, gebunden an nichts, sind eine zweite Fassung im Werden.
    //
    // Abgezogen wird, was bereits gebunden IST: die Punkte der Wiedergabe und die
    // Wortlaut-Anker der Fliesstext-Verweise. Sonst meldete ausgerechnet die korrekte
    // Bindung sich selbst.
    if (!ORIGIN) return;
    const captions = ORIGIN.items
      .map((i) => FIRST_BOLD_RE.exec(i.body)?.[1] ?? "")
      .map(wording)
      .filter((c) => c.length >= 15);
    const problems: string[] = [];
    for (const doc of MD_DOCS) {
      if (doc === ORIGIN.doc) continue;
      const bound = RULE_DOCS.find((d) => d.doc === doc);
      // Auf einer Zeile vergleichen: die Punkte der Wiedergabe sind normalisiert, der
      // Dateitext ist umbrochen — ohne das griffe kein Abzug.
      let text = norm(read(doc));
      for (const item of bound?.items ?? []) text = text.split(item.body).join(" ");
      text = wording(text.replace(/Goldene[nrs]?\s+Regel\s+\d+\s*[:·,–—-]?\s*\*\*[^*]+\*\*/g, " "));
      const hits = captions.filter((c) => text.includes(c));
      if (hits.length >= 2) {
        problems.push(
          `${doc} gibt ${hits.length} Regelsätze aus ${ORIGIN.doc} wörtlich wieder, ohne sie ` +
            `zu binden: ${hits.join(" · ")}. Eine Wiedergabe gehört in einen Abschnitt ` +
            `'Goldene Regeln' und trägt je Punkt '**Regel <n>** · '.`,
        );
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});

/**
 * Textabschnitte eines Dokuments für die Zuschreibungs-Prüfung.
 *
 * Absätze, nicht Zeilen: ob „`docs/authoring-skins.md`" und „Goldene Regeln" auf
 * DERSELBEN physischen Zeile landen, entscheidet der Zeilenumbruch von Prettier — daran
 * darf kein Gate hängen. Tabellenzeilen bleiben dagegen einzeln, denn eine Tabellenzeile
 * IST in Markdown genau eine Zeile und kann nicht umbrochen werden; würde man die Tabelle
 * als einen Absatz nehmen, genügte es, dass irgendeine ANDERE Zeile die Regeln erwähnt.
 */
function attributionUnits(text: string): readonly string[] {
  const units: string[] = [];
  let para: string[] = [];
  let fence: Fence | null = null;
  const flush = (): void => {
    if (para.length > 0) units.push(norm(para.join(" ")));
    para = [];
  };
  for (const line of text.split("\n")) {
    if (FENCE_LINE.test(line)) {
      fence = stepFence(line, fence);
      flush();
      continue;
    }
    if (fence !== null) continue;
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (/^\s*\|/.test(line)) {
      flush();
      units.push(norm(line));
      continue;
    }
    para.push(line);
  }
  flush();
  return units;
}

/**
 * Dokumente, die die Goldenen Regeln einem anderen Dokument ZUSCHREIBEN — erhoben, nicht
 * an `"AGENTS.md"` festgenagelt.
 *
 * Der Dateiname im Spec war die eigentliche Lücke: `CLAUDE.md` als echte Datei mit dem
 * alten AGENTS-Inhalt eingecheckt („die Regeln stehen NUR im README") lief grün durch,
 * weil hier nur eine einzige Datei gemessen wurde. Wer einen Wegweiser aufstellt, wird
 * an ihm gemessen — wer keinen aufstellt, kommt hier gar nicht vor.
 */
const ATTRIBUTIONS: readonly { readonly doc: string; readonly units: readonly string[] }[] =
  MD_DOCS.map((doc) => ({
    doc,
    units: attributionUnits(read(doc)).filter(
      (u) => /Goldene[nrs]?\s+Regeln/i.test(u) && MD_DOCS.some((d) => d !== doc && u.includes(d)),
    ),
  })).filter((a) => a.units.length > 0);

describe("die Wegweiser schreiben die Regeln den richtigen Dokumenten zu", () => {
  it("es gibt überhaupt einen Wegweiser (sonst misst dieser Block nichts)", () => {
    expect(
      ATTRIBUTIONS.map((a) => a.doc),
      "Kein Dokument schreibt die Goldenen Regeln irgendeinem Dokument zu. Dann ist die " +
        "Lesetabelle verschwunden — oder diese Erhebung ist blind.",
    ).not.toEqual([]);
  });

  it("verschweigt kein Dokument, das die Regeln führt", () => {
    // Genau der Befund an der Lesetabelle: `docs/authoring-skins.md` steht dort als
    // Pflichtlektüre, aber ohne den Hinweis, dass es die Regeln (wenn auch nicht
    // verbindlich) mitbringt — während der Satz daneben behauptet, sie stünden nur im
    // README. Ein halber Wegweiser ist schlimmer als keiner: er führt in die Irre.
    const problems: string[] = [];
    for (const a of ATTRIBUTIONS) {
      const hidden = RULE_DOCS.map((d) => d.doc).filter(
        (doc) => doc !== a.doc && !a.units.some((u) => u.includes(doc)),
      );
      if (hidden.length > 0) {
        problems.push(
          `${a.doc} verschweigt, dass diese Dokumente die Goldenen Regeln führen: ${hidden.join(", ")}. ` +
            `Wer den Wegweiser nimmt, findet die zweite Fassung erst, wenn sie ihn bereits in ` +
            `die Irre geführt hat.`,
        );
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("schreibt die Regeln keinem Dokument zu, das sie nicht führt", () => {
    // Der Rückfall in die andere Richtung: die Zeile bleibt stehen, der Abschnitt ist weg.
    // Nur verfolgte Dokumente DIESES Repos werden gemessen — `CONTRIBUTING-visu.md` liegt
    // im obs-Repo und ist von hier aus nicht prüfbar.
    const rulesDocs = new Set(RULE_DOCS.map((d) => d.doc));
    const problems: string[] = [];
    for (const a of ATTRIBUTIONS) {
      const stale = MD_DOCS.filter(
        (doc) => doc !== a.doc && !rulesDocs.has(doc) && a.units.some((u) => u.includes(doc)),
      );
      if (stale.length > 0) {
        problems.push(
          `${a.doc} schreibt diesen Dokumenten die Goldenen Regeln zu, obwohl sie keinen ` +
            `solchen Abschnitt (mehr) haben: ${stale.join(", ")}.`,
        );
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
