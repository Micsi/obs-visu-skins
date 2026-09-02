// Terminal-Skin · blind (Rollladen) — Listen-Zeilen-Renderer (reine Funktion).
//
// Zeile: "● Raum · Label   <50>% █████░░░░░ · Teil   [auf][zu][Beschattung][sperren]".
// Verdrahtet laut manifest.json → widgets.blind.actions: setPosition (auf=0 / zu=100),
// applyPreset (Vertrag v1.6 — die konfigurierten Vorgabepositionen werden als benannte
// Befehle angeboten, was der Terminal-Sprache entspricht), lock, unlock. Das ist der
// vollständige kanonische blind-Aktionssatz → Stufe `full`.
//
// `locked` (oder `writable === false`, Vertrag v1.5) blockiert Verfahren und Presets:
// die Knöpfe bleiben sichtbar, verlieren aber ihre data-action — nichts wird
// vorgetäuscht. Statt Verfahren wird `unlock` angeboten.
// Goldene Regeln 1/4: kein State, nie d.x=…

import { h, type VNode } from "vue";
import type { BlindDevice, Ctx, Renderer, Tokens } from "@obs/visu-contract";
import { blockBar, cmd, isWritable, rowLabel, rowLed } from "../row.js";
import { tt } from "../i18n.js";

/** Zustandswort zur Position (0 = auf, 100 = zu). */
export function posWord(ctx: Ctx, position: number): string {
  if (position === 0) return tt(ctx, "skin.terminal.state.open", "Offen");
  if (position === 100) return tt(ctx, "skin.terminal.state.closed", "Zu");
  return tt(ctx, "skin.terminal.state.partial", "Teil");
}

/** Preset-Befehle (v1.6) — ein benannter Knopf je konfigurierter Vorgabeposition. */
export function presetCmds(presets: BlindDevice["presets"], enabled: boolean): VNode[] {
  return (presets ?? []).map((p, i) =>
    cmd(`[${p.label}]`, "applyPreset", { arg: String(i), enabled, ariaLabel: p.label }),
  );
}

export const blindTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as BlindDevice;
  const locked = !!dev.locked;
  const movable = !locked && isWritable(dev);

  return h(
    "div",
    {
      class: ["t-row", "t-blind", locked && "is-locked", !isWritable(dev) && "is-readonly"].filter(
        Boolean,
      ),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "blind",
      role: "group",
      "aria-label": dev.label,
    },
    [
      rowLed(locked ? "dead" : dev.position > 0 ? "on" : "off"),
      rowLabel(ctx, dev, dev.label),
      h("span", { class: "t-state" }, [
        h("b", null, String(Math.round(dev.position))),
        h("span", { class: "t-unit" }, "%"),
        blockBar(dev.position),
        ` · ${posWord(ctx, dev.position)}`,
        locked
          ? h(
              "span",
              { class: "t-locktag" },
              ` · ${tt(ctx, "skin.terminal.state.locked", "gesperrt")}`,
            )
          : null,
      ]),
      h("span", { class: "t-cmds" }, [
        cmd(`[${tt(ctx, "skin.terminal.cmd.open", "auf")}]`, "setPosition", {
          arg: "0",
          enabled: movable,
        }),
        cmd(`[${tt(ctx, "skin.terminal.cmd.close", "zu")}]`, "setPosition", {
          arg: "100",
          enabled: movable,
        }),
        ...presetCmds(dev.presets, movable),
        locked
          ? cmd(`[${tt(ctx, "skin.terminal.cmd.unlock", "öffnen")}]`, "unlock", {
              enabled: isWritable(dev),
            })
          : cmd(`[${tt(ctx, "skin.terminal.cmd.lock", "sperren")}]`, "lock", {
              enabled: isWritable(dev),
            }),
      ]),
    ],
  );
};
