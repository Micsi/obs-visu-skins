// @obs-visu-skins/conformance — Konformitäts-Generator (ARCHITECTURE.md §2, CONTRACT-v1.md §8).
//
// Prüft einen Skin (manifest.json + tiles-Renderer-Map) gegen die Vertrags-Kern-Typen
// und erzeugt einen `SupportReport` (support.json). Der Generator asseriert NIE selbst —
// er rechnet aus, was der Skin ehrlich deklariert hat, gegen das, was tatsächlich
// verdrahtet ist, und gegen das, was der Vertrag kennt.
//
// gap-hart (golden rule 3): Für jeden CoreWidgetType …
//   • in manifest.unsupported  → "unsupported" (deklariert, OK)
//   • in widgets deklariert, aber KEIN tiles-Renderer               → "gap"
//   • tiles-Renderer vorhanden, aber NICHT in widgets deklariert    → "gap"
//   • beides vorhanden → jede Vertrags-Fixture des Typs wird headless durch den
//     Renderer gejagt:
//       – wirft der Renderer                        → "broken"
//       – kennt der Vertrag keine Aktion (sensor)   → "display"
//       – keine der kanonischen Aktionen verdrahtet → "display"
//       – alle kanonischen Aktionen verdrahtet      → "full"
//       – ein Teil verdrahtet                       → "partial"
// `gap` und `broken` sind Fehler: hasGap === true → CLI Exit-Code != 0.
//
// Die kanonischen Aktionen je Typ kommen aus contract.schema.json (§6) — nicht aus
// einer Kopie im Tooling. Bumpt der Vertrag einen Typ oder eine Aktion, verschiebt
// sich die Stufe hier automatisch mit.

import {
  fixtures as contractFixtures,
  schema as contractSchema,
  version as contractVersion,
  type CoreWidgetType,
  type Renderer,
  type SkinManifest,
  type SupportReport,
  type SupportWidgetEntry,
} from "@obs/visu-contract";
import { ctxStub, tokensStub } from "./stubs.js";

// Die Fixture-Wand nutzt denselben Ctx-/Tokens-Stub wie dieser Lauf — Wand und
// support.json sollen dieselbe Prüfung zeigen, nicht zwei Nachbildungen.
export { ctxStub, tokensStub } from "./stubs.js";

/** Die neun stabilen Kern-Typen (v1.2: + media/camera, v1.4: + climate) — Prüfgrundlage des Generators. */
export const CORE_WIDGET_TYPES: readonly CoreWidgetType[] = [
  "light",
  "switch",
  "blind",
  "jalousie",
  "sensor",
  "scene",
  "media",
  "camera",
  "climate",
];

/** Eine partielle Map über Kern-Typen auf reine Renderer-Funktionen (Spiegel von `tiles`). */
export type RendererMap = Partial<Record<CoreWidgetType, Renderer>>;

/** Eingabe des Generators: das Manifest plus die tatsächlich verdrahtete tiles-Map. */
export interface SkinInput {
  readonly manifest: SkinManifest;
  readonly tiles: RendererMap;
}

/** Ergebnis des Generators: der Report plus ein hartes Fehler-Flag (gap ODER broken). */
export interface ConformanceResult {
  readonly report: SupportReport;
  readonly hasGap: boolean;
}

type Summary = {
  full: number;
  partial: number;
  display: number;
  unsupported: number;
  gap: number;
  broken: number;
};

/* ------------------------------------------------------ Vertrags-Auswertung */

interface SchemaWidget {
  readonly actions?: Readonly<Record<string, unknown>>;
}

const SCHEMA_WIDGETS = ((contractSchema as { widgets?: Readonly<Record<string, SchemaWidget>> })
  .widgets ?? {}) as Readonly<Record<string, SchemaWidget>>;

type FixtureMap = Readonly<Record<string, Readonly<Record<string, Record<string, unknown>>>>>;
const FIXTURES = contractFixtures as unknown as FixtureMap;

/** Die kanonischen Aktionen, die der Vertrag für einen Typ kennt (§6). */
export function canonicalActions(type: CoreWidgetType): readonly string[] {
  return Object.keys(SCHEMA_WIDGETS[type]?.actions ?? {});
}

