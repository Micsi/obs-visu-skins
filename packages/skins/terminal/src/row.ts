// @obs-visu-skins/terminal — gemeinsame Zeilen-Bausteine für die Listen-Renderer.
//
// Terminal ist KEINE Kachel-Optik, sondern eine schlichte, kompakte Konsolen-/
// Listendarstellung: eine Zeile pro Gerät, Monospace, Aufbau
// "● Raum · Label   <Zustand>   [befehl]". Diese Datei kapselt nur die
// wiederkehrenden Bausteine (LED, Label-Spalte, Zustands-Spalte, Block-Bar,
// Sparkline, Befehls-Knopf); jeder Renderer bleibt eine reine Funktion und
// markiert seine Aktionen selbst via data-action/data-arg.
//
// Goldene Regeln 1/4: kein State, nie `d.x = …`; der Host übersetzt Gesten auf
// die kanonischen Aktionen und besitzt allein den Zustand.

import { h, type VNode } from "vue";
import type { Ctx, Device, HostAction } from "@obs/visu-contract";

/** Zeichen der Block-Bar (Positionen/Pegel) und der Inline-Sparkline (Verläufe). */
const BAR_CELLS = 10;
const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

/**
 * Statuspunkt am Zeilenanfang.
 * `on` = aktiv (Akzentfarbe), `off` = inaktiv, `warn` = außerhalb Komfort,
 * `dead` = nicht erreichbar/aus. Rein dekorativ — die Aussage steht als Text
 * in der Zustands-Spalte, deshalb `aria-hidden`.
 */
export function rowLed(kind: "on" | "off" | "warn" | "dead"): VNode {
  return h("span", { class: "t-led", "data-led": kind, "aria-hidden": "true" }, "●");
}

/**
 * Linke Spalte: Eyebrow (Etagenkürzel + Raum, v1.8 `ctx.floorShort`) + Label,
 * weich getrennt. Fehlt `floor`, bleibt nur der Raum stehen.
 */
export function rowLabel(ctx: Ctx, d: Device, label: string): VNode {
  const floor = ctx.floorShort(d);
  const eyebrow = floor ? `${floor} ${d.room}` : d.room;
  return h("span", { class: "t-label" }, [
    h("span", { class: "t-room" }, eyebrow),
    h("span", { class: "t-sep" }, " · "),
    h("span", { class: "t-name" }, ctx.hyphenate(label)),
  ]);
}

/**
 * Zustands-Spalte aus `ctx.stateParts` (v1.4): Zustandswort fett, Rest gemutet.
 * Zentral im Host formuliert — der Skin erfindet keine Zustandstexte.
 */
export function rowState(d: Device, ctx: Ctx, extra: (VNode | null)[] = []): VNode {
  const { word, rest } = ctx.stateParts(d);
  return h("span", { class: "t-state" }, [
    word ? h("b", null, word) : null,
    rest ? h("span", { class: "t-rest" }, rest) : null,
    ...extra,
  ]);
}

/**
 * Block-Bar für 0–100-Werte (Rollladen-/Jalousie-Position, Lautstärke).
 * Zeichen-Grafik statt Pixel-Balken — das ist die Terminal-Sprache. Der Wert
 * steht zusätzlich als Zahl in der Zeile, die Bar ist daher `aria-hidden`.
 */
export function blockBar(pct: number): VNode {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const filled = Math.round((clamped / 100) * BAR_CELLS);
  return h("span", { class: "t-bar", "aria-hidden": "true" }, [
    "█".repeat(filled),
    h("span", { class: "t-bar-rest" }, "░".repeat(BAR_CELLS - filled)),
  ]);
}

/**
 * Inline-Sparkline aus einer Zeitreihe (v1.4 `SensorDevice.series`) — acht
 * Blockhöhen, auf min…max der Reihe normiert. Eine konstante Reihe ergibt die
 * unterste Stufe (kein Division-durch-null-Sprung). `aria-hidden`: der Verlauf
 * ist Zusatz, Wert/min/max stehen als Text daneben.
 */
export function sparkline(series: readonly number[]): VNode | null {
  const pts = series.filter((n) => Number.isFinite(n));
  if (pts.length === 0) return null;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo;
  const glyphs = pts
    .map((n) => (span === 0 ? 0 : Math.round(((n - lo) / span) * (SPARK.length - 1))))
    .map((i) => SPARK[i] ?? SPARK[0])
    .join("");
  return h("span", { class: "t-spark", "aria-hidden": "true" }, glyphs);
}

/**
 * Befehls-Knopf. Markiert ausschließlich eine im Manifest verdrahtete Aktion
 * (Issue #11: nicht verdrahtete Aktionen werden NIE vorgetäuscht).
 *
 * `enabled === false` (Sperre, oder `DeviceBase.writable === false` aus v1.5)
 * lässt den Knopf sichtbar, aber ohne `data-action`: der Host bekommt nichts zu
 * dispatchen, und die Zeile behauptet keine Bedienbarkeit, die es nicht gibt.
 */
export function cmd(
  label: string,
  action: HostAction,
  opts: { arg?: string; enabled?: boolean; ariaLabel?: string } = {},
): VNode {
  const enabled = opts.enabled !== false;
  return h(
    "button",
    {
      class: "t-cmd",
      type: "button",
      disabled: !enabled,
      "data-action": enabled ? action : undefined,
      "data-arg": enabled ? opts.arg : undefined,
      "aria-label": opts.ariaLabel ?? label,
    },
    label,
  );
}

/** Bedienbarkeit laut Vertrag v1.5 — `undefined`/`true` = bedienbar. */
export function isWritable(d: Device): boolean {
  return d.writable !== false;
}
