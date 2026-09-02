// @obs-visu-skins/conformance — Konformitäts-Generator (ARCHITECTURE.md §2, CONTRACT-v1.md §8).
//
// Prüft einen Skin (manifest.json + Renderer-Maps) gegen die Vertrags-Kern-Typen und
// erzeugt einen `SupportReport` (support.json). Der Generator asseriert NIE selbst —
// und er glaubt dem Manifest nicht: die Stufe wird an dem gemessen, was die Renderer
// beim headless-Lauf über den Vertrags-Fixtures TATSÄCHLICH tun.
//
// Zwei Achsen, beide gemessen:
//   • Render-Achse — jede Fixture jedes Typs wird durch jede vorhandene Renderer-
//     Fläche (tile · detail · preset) gejagt. Wirft eine, ist der Typ `broken`.
//   • Aktions-Achse — der zurückgegebene Baum wird nach `data-action` abgelaufen.
//     Gezählt wird, was der Renderer MARKIERT, nicht was das Manifest behauptet.
//     Ein Manifest-Eintrag ohne markierende Fixture hebt die Stufe daher nicht.
//
// Für jeden CoreWidgetType …
//   • in manifest.unsupported                                       → "unsupported"
//   • in widgets deklariert, aber KEIN tiles-Renderer               → "gap"
//   • tiles-Renderer vorhanden, aber NICHT in widgets deklariert    → "gap"
//   • beides vorhanden →
//       – ein Renderer wirft                                        → "broken"
//       – markiert eine Aktion, die das Manifest nicht deklariert   → "broken"
//         (Goldene Regel 3: nicht verdrahtet darf nie vorgetäuscht werden)
//       – der Vertrag kennt keine Aktion (sensor), oder es wird
//         keine markiert                                            → "display"
//       – alle kanonischen Aktionen markiert                        → "full"
//       – ein Teil markiert                                         → "partial"
// `gap` und `broken` sind Fehler: hasGap === true → CLI Exit-Code != 0.
//
// Die kanonischen Aktionen je Typ kommen aus contract.schema.json (§6) — nicht aus
// einer Kopie im Tooling. Bumpt der Vertrag einen Typ oder eine Aktion, verschiebt
// sich die Stufe hier automatisch mit.
//
// Der `render`-Eintrag nennt Fläche UND Funktionsnamen (`tile:lightTile`). Zwei Skins,
// die dieselbe Implementierung teilen (edomi re-exportiert ionics Renderer), sind damit
// im Report erkennbar — ein doppelter `broken` ist dann sichtbar EIN Befund, nicht zwei.

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

/**
 * Eingabe des Generators: das Manifest plus die tatsächlich verdrahteten Renderer-Maps.
 * `details`/`presets` sind optional — ein Skin ohne sie bedient alles in der Kachel.
 * Gemessen wird über ALLE vorhandenen Flächen: eine Aktion, die ein Skin nur in seiner
 * Detailfläche anbietet (ionic: `setDim`, `setSetpoint`), zählt als angeboten.
 */
