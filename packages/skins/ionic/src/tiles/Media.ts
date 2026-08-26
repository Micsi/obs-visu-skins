// Ionic-Skin · media — Kachel-Renderer (reine Funktion, VNode via Vue h()).
//
// Vertrag v1.2: MediaDevice { playState, title, subtitle, volume, artUrl? }.
// Goldene Regeln: ein Skin besitzt nie State (1/4) — der Renderer markiert nur die
// kanonischen Aktionen über data-action (playPause · stop · next · previous ·
// setVolume); der Host übersetzt die Geste, besitzt den State. Schreibgeschützt
// über `d` (nie d.x=…). User-Strings über ctx.t(key) mit Fallback.

import { h, type VNode } from "vue";
import type { Ctx, Device, MediaDevice, Renderer, Tokens } from "@obs/visu-contract";
import { svgIcon } from "../icon.js";
import { tt } from "../i18n.js";
import { isWritable, lockedLabel, lockOverlay } from "../parts.js";

/** Cover: echtes Bild bei artUrl, sonst Platzhalter mit Noten-Glyph. */
function cover(dev: MediaDevice, ctx: Ctx): VNode {
  if (dev.artUrl) {
    return h("img", {
      class: "vz-media-cover",
      src: dev.artUrl,
      alt: "",
      "aria-hidden": "true",
      loading: "lazy",
    });
  }
  return h(
    "div",
    { class: "vz-media-cover vz-media-cover--ph", "aria-hidden": "true" },
    svgIcon(ctx, dev, "play", 22),
  );
}

/**
 * Eine Transport-Taste mit kanonischer data-action; markiert nur den Host-Intent.
 * Bei `interactive === false` (writable === false) trägt die Taste keine
 * Schreibaktion mehr und ist inert (`disabled` + `aria-disabled`).
 */
function transport(
  action: string,
  label: string,
  icon: VNode,
  interactive: boolean,
  props: Record<string, unknown> = {},
): VNode {
  const { class: extraClass, ...rest } = props;
  return h(
    "button",
    {
      class: ["vz-media-btn", `vz-media-btn--${action}`, extraClass].filter(Boolean),
      type: "button",
      "data-action": interactive ? action : undefined,
      disabled: interactive ? undefined : true,
      "aria-disabled": interactive ? undefined : "true",
      "aria-label": label,
      ...rest,
    },
    icon,
  );
}

export const MediaTile: Renderer = (d: Device, t: Tokens, ctx: Ctx): VNode => {
  const dev = d as MediaDevice;
  const playing = dev.playState === "playing";
  const acc = t.accent(dev.accent);
  // writable === false ⇒ gesperrt: alle Transport-Tasten und der Lautstärke-Slider
  // sind inert (keine playPause/stop/next/previous/setVolume-Schreibaktion),
  // Schloss-Badge + Veil markieren die Kachel sichtbar gesperrt.
  const interactive = isWritable(dev);
  const ro = !interactive;

  const title = dev.title ?? tt(ctx, "skin.ionic.media.noTitle", "Kein Titel");
  const sub = dev.subtitle;

  const playLabel = playing
    ? tt(ctx, "skin.ionic.media.pause", "Pause")
    : tt(ctx, "skin.ionic.media.play", "Wiedergabe");

  const nameAria = `${tt(ctx, "skin.ionic.media.aria", "Medienspieler")}: ${[dev.room, dev.label].filter(Boolean).join(" · ")}`;

  return h(
    "div",
    {
      class: ["vz-tile", "vz-tile--media", playing && "is-on", ro && "readonly"].filter(Boolean),
      style: { "--acc": acc, "--acc-bar": `var(--vz-acc-${dev.accent})` },
      role: "group",
      "aria-label": ro ? `${nameAria} – ${lockedLabel(ctx)}` : nameAria,
    },
    [
      ...(ro ? lockOverlay(ctx, dev) : []),
      h("div", { class: "vz-eyebrow" }, dev.room),
      h("div", { class: "vz-media-head" }, [
        cover(dev, ctx),
        h("div", { class: "vz-media-meta" }, [
          h("div", { class: "vz-media-title" }, ctx.hyphenate(title)),
          sub ? h("div", { class: "vz-media-sub" }, sub) : null,
        ]),
      ]),
      h("div", { class: "vz-media-transport" }, [
        transport(
          "previous",
          tt(ctx, "skin.ionic.media.previous", "Zurück"),
          svgIcon(ctx, dev, "skip", 18),
          interactive,
          { class: "vz-media-prev" },
        ),
        transport(
          "playPause",
          playLabel,
          svgIcon(ctx, dev, playing ? "pause" : "play", 20),
          interactive,
          {
            class: playing ? "is-playing" : undefined,
            "aria-pressed": String(playing),
          },
        ),
        transport(
          "next",
          tt(ctx, "skin.ionic.media.next", "Weiter"),
          svgIcon(ctx, dev, "skip", 18),
          interactive,
        ),
        transport(
          "stop",
          tt(ctx, "skin.ionic.media.stop", "Stopp"),
          svgIcon(ctx, dev, "stop", 16),
          interactive,
        ),
      ]),
      h("div", { class: "vz-media-volrow" }, [
        h("input", {
          class: "vz-range vz-media-vol",
          type: "range",
          min: "0",
          max: "100",
          value: String(dev.volume),
          disabled: interactive ? undefined : true,
          "data-action": interactive ? "setVolume" : undefined,
          "data-arg": String(dev.volume),
          "aria-disabled": interactive ? undefined : "true",
          "aria-label": tt(ctx, "skin.ionic.media.volume", "Lautstärke"),
        }),
      ]),
    ],
  );
};
