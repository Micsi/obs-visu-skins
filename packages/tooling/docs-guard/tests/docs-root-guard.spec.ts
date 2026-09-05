// Ratsche gegen die EIGENEN Notausgänge dieses Pakets.
//
// ══ Der Fehler, gegen den sie steht
//
// Die Specs dieses Pakets lesen die Doku über einen überschreibbaren Wurzelpfad:
//
//     const DOCS_ROOT = process.env.DOCS_ROOT ?? <Repo-Wurzel>;
//
// Inzwischen ist eine zweite dazugekommen (`WORKFLOW_ROOT`, damit eine Reality-Probe
// den Workflow variieren kann, ohne `ci.yml` im geteilten Worktree anzufassen). Diese
// Datei zählt deshalb keine Namen auf, sondern ERHEBT jeden Override, den ein Spec
// liest — sonst hätte die dritte Variable die Prüfung wieder nicht.
//
// Das ist beim Bauen unverzichtbar — nur so lässt sich ein Korrekturvorschlag
// isoliert grün fahren, ohne die echte Doku anzufassen, an der gleichzeitig andere
// arbeiten. Es ist zugleich ein **Bypass**: ist die Variable in einem CI-Lauf
// gesetzt, messen ALLE Doku-Ratschen dieses Pakets gegen beliebige Dateien, und der
// Lauf ist grün, ohne dass irgendjemand die echte Doku geprüft hätte.
//
// Ein Wächter, der sich über eine Umgebungsvariable abschalten lässt, ist keiner.
// Deshalb steht der Notausgang nur der Werkbank offen, nie der CI.
//
// ══ Gegenproben, beide gefahren
//
// 1. `CI=true DOCS_ROOT=<kopie> vitest run tests/docs-root-guard.spec.ts` →
//    In einem CI-Lauf sind Notausgaenge gesetzt. Damit messen die Ratschen dieses Pakets
//    nicht mehr das Repo, sondern beliebige Dateien — und der Lauf ist gruen, ohne dass
//    irgendjemand die echte Doku oder den echten Workflow geprueft hat. Die Notausgaenge
//    sind zum Bauen da, nicht zum Bestehen.: expected [ …(5) ] to deeply equal []
//
// 2. In einer Sandbox-Kopie jedes `process.env.DOCS_ROOT`/`WORKFLOW_ROOT` aus den Specs
//    entfernt →
//    Kein Spec dieses Pakets liest mehr einen Umgebungs-Override. Entweder sind sie
//    entfallen (dann kann diese Datei weg) oder sie heissen jetzt anders (dann bewacht
//    sie nichts mehr).: expected [] to not deeply equal []
//
// ══ Was diese Ratsche NICHT prueft
//
// Ob der Notausgang beim Bauen RICHTIG benutzt wurde — ob die Kopie unter `DOCS_ROOT`
// also wirklich die Doku dieses Repos war und nicht eine gefaellige Erfindung. Das kann
// sie nicht sehen; sie sichert nur die Grenze, an der es zaehlt: in einem CI-Lauf ist
// kein Override gesetzt, und es gibt ueberhaupt welche.
//
// ══ Warum hier und nicht in jedem Spec
//
// Sechs Specs teilen den Notausgang. Eine Prüfung je Spec wäre sechsmal dieselbe
// Zeile — und die siebte, die jemand morgen schreibt, hätte sie nicht. Diese Datei
// prüft die Voraussetzung EINMAL für alle: sie erhebt selbst, welche Specs den
// Notausgang benutzen, und fällt, wenn einer dazukommt, ohne dass die Grenze gilt.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");

/** Die Spec-Dateien dieses Pakets — erhoben, nicht aufgezählt. */
function specFiles(): string[] {
  // `--cached --others --exclude-standard`: verfolgte UND neue, noch nicht
  // eingecheckte Dateien. Ohne `--others` sieht diese Ratsche das eigene Paket nicht,
  // solange es untracked ist — und meldete dann fälschlich, der Notausgang sei
  // entfallen. (Genau so ist sie beim ersten Lauf gefallen.)
  const out = execFileSync(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "packages/tooling/docs-guard/tests",
    ],
    {
      cwd: REPO,
      encoding: "utf8",
    },
  );
  return out
    .split("\0")
    .filter((p) => p.endsWith(".spec.ts"))
    .filter((p) => !p.endsWith("docs-root-guard.spec.ts"));
}

/**
 * Jeder Umgebungs-Override, den irgendein Spec liest — erhoben, nicht aufgezählt.
 *
 * `CI` selbst ist keiner: die Variable STEUERT die Grenze, sie umgeht sie nicht.
 */
const STEERING = new Set(["CI"]);

const OVERRIDES: { readonly name: string; readonly spec: string }[] = [];
for (const p of specFiles()) {
  const src = readFileSync(join(REPO, p), "utf8");
  for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
    const name = m[1] as string;
    if (STEERING.has(name)) continue;
    if (!OVERRIDES.some((o) => o.name === name && o.spec === p)) OVERRIDES.push({ name, spec: p });
  }
}

describe("der Notausgang DOCS_ROOT steht nur der Werkbank offen", () => {
  it("keiner ist in einem CI-Lauf gesetzt", () => {
    // `CI` setzen GitHub Actions und praktisch jeder andere Dienst.
    const inCi =
      process.env.CI !== undefined && process.env.CI !== "" && process.env.CI !== "false";
    const set = OVERRIDES.filter((o) => {
      const v = process.env[o.name];
      return v !== undefined && v !== "";
    });
    expect(
      inCi ? set.map((o) => `${o.name} (gelesen in ${o.spec})`) : [],
      `In einem CI-Lauf sind Notausgaenge gesetzt. Damit messen die Ratschen dieses ` +
        `Pakets nicht mehr das Repo, sondern beliebige Dateien — und der Lauf ist gruen, ` +
        `ohne dass irgendjemand die echte Doku oder den echten Workflow geprueft hat. ` +
        `Die Notausgaenge sind zum Bauen da, nicht zum Bestehen.`,
    ).toEqual([]);
  });

  it("es gibt ueberhaupt welche (sonst bewacht diese Datei nichts)", () => {
    // Ohne diese Zeile waere die Ratsche gruen, wenn die Notausgaenge verschwinden —
    // und niemand merkte, dass sie seitdem nichts mehr sichert.
    expect(
      OVERRIDES.map((o) => o.name),
      "Kein Spec dieses Pakets liest mehr einen Umgebungs-Override. Entweder sind sie " +
        "entfallen (dann kann diese Datei weg) oder sie heissen jetzt anders (dann bewacht " +
        "sie nichts mehr).",
    ).not.toEqual([]);
  });
});
