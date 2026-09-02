import { describe, it, expect, vi } from "vitest";
import {
  version as contractVersion,
  type PageHost,
  type PageLayer,
  type PopupDescriptor,
} from "@obs/visu-contract";

import manifest from "../manifest.json";
import { tiles, details, presets, page } from "../renderers";
import { h, isVNode } from "vue";

/**
 * @obs-visu-skins/edomi — the pixel POC skin.
 *
 * It owns the page via a `page` renderer (nav + composed pixel layers + popups),
 * re-using the ionic content tiles. These tests pin the manifest shape (targets
 * the current contract, honours position/nav/layers/popup) and that the page
 * renderer draws the nav, places layer items by their author box, and renders
 * host-owned popups —
 * driving a stub PageHost so no app/host is needed.
 */

interface VNodeish {
  props?: Record<string, unknown> | null;
  children?: unknown;
}
function findAll(node: unknown, cls: string, acc: VNodeish[] = []): VNodeish[] {
  if (!node || typeof node !== "object") return acc;
  const v = node as VNodeish;
  const rawClass = v.props?.class;
  const klass = Array.isArray(rawClass) ? rawClass.join(" ") : (rawClass ?? "");
  if (typeof klass === "string" && klass.split(" ").includes(cls)) acc.push(v);
  const kids = v.children;
  if (Array.isArray(kids)) for (const c of kids) findAll(c, cls, acc);
  else if (kids && typeof kids === "object") findAll(kids, cls, acc);
  return acc;
}
/** Read a prop as a callable and invoke it (test helper; props are loosely typed). */
function callProp(node: VNodeish | undefined, name: string): void {
  (node?.props?.[name] as (() => void) | undefined)?.();
}

function stubHost(over: Partial<PageHost> = {}): PageHost {
  return {
    navTree: [
      { id: "eg", name: "Erdgeschoss", type: "PAGE", access: "public", children: [
        { id: "bad", name: "Bad", type: "PAGE", access: "protected", children: [] },
      ] },
    ],
    currentPageId: "bad",
    navigate: vi.fn(),
    layersFor: (id: string): PageLayer[] =>
      id === "bad"
        ? [{ id: "bad", origin: "own", order: 0, items: [{ id: "w1", position: { x: 10, y: 20, w: 4, h: 3 } }] }]
        : [],
    renderTile: (deviceId: string) => h("div", { class: "host-tile", "data-id": deviceId }),
    openPopups: [],
    openPopup: vi.fn(),
    closePopup: vi.fn(),
    ...over,
  };
}

describe("edomi manifest", () => {
  it("targets the current contract and honours position/nav/layers/popup", () => {
    expect(manifest.name).toBe("edomi");
    // Measured against the contract, not a literal (see ionic/terminal).
    expect(manifest.targetsContract).toBe(contractVersion);
    for (const cap of ["position", "nav", "layers", "popup"]) {
      expect(manifest.layout.honors).toContain(cap);
    }
    expect(manifest.unsupported).toEqual([]);
  });

  it("re-uses the ionic content renderers incl. the preset surface + declares gestures", () => {
    expect(tiles).toBeTypeOf("object");
    expect(details).toBeTypeOf("object");
    expect(presets).toBeTypeOf("object");
    expect(typeof page).toBe("function");
    // presets keep the blind/jalousie long-press surface, so the manifest must
    // declare the matching gesture that routes a long-press to them.
    expect((manifest as { gestures?: { longPress?: string } }).gestures?.longPress).toBe("presets");
  });
});

describe("edomi page renderer", () => {
  it("draws the nav from the tree and marks the current page active", () => {
    const vnode = page(stubHost());
    expect(isVNode(vnode)).toBe(true);
    const links = findAll(vnode, "edomi-nav-link");
    const active = findAll(vnode, "is-active");
    expect(links.length).toBeGreaterThanOrEqual(2); // eg + bad
    expect(active.length).toBe(1);
  });

  it("navigates the host when a page nav link is clicked", () => {
    const host = stubHost();
    const vnode = page(host);
    const egLink = findAll(vnode, "edomi-nav-link").find((n) => n.props?.["data-page"] === "eg");
    callProp(egLink, "onClick");
    expect(host.navigate).toHaveBeenCalledWith("eg");
  });

  it("places the current page's layer items by their author box via host tiles", () => {
    const vnode = page(stubHost());
    const items = findAll(vnode, "edomi-item");
    expect(items).toHaveLength(1);
    const style = items[0]?.props?.style as Record<string, string>;
    expect(style.position).toBe("absolute");
    // Plain px (x=10, w=4) — no typed calc(var()*n), which older WebViews reject.
    expect(style.left).toBe("10px");
    expect(style.width).toBe("4px");
    // the host tile is nested inside the placed item
    expect(findAll(items[0], "host-tile")).toHaveLength(1);
  });

  it("renders host-owned popups with a working close button", () => {
    const popups: PopupDescriptor[] = [{ id: "bad", modal: true, dimBackdrop: true, shadow: true }];
    const host = stubHost({ openPopups: popups });
    const vnode = page(host);
    const wrap = findAll(vnode, "edomi-popup-wrap");
    expect(wrap).toHaveLength(1);
    const close = findAll(vnode, "edomi-popup-close")[0];
    callProp(close, "onClick");
    expect(host.closePopup).toHaveBeenCalledWith("bad");
  });
});
