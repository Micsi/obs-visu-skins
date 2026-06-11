// Terminal-Skin · blind (Rollladen) — Listen-Zeilen-Renderer (reine Funktion).
//
// Reduzierte Bedienung gemäß manifest.json → widgets.blind.actions:
//   setPosition (auf=0 / zu=100), lock, unlock.
// Aufbau: "Raum · Label   <pos>% Offen/Zu/Teil   [auf][zu][sperren|öffnen]".
// `locked` blockiert das Verfahren in der Zeile (auf/zu disabled, keine data-action);
// stattdessen wird die kanonische Aktion `unlock` angeboten. Goldene Regeln 1/4:
// kein State, nie d.x=…; Aktionen ausschließlich über data-action (+ data-arg).

import { h, type VNode } from "vue";
import type { BlindDevice, Ctx, Renderer, Tokens } from "@obs/visu-contract";
import { rowLabel } from "../row.js";

function posLabel(position: number): string {
  if (position === 0) return "Offen";
  if (position === 100) return "Zu";
  return "Teil";
}

/** Verfahr-Befehl (auf/zu); im Lock-Zustand disabled und ohne data-action. */
function moveCmd(label: string, arg: string, locked: boolean): VNode {
  return h(
    "button",
    {
      class: "t-cmd",
      type: "button",
      disabled: locked,
      "data-action": locked ? undefined : "setPosition",
      "data-arg": locked ? undefined : arg,
      "aria-label": label,
    },
    label,
  );
}

export const blindTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as BlindDevice;
  const locked = !!dev.locked;

  // Sperre-Befehl: gesperrt → unlock anbieten, sonst lock.
  const lockCmd = h(
    "button",
    {
      class: "t-cmd t-lock",
      type: "button",
      "data-action": locked ? "unlock" : "lock",
      "aria-label": locked ? "entsperren" : "sperren",
    },
    locked ? "[öffnen]" : "[sperren]",
  );

  return h(
    "div",
    {
      class: ["t-row", "t-blind", locked && "is-locked"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "blind",
    },
    [
      rowLabel(ctx, dev.room, dev.label),
      h("span", { class: "t-state" }, [
        h("b", null, String(dev.position)),
        h("span", { class: "t-unit" }, "%"),
        ` · ${posLabel(dev.position)}`,
        locked ? h("span", { class: "t-locktag", "aria-hidden": "true" }, " 🔒") : null,
      ]),
      h("span", { class: "t-cmds" }, [
        moveCmd("[auf]", "0", locked),
        moveCmd("[zu]", "100", locked),
        lockCmd,
      ]),
    ],
  );
};