/** Die Fixture-Zustände, die der Vertrag für einen Typ mitbringt (§8, Prüfgrundlage). */
export function fixtureStates(type: CoreWidgetType): readonly string[] {
  const states = FIXTURES[type];
  return states ? Object.keys(states) : [];
}

/**
 * Rendert jede Vertrags-Fixture des Typs headless durch den Renderer. Reine
 * Funktionsaufrufe — Vue-`h()` braucht kein DOM. Wirft ein Renderer, ist der Typ
 * `broken` (Fehler, kein stilles Überspringen).
 */
function renderAll(type: CoreWidgetType, render: Renderer): { states: string[]; error?: string } {
  const states = FIXTURES[type] ?? {};
  const ctx = ctxStub();
  const done: string[] = [];

  for (const state of Object.keys(states)) {
    const device = { type, id: `${type}.${state}`, ...states[state] } as never;
    try {
      render(device, tokensStub, ctx);
      done.push(state);
    } catch (err: unknown) {
      return {
        states: done,
        error: `${state}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  return { states: done };
}

/* ------------------------------------------------------------ Klassifikation */

function classify(
  type: CoreWidgetType,
  manifest: SkinManifest,
  tiles: RendererMap,
): SupportWidgetEntry {
  const declaredUnsupported = manifest.unsupported.includes(type);
  const entry = manifest.widgets[type];
  const render = tiles[type];
  const hasRenderer = typeof render === "function";

  if (declaredUnsupported) {
    return { level: "unsupported", reason: "declared in manifest.unsupported" };
  }
  if (entry !== undefined && !hasRenderer) {
    return { level: "gap", reason: "declared in widgets but no tiles renderer" };
  }
  if (entry === undefined) {
    return hasRenderer
      ? { level: "gap", reason: "tiles renderer present but not declared in widgets" }
      : { level: "gap", reason: "neither rendered nor declared unsupported" };
  }

  const canonical = canonicalActions(type);
  const declared = new Set<string>(entry.actions);
  const wired = canonical.filter((a) => declared.has(a));
  const actions = `${wired.length}/${canonical.length}`;

  const run = renderAll(type, render as Renderer);
  if (run.error) {
    return { level: "broken", render: "tile", actions, fixtures: run.states, reason: run.error };
  }

  const level =
    canonical.length === 0 || wired.length === 0
      ? "display"
      : wired.length === canonical.length
        ? "full"
        : "partial";

  const missing = canonical.filter((a) => !declared.has(a));
  return {
    level,
    render: "tile",
    actions,
    fixtures: run.states,
    ...(missing.length > 0 ? { reason: `not wired: ${missing.join(", ")}` } : {}),
  };
}

/**
 * Erzeugt den Konformitäts-Report für einen Skin. Kein I/O, kein State — die
 * Renderer werden rein funktional über die Vertrags-Fixtures aufgerufen.
 *
 * @param skin manifest.json + tiles-Renderer-Map des Skins
 * @param now  Zeitstempel-Quelle (injizierbar für deterministische Tests)
 */
export function generateSupport(
  skin: SkinInput,
  now: () => Date = () => new Date(),
): ConformanceResult {
  const { manifest, tiles } = skin;

  const widgets: Record<string, SupportWidgetEntry> = {};
  const summary: Summary = {
    full: 0,
    partial: 0,
    display: 0,
    unsupported: 0,
    gap: 0,
    broken: 0,
  };

  for (const type of CORE_WIDGET_TYPES) {
    const entry = classify(type, manifest, tiles);
    widgets[type] = entry;
    summary[entry.level] += 1;
  }

  const report: SupportReport = {
    skin: manifest.name,
    targetsContract: manifest.targetsContract,
    // Nicht die eigene Zielversion zurückspiegeln: der Vertrag sagt, wo er steht.
    // So wird ein hinterherhinkender Skin im Artefakt selbst sichtbar.
    contractLatest: contractVersion,
    generatedAt: now().toISOString(),
    summary,
    widgets,
    layout: {
      model: manifest.layout.model,
      honors: manifest.layout.honors ?? [],
    },
  };

  return { report, hasGap: summary.gap > 0 || summary.broken > 0 };
}
