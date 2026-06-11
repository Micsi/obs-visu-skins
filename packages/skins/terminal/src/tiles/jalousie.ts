// Terminal-Skin · jalousie (Lamellen-Jalousie) — Listen-Zeilen-Renderer (reine Funktion).
//
// BEWUSST reduzierte Bedienung gemäß manifest.json → widgets.jalousie.actions:
//   setPosition (auf=0 / zu=100), lock, unlock — OHNE setSlat.
// Terminal lässt die Lamellenfeinsteuerung weg (ehrliche partielle Aktion). Aufbau wie
// blind: "Raum · Label   <pos>% Offen/Zu/Teil   [auf][zu][sperren|öffnen]". `locked`
// blockiert das Verfahren und bietet `unlock`. Goldene Regeln 1/4: kein State, nie d.x=…

import { h, type VNode } from "vue";
import type { Ctx, JalousieDevice, Renderer, Tokens } from "@obs/visu-contract";
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

export const jalousieTile: Renderer = (d, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as JalousieDevice;
  const locked = !!dev.locked;

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
      class: ["t-row", "t-jalousie", locked && "is-locked"].filter(Boolean),
      style: { "--acc": t.accent(dev.accent) },
      "data-type": "jalousie",
    },
    [
      rowLabel(ctx, dev.room, dev.label),
      h("span", { class: "t-state" }, [
        h("b", null, String(Math.round(dev.position))),
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
