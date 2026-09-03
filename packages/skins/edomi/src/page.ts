// @obs-visu-skins/edomi — the whole-page renderer (CONTRACT-v1.10 PageRenderer).
//
// The Edomi POC owns the page à la Edomi: a navigation rail, a pixel-precise
// canvas that overlays the composed layer stack (ancestors + own) placing each
// widget by its author box (x/y/w/h), and modal popups. The host owns all STATE
// (current page, open popups, auto-close timers) and renders the content tiles;
// this skin only draws the appearance and calls the host services. No state, no
// data fork — items reference devices by id and the host renders their tiles.

import { h, type VNode } from "vue";
import type { LayerItem, NavNode, PageHost, PageLayer, PopupDescriptor } from "@obs/visu-contract";

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

/**
 * The jump affordance of a placed element (`LayerItem.link`, contract v1.12).
 *
 * Everything that needs KNOWLEDGE here is a host call:
 *   - `host.resolveLink(link)` — what a click would do, WITHOUT doing it. A
 *     LOCATION target, the `protected` PIN gate and an unknown node are already
 *     decided when this returns; the skin only reads `kind`.
 *   - `host.isLinkActive(link)` — target is the current page or an ancestor.
 *     That BRANCH verdict drives the author's visual indicator only; the
 *     accessible `aria-current="page"` needs the narrower question, and gets it
 *     from `resolveLink`'s `pageId` (see below).
 *   - `host.linkLabel(link, outcome)` — the accessible name. The outcome is
 *     handed back so the NAME carries the state: a PIN-gated target announces
 *     itself as gated, which a cursor or a colour cannot do on touch or to a
 *     screen reader.
 *   - `host.followLink(link)`  — perform the canonical action.
 *
 * FOR LINKS the skin therefore touches neither `host.navTree` nor
 * `NavNode.access` nor any parent chain — it decides only WHERE the affordance
 * sits and WHAT it looks like (golden rule 4). (The nav rail above legitimately
 * reads both: that is the separate `honors: 'nav'` capability, not link logic.)
 *
 * A `<button role="link">` rather than an `<a>`: it is natively focusable and
 * natively fires its click on Enter AND Space, so the skin maps no keyboard
 * gesture of its own. It is stretched over the placed element, which is exactly
 * #1194's case — an element with no click function of its own.
 */
function linkOverlay(
  link: NonNullable<LayerItem["link"]>,
  host: PageHost,
  describedBy: string,
): VNode | null {
  const outcome = host.resolveLink(link);
  // A target the host cannot resolve gets NO affordance: a dead-looking click
  // area is worse than none. The item still marks it (`data-link-unknown`).
  if (outcome.kind === "unknown") return null;
  // `active` is the host's BRANCH verdict: the target is the current page OR an
  // ancestor of it. That is the right input for the author's visual indicator —
  // but NOT for `aria-current="page"`, which claims "this link points at the page
  // you are on". On an ancestor target that claim is false: the link navigates
  // somewhere else, and assistive tech would announce the user as already there.
  // The page identity comes from the outcome the host just resolved, so the skin
  // still walks no parent chain of its own (golden rule 4).
  const isCurrentPage = outcome.kind === "navigate" && outcome.pageId === host.currentPageId;
  return h("button", {
    class: ["edomi-link", outcome.kind === "gate" && "is-gated"].filter(Boolean),
    type: "button",
    // Announced as a link (it navigates), operated as a button (native keys).
    role: "link",
    "aria-label": host.linkLabel(link, outcome),
    // The covered tile is `inert`, and inert content is hidden from assistive
    // tech — not merely unfocusable. Without this reference a screen-reader user
    // heard the navigation label and NOTHING ELSE: device name, state, warning,
    // the whole display content of the tile was gone. The description carries it
    // back onto the one element that is still exposed. (A referenced element is
    // traversed by the accessible description computation even when it is itself
    // hidden — the same mechanism `aria-describedby` uses for `display: none`
    // help text.)
    "aria-describedby": describedBy,
    "aria-current": isCurrentPage ? "page" : undefined,
    "data-link": link.targetNodeId,
    "data-link-outcome": outcome.kind,
    onClick: () => {
      host.followLink(link);
    },
  });
}

/** One composed layer, its items placed absolutely by their author box. */
function layerCanvas(layer: PageLayer, host: PageHost): VNode {
  return h(
    "div",
    { class: ["edomi-layer", `edomi-layer-${layer.origin}`], "data-layer": layer.id },
    layer.items.map((item) => {
      const link = item.link;
      // The author's active marker (`none`/`dot`/`bar`/`border`) is pure data; the
      // skin draws it in its own language from the host's active verdict.
      const active = link ? host.isLinkActive(link) : false;
      // The id the link's description points at (see `linkOverlay`). Derived from
      // the item id, so it is stable across renders and unique per placed element.
      const bodyId = `edomi-item-body-${item.id}`;
      const overlay = link ? linkOverlay(link, host, bodyId) : null;
      return h(
        "div",
        {
          class: "edomi-item",
          "data-id": item.id,
          style: item.position ? boxStyle(item.position) : undefined,
          ...(link
            ? {
                "data-link": link.targetNodeId,
                "data-link-indicator": link.activeIndicator ?? "none",
                ...(active ? { "data-link-active": "true" } : {}),
                ...(overlay ? { "data-link-covers": "tile" } : { "data-link-unknown": "true" }),
              }
            : {}),
        },
        overlay
          ? [
              // The overlay covers the tile for the POINTER (z-index). `inert`
              // makes that true for keyboard too: without it a writable tile
              // keeps its own `role="button" tabindex="0" aria-pressed` and
              // becomes a second focus stop that announces a switch nobody can
              // reach with a mouse (WCAG 4.1.2) — the same double affordance the
              // host steps back from at the cell level. `inert` is the mechanism
              // this file already uses for nav + popups.
              //
              // But `inert` suppresses more than OPERABILITY: inert content is
              // hidden from assistive tech, so the tile's whole INFORMATION —
              // device name, state, warning — vanished with its focus stop. The
              // wrapper therefore carries an id and the link describes itself by
              // it: the content stays unoperable but stays readable.
              h("div", { class: "edomi-item-body", id: bodyId, inert: true }, [
                host.renderTile(item.id) as VNode,
              ]),
              overlay,
            ]
          : [host.renderTile(item.id) as VNode],
      );
    }),
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