export interface SkinInput {
  readonly manifest: SkinManifest;
  readonly tiles: RendererMap;
  readonly details?: RendererMap;
  readonly presets?: RendererMap;
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
 * Universelle Host-/UI-Aktionen: sie brauchen laut Vertrag §6 KEINE Deklaration je
 * Widget, dürfen also markiert werden, ohne im Manifest zu stehen. `stop` ist
 * doppelnatürig — kanonische Media-Aktion, für die Bewegungs-Widgets aber ein
 * UI-only Momentary ohne Core-Write.
 */
function toleratedActions(type: CoreWidgetType): ReadonlySet<string> {
  const base = ["openDetail", "close"];
  return new Set(type === "blind" || type === "jalousie" ? [...base, "stop"] : base);
}

/**
 * Läuft einen Renderer-Rückgabewert ab und sammelt jede markierte `data-action`.
 * Verträgt beide Formen, die {@link Renderer} zurückgeben darf: einen Framework-Knoten
 * (Vue-VNode: `props` + `children`) und rohes Markup (String). Tiefe begrenzt, damit ein
 * zyklischer Baum den Lauf nicht aufhängt.
 */
export function collectActions(
  node: unknown,
  out: Set<string> = new Set(),
  depth = 0,
): Set<string> {
  if (depth > 64 || node === null || node === undefined) return out;

  if (typeof node === "string") {
    for (const [, action] of node.matchAll(/data-action=["']([^"']+)["']/g)) out.add(action!);
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectActions(child, out, depth + 1);
    return out;
  }
  if (typeof node !== "object") return out;

  const vnode = node as { props?: Record<string, unknown> | null; children?: unknown };
  const marked = vnode.props?.["data-action"];
  if (typeof marked === "string" && marked.length > 0) out.add(marked);
  if (vnode.children !== undefined) collectActions(vnode.children, out, depth + 1);
  return out;
}

/** Name einer Renderer-Funktion für die Herkunftsangabe im Report. */
function implName(render: Renderer): string {
  const name = (render as { name?: string }).name;
  return name && name.length > 0 ? name : "anonymous";
}

interface SurfaceRun {
  /** "tile:lightTile detail:LightDetail" — Fläche plus Implementierung. */
  readonly render: string;
  /** Die Fixture-Zustände, die durchliefen. */
  readonly states: string[];
  /** Jede über alle Flächen markierte `data-action`. */
  readonly marked: ReadonlySet<string>;
  readonly error?: string;
}

/**
 * Rendert jede Vertrags-Fixture des Typs headless durch jede vorhandene Renderer-Fläche.
 * Reine Funktionsaufrufe — Vue-`h()` braucht kein DOM. Wirft ein Renderer, ist der Typ
 * `broken` (Fehler, kein stilles Überspringen).
 */
function renderAll(type: CoreWidgetType, surfaces: readonly [string, Renderer][]): SurfaceRun {
  const states = FIXTURES[type] ?? {};
  const ctx = ctxStub();
  const marked = new Set<string>();
  const done = new Set<string>();
  const render = surfaces.map(([surface, fn]) => `${surface}:${implName(fn)}`).join(" ");

  for (const [surface, fn] of surfaces) {
    for (const state of Object.keys(states)) {
      const device = { type, id: `${type}.${state}`, ...states[state] } as never;
      try {
        collectActions(fn(device, tokensStub, ctx), marked);
        done.add(state);
      } catch (err: unknown) {
        return {
          render,
          states: [...done],
          marked,
          error: `${surface}/${state}: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }
  return { render, states: Object.keys(states).filter((s) => done.has(s)), marked };
}

/* ------------------------------------------------------------ Klassifikation */

function classify(
  type: CoreWidgetType,
  manifest: SkinManifest,
  skin: SkinInput,
): SupportWidgetEntry {
  const declaredUnsupported = manifest.unsupported.includes(type);
  const entry = manifest.widgets[type];
  const tile = skin.tiles[type];
  const hasRenderer = typeof tile === "function";

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

  // Jede Fläche, die dieser Skin für den Typ mitbringt — die Aktions-Achse misst über
  // alle: was ionic nur im Detail anbietet, ist trotzdem angeboten.
  const surfaces: [string, Renderer][] = [["tile", tile as Renderer]];
  const detail = skin.details?.[type];
  if (typeof detail === "function") surfaces.push(["detail", detail]);
  const preset = skin.presets?.[type];
  if (typeof preset === "function") surfaces.push(["preset", preset]);

  const run = renderAll(type, surfaces);
  const canonical = canonicalActions(type);
  const declared = new Set<string>(entry.actions);
  const tolerated = toleratedActions(type);

  if (run.error) {
    return { level: "broken", render: run.render, fixtures: run.states, reason: run.error };
  }

  // Vortäuschungs-Prüfung (Goldene Regel 3): markiert der Renderer etwas, das weder
  // deklariert noch eine universelle Host-Aktion ist, ist der Skin in sich unstimmig.
  const undeclared = [...run.marked].filter((a) => !declared.has(a) && !tolerated.has(a));
  if (undeclared.length > 0) {
    return {
      level: "broken",
      render: run.render,
      fixtures: run.states,
      reason: `marks undeclared action(s): ${undeclared.sort().join(", ")}`,
    };
  }

  // Gemessen, nicht behauptet: nur was tatsächlich markiert wurde, zählt.
  const offered = canonical.filter((a) => run.marked.has(a));
  const actions = `${offered.length}/${canonical.length}`;

  const level =
    canonical.length === 0 || offered.length === 0
      ? "display"
      : offered.length === canonical.length
        ? "full"
        : "partial";

  const missing = canonical.filter((a) => !run.marked.has(a));
  const unbacked = [...declared].filter((a) => !run.marked.has(a)).sort();
  const notes = [
    missing.length > 0 ? `not offered: ${missing.join(", ")}` : "",
    // Ein Manifest-Eintrag, den keine Fixture markiert: hebt die Stufe nicht, wird
    // aber benannt — sonst bliebe die unbelegte Behauptung unsichtbar.
    unbacked.length > 0 ? `declared but never marked: ${unbacked.join(", ")}` : "",
  ].filter(Boolean);

  return {
    level,
    render: run.render,
    actions,
    fixtures: run.states,
    ...(notes.length > 0 ? { reason: notes.join("; ") } : {}),
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
  const { manifest } = skin;

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
    const entry = classify(type, manifest, skin);
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
