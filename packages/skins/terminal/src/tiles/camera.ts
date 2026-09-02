// Terminal-Skin · camera — Listen-Zeilen-Renderer (reine Funktion).
//
// Kern-Typ seit Vertrag v1.2. Terminal zeigt die Kamera als STATUSZEILE, nicht als
// Bild: Erreichbarkeit (LED) plus die Quelle, die hinter dem Gerät steht. Das ist
// eine ehrliche Reduktion, keine Vortäuschung — die Zeile behauptet nirgends ein
// Livebild. Genau dafür ist eine Konsolenansicht da: Zustand auf einen Blick.
//
// Zeile: "● Eingang · Haustür   online · cam.local   [neu]".
// Verdrahtet: `refresh` — die einzige kanonische camera-Aktion → Stufe `full`.
// Auch offline bleibt `refresh` bedienbar: erneut abfragen ist genau die Handlung,
// die dann Sinn ergibt.

import { h, type VNode } from "vue";
import type { CameraDevice, Ctx, Renderer, Tokens } from "@obs/visu-contract";
import { cmd, isWritable, rowLabel, rowLed } from "../row.js";
import { tt } from "../i18n.js";

/** Host einer Snapshot-/Stream-URL; nicht parsebare Werte bleiben unverändert. */
export function sourceHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export const cameraTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as CameraDevice;
  const writable = isWritable(dev);
  const source = dev.snapshotUrl ?? dev.streamUrl ?? null;

  return h(
    "div",
    {
      class: ["t-row", "t-camera", dev.online && "is-on", !writable && "is-readonly"].filter(
        Boolean,
      ),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "camera",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLed(dev.online ? "on" : "dead"),
      rowLabel(ctx, dev, dev.label),
      h("span", { class: "t-state" }, [
        h(
          "b",
          null,
          dev.online
            ? tt(ctx, "skin.terminal.state.online", "online")
            : tt(ctx, "skin.terminal.state.offline", "offline"),
        ),
        h(
          "span",
          { class: "t-status" },
          ` · ${source ? sourceHost(source) : tt(ctx, "skin.terminal.state.noSignal", "kein Bild")}`,
        ),
      ]),
      h("span", { class: "t-cmds" }, [
        cmd(`[${tt(ctx, "skin.terminal.cmd.refresh", "neu")}]`, "refresh", { enabled: writable }),
      ]),
    ],
  );
};
