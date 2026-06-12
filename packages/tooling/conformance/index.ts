// @obs-visu-skins/conformance — Konformitäts-Generator (ARCHITECTURE.md §2, CONTRACT-v1.md §8).
//
// Prüft einen Skin (manifest.json + tiles-Renderer-Map) gegen die Vertrags-Kern-Typen
// und erzeugt einen `SupportReport` (support.json). Der Generator asseriert NIE selbst —
// er rechnet aus, was der Skin ehrlich deklariert hat, gegen das, was tatsächlich
// verdrahtet ist.
//
// gap-hart (golden rule 3): Für jeden CoreWidgetType …
//   • in manifest.unsupported  → "unsupported" (deklariert, OK)
//   • tiles-Renderer vorhanden UND in manifest.widgets deklariert → "supported"
//   • in widgets deklariert, aber KEIN tiles-Renderer               → "gap"
//   • tiles-Renderer vorhanden, aber NICHT in widgets deklariert    → "gap"
// Eine `gap` ist ein Fehler: hasGap === true → CLI Exit-Code != 0.

import type {
  CoreWidgetType,
  Renderer,
  SkinManifest,
  SupportReport,
  SupportWidgetEntry,
} from "@obs/visu-contract";

/** Die acht stabilen v1.2-Kern-Typen — Prüfgrundlage des Generators. */
export const CORE_WIDGET_TYPES: readonly CoreWidgetType[] = [
  "light",
  "switch",
  "blind",
  "jalousie",
  "sensor",
  "scene",
  "media",
  "camera",
];

/** Eine partielle Map über Kern-Typen auf reine Renderer-Funktionen (Spiegel von `tiles`). */
export type RendererMap = Partial<Record<CoreWidgetType, Renderer>>;

/** Eingabe des Generators: das Manifest plus die tatsächlich verdrahtete tiles-Map. */
export interface SkinInput {
  readonly manifest: SkinManifest;
  readonly tiles: RendererMap;
}

/** Engerer Support-Status, den dieser Generator pro Kern-Typ vergibt. */
type CoreSupportLevel = Extract<
  SupportWidgetEntry["level"],
  "full" | "unsupported" | "gap"
>;

interface CoreSupportEntry extends SupportWidgetEntry {
  readonly level: CoreSupportLevel;
}

/** Ergebnis des Generators: der Report plus ein hartes gap-Flag. */
export interface ConformanceResult {
  readonly report: SupportReport;
  readonly hasGap: boolean;
}

function classify(
  type: CoreWidgetType,
  manifest: SkinManifest,
  tiles: RendererMap,
): CoreSupportEntry {
  const declaredUnsupported = manifest.unsupported.includes(type);
  const declaredWidget = manifest.widgets[type] !== undefined;
  const hasRenderer = typeof tiles[type] === "function";

  if (declaredUnsupported) {
    return { level: "unsupported", reason: "declared in manifest.unsupported" };
  }
  if (declaredWidget && hasRenderer) {
    return { level: "full", render: "tile" };
  }
  if (declaredWidget && !hasRenderer) {
    return { level: "gap", reason: "declared in widgets but no tiles renderer" };
  }
  // hasRenderer && !declaredWidget — Renderer ohne Deklaration ist ebenfalls eine gap.
  return { level: "gap", reason: "tiles renderer present but not declared in widgets" };
}

/**
 * Erzeugt den Konformitäts-Report für einen Skin. Reine Funktion, kein State, kein I/O.
 *
 * @param skin manifest.json + tiles-Renderer-Map des Skins
 * @param now  Zeitstempel-Quelle (injizierbar für deterministische Tests)
 */
export function generateSupport(
  skin: SkinInput,
  now: () => Date = () => new Date(),
): ConformanceResult {
  const { manifest, tiles } = skin;

  const widgets: Record<string, CoreSupportEntry> = {};
  const summary = { full: 0, partial: 0, display: 0, unsupported: 0, gap: 0, broken: 0 };

  for (const type of CORE_WIDGET_TYPES) {
    const entry = classify(type, manifest, tiles);
    widgets[type] = entry;
    summary[entry.level] += 1;
  }

  const report: SupportReport = {
    skin: manifest.name,
    targetsContract: manifest.targetsContract,
    contractLatest: manifest.targetsContract,
    generatedAt: now().toISOString(),
    summary,
    widgets,
  };

  return { report, hasGap: summary.gap > 0 };
}
