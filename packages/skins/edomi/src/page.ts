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

/** Absolute box from an author position (Edomi units = pixels). Emits plain `px`
 *  rather than `calc(var() * n)`: length*number typed arithmetic is invalid on
 *  older WebViews (Chrome/Android < 140, older iOS), which would drop positioning. */
function boxStyle(pos: { x: number; y: number; w: number; h: number }): Record<string, string> {
  return {
    position: "absolute",
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    width: `${pos.w}px`,
    height: `${pos.h}px`,
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

/** The bounding extent (w/h in author units) of a set of layers' positioned items. */
function layersExtent(layers: readonly PageLayer[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const layer of layers) {
    for (const item of layer.items) {
      if (!item.position) continue;
      w = Math.max(w, item.position.x + item.position.w);
      h = Math.max(h, item.position.y + item.position.h);
    }
  }
  return { w, h };
}

/** A popup overlay: its own page's layers, host-owned open state. `inert` makes a
 *  sibling popup non-interactive while a modal popup is open (modal is exclusive). */
function popup(desc: PopupDescriptor, host: PageHost, inert?: boolean): VNode {
  const centered = !desc.position;
  const layers = host.layersFor(desc.id);
  // A centered popup's layers are absolutely positioned (no intrinsic size), so
  // size the card to contain them; fall back to the CSS default when it has none.
  const ext = centered ? layersExtent(layers) : null;
  const centeredStyle =
    ext && (ext.w > 0 || ext.h > 0)
      ? { width: `${ext.w}px`, height: `${ext.h}px` }
      : undefined;
  return h(
    "div",
    {
      class: ["edomi-popup-wrap", desc.dimBackdrop && "is-dimmed", desc.modal && "is-modal"].filter(
        Boolean,
      ),
      inert: inert ? true : undefined,
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
          // A modal popup is a dialog for assistive tech (the background is inert).
          role: desc.modal ? "dialog" : undefined,
          "aria-modal": desc.modal ? "true" : undefined,
          style: desc.position ? boxStyle(desc.position) : centeredStyle,
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
          ...layers.map((layer) => layerCanvas(layer, host)),
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
  // A modal popup is exclusive: make the rest of the page inert so it drops out of
  // the tab order + pointer/keyboard interaction (not just visually dimmed).
  const hasModal = host.openPopups.some((p) => p.modal);
  const inert = hasModal ? true : undefined;
  // The topmost open modal is the only interactive surface; everything below it
  // (nav, canvas, and any earlier/sibling popup) is inert.
  let topModalIdx = -1;
  host.openPopups.forEach((p, i) => {
    if (p.modal) topModalIdx = i;
  });
  // `visu-root` + the ionic style hooks (data-stil/data-theme) so the re-used
  // ionic content tiles — whose CSS is scoped under `.visu-root[data-stil]` —
  // actually pick up their styling inside the Edomi page.
  return h("div", { class: ["edomi-root", "visu-root"], "data-stil": "glass", "data-theme": "dark" }, [
    h("nav", { class: "edomi-nav", "aria-label": "Visu", inert }, [
      h(
        "ul",
        { class: "edomi-nav-list" },
        host.navTree.map((n) => navEntry(n, host)),
      ),
    ]),
    h(
      "div",
      { class: "edomi-canvas", "data-page": pageId ?? "", inert },
      layers.map((layer) => layerCanvas(layer, host)),
    ),
    // A modal is exclusive: while one is open, every popup except the topmost modal
    // is inert too (two modals → only the last stays interactive).
    ...host.openPopups.map((p, i) => popup(p, host, hasModal && i !== topModalIdx)),
  ]);
}
