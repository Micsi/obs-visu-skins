// @obs-visu-skins/edomi — the whole-page renderer (CONTRACT-v1.10 PageRenderer).
//
// The Edomi POC owns the page à la Edomi: a navigation rail, a pixel-precise
// canvas that overlays the composed layer stack (ancestors + own) placing each
// widget by its author box (x/y/w/h), and modal popups. The host owns all STATE
// (current page, open popups, auto-close timers) and renders the content tiles;
// this skin only draws the appearance and calls the host services. No state, no
// data fork — items reference devices by id and the host renders their tiles.

import { h, type VNode } from "vue";
import type { NavNode, PageHost, PageLayer, PopupDescriptor } from "@obs/visu-contract";

/** Absolute box from an author position, scaled by the pixel unit var. */
function boxStyle(pos: { x: number; y: number; w: number; h: number }): Record<string, string> {
  const u = "var(--vz-pos-unit, 1px)";
  return {
    position: "absolute",
    left: `calc(${u} * ${pos.x})`,
    top: `calc(${u} * ${pos.y})`,
    width: `calc(${u} * ${pos.w})`,
    height: `calc(${u} * ${pos.h})`,
  };
}

/** One navigation entry (recursive) — a click navigates the host to that page. */
function navEntry(node: NavNode, host: PageHost): VNode {
  const active = node.id === host.currentPageId;
  return h("li", { class: "edomi-nav-item" }, [
    h(
      "button",
      {
        class: ["edomi-nav-link", active && "is-active", node.access && `is-${node.access}`].filter(
          Boolean,
        ),
        type: "button",
        "data-page": node.id,
        "aria-current": active ? "page" : undefined,
        disabled: node.type !== "PAGE" ? true : undefined,
        onClick: node.type === "PAGE" ? () => host.navigate(node.id) : undefined,
      },
      node.name,
    ),
    node.children.length > 0
      ? h(
          "ul",
          { class: "edomi-nav-children" },
          node.children.map((c) => navEntry(c, host)),
        )
      : null,
  ]);
}

/** One composed layer, its items placed absolutely by their author box. */
function layerCanvas(layer: PageLayer, host: PageHost): VNode {
  return h(
    "div",
    { class: ["edomi-layer", `edomi-layer-${layer.origin}`], "data-layer": layer.id },
    layer.items.map((item) =>
      h(
        "div",
        {
          class: "edomi-item",
          "data-id": item.id,
          style: item.position ? boxStyle(item.position) : undefined,
        },
        [host.renderTile(item.id) as VNode],
      ),
    ),
  );
}

/** A modal popup overlay: its own page's layers, host-owned open state. */
function popup(desc: PopupDescriptor, host: PageHost): VNode {
  const centered = !desc.position;
  return h(
    "div",
    {
      class: ["edomi-popup-wrap", desc.dimBackdrop && "is-dimmed", desc.modal && "is-modal"].filter(
        Boolean,
      ),
    },
    [
      h(
        "div",
        {
          class: [
            "edomi-popup",
            desc.shadow && "has-shadow",
            desc.animate && "is-animated",
            centered && "is-centered",
          ].filter(Boolean),
          "data-popup": desc.id,
          style: desc.position ? boxStyle(desc.position) : undefined,
        },
        [
          h(
            "button",
            {
              class: "edomi-popup-close",
              type: "button",
              "aria-label": "close",
              onClick: () => host.closePopup(desc.id),
            },
            "×",
          ),
          // The popup shows its own page's composed layers (id === popup id).
          ...host.layersFor(desc.id).map((layer) => layerCanvas(layer, host)),
        ],
      ),
    ],
  );
}

/**
 * The page renderer. The host passes its services; the skin draws nav + the
 * pixel canvas (composed layers) + popups. An empty nav/layer set (e.g. the mock
 * source) yields an empty shell — never a crash.
 */
export function page(host: PageHost): VNode {
  const pageId = host.currentPageId;
  const layers = pageId ? host.layersFor(pageId) : [];
  // `visu-root` + the ionic style hooks (data-stil/data-theme) so the re-used
  // ionic content tiles — whose CSS is scoped under `.visu-root[data-stil]` —
  // actually pick up their styling inside the Edomi page.
  return h("div", { class: ["edomi-root", "visu-root"], "data-stil": "glass", "data-theme": "dark" }, [
    h("nav", { class: "edomi-nav", "aria-label": "Visu" }, [
      h(
        "ul",
        { class: "edomi-nav-list" },
        host.navTree.map((n) => navEntry(n, host)),
      ),
    ]),
    h(
      "div",
      { class: "edomi-canvas", "data-page": pageId ?? "" },
      layers.map((layer) => layerCanvas(layer, host)),
    ),
    ...host.openPopups.map((p) => popup(p, host)),
  ]);
}
