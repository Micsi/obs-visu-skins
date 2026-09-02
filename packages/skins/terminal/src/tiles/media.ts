// Terminal-Skin · media — Listen-Zeilen-Renderer (reine Funktion).
//
// Kern-Typ seit Vertrag v1.2. Terminal RENDERT ihn: Transportzustand, Titel und
// Pegel sind Text und Zahl — Konsolen-Material. Das Cover (`artUrl`) bleibt weg,
// dafür ist die Zeile nicht gedacht.
//
// Zeile: "▶ Wohnz. · Sonos   Sunset Drive — The Midnight  Vol ████░░░░░░ 42   [zurück][pause][vor][stop]".
// Verdrahtet laut manifest.json: playPause, stop, next, previous.
// NICHT verdrahtet: `setVolume` — ein Schieberegler gehört nicht in eine Zeile;
// der Pegel wird als Block-Bar ANGEZEIGT, nie als Bedienelement vorgetäuscht
// (Issue #11). 4 von 5 kanonischen Aktionen → Stufe `partial`.

import { h, type VNode } from "vue";
import type { Ctx, MediaDevice, Renderer, Tokens } from "@obs/visu-contract";
import { blockBar, cmd, isWritable, rowLabel, rowLed } from "../row.js";
import { tt } from "../i18n.js";

/** LED-Kennung je Transportzustand. */
function led(state: MediaDevice["playState"]): "on" | "off" | "dead" {
  if (state === "playing") return "on";
  if (state === "paused") return "off";
  return "dead";
}

export const mediaTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as MediaDevice;
  const writable = isWritable(dev);
  const playing = dev.playState === "playing";
  const title = dev.title ?? "—";

  return h(
    "div",
    {
      class: ["t-row", "t-media", playing && "is-on", !writable && "is-readonly"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "media",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLed(led(dev.playState)),
      rowLabel(ctx, dev, dev.label),
      h("span", { class: "t-state" }, [
        h("b", null, ctx.hyphenate(title)),
        dev.subtitle ? h("span", { class: "t-sub" }, ` — ${dev.subtitle}`) : null,
        // Transportzustand ausschreiben: `paused` und `stopped` teilen sich sonst
        // Label, Befehl (`[play]`) und LED-Farbe — zwei Geraete mit gleichen Metadaten
        // waeren visuell UND fuer Hilfstechnik ununterscheidbar, obwohl `stateText`
        // die lokalisierte Antwort liefert.
        h("span", { class: "t-status" }, ` · ${ctx.stateText(dev)}`),
        h("span", { class: "t-unit" }, ` ${tt(ctx, "skin.terminal.state.volume", "Vol")} `),
        blockBar(dev.volume),
        h("span", { class: "t-unit" }, ` ${ctx.nf(dev.volume)}`),
      ]),
      h("span", { class: "t-cmds" }, [
        cmd(`[${tt(ctx, "skin.terminal.cmd.previous", "zurück")}]`, "previous", {
          enabled: writable,
        }),
        cmd(
          playing
            ? `[${tt(ctx, "skin.terminal.cmd.pause", "pause")}]`
            : `[${tt(ctx, "skin.terminal.cmd.play", "play")}]`,
          "playPause",
          { enabled: writable },
        ),
        cmd(`[${tt(ctx, "skin.terminal.cmd.next", "vor")}]`, "next", { enabled: writable }),
        cmd(`[${tt(ctx, "skin.terminal.cmd.stop", "stop")}]`, "stop", { enabled: writable }),
      ]),
    ],
  );
};
