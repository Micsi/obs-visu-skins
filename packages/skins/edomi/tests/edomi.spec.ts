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
import { readFile } from "node:fs/promises";

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
    // Page links are HOST services (contract v1.12): the stub answers, the skin
    // asks. Defaults are the reachable case; a test overrides what it needs.
    resolveLink: vi.fn((link) => ({ kind: "navigate" as const, pageId: link.targetNodeId })),
    followLink: vi.fn((link) => ({ kind: "navigate" as const, pageId: link.targetNodeId })),
    isLinkActive: vi.fn(() => false),
    linkLabel: vi.fn((link) => `zur Seite ${link.targetNodeId}`),
    ...over,
  };
}

describe("edomi manifest", () => {
  it("targets the current contract and honours position/nav/layers/popup/link", () => {
    expect(manifest.name).toBe("edomi");
    // Measured against the contract, not a literal (see ionic/terminal).
    expect(manifest.targetsContract).toBe(contractVersion);
    for (const cap of ["position", "nav", "layers", "popup", "link"]) {
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

/* ---------------------------------------- page links (contract v1.12, #146) */

/** A layer whose placed item carries a link, with the author's active marker. */
const LINKED: PageLayer[] = [
  {
    id: "bad",
    origin: "own",
    order: 0,
    items: [
      {
        id: "cam1",
        position: { x: 10, y: 20, w: 4, h: 3 },
        link: { targetNodeId: "keller", activeIndicator: "dot" },
      },
    ],
  },
];

/**
 * The point of these: the skin renders a real, named, keyboard-operable jump —
 * and every DECISION behind it (LOCATION descent, PIN gate, unknown target,
 * active state, accessible name) comes back from the host. The stub host below
 * carries an EMPTY navTree on purpose: a skin that resolved anything itself
 * could not produce the right affordance from it.
 */
function linkedHost(over: Partial<PageHost> = {}): PageHost {
  return stubHost({
    navTree: [],
    currentPageId: "bad",
    layersFor: (id: string): PageLayer[] => (id === "bad" ? LINKED : []),
    ...over,
  });
}

describe("edomi page links — the host resolves, the skin only draws", () => {
  it("asks the host what the link would do, and draws a named link affordance", () => {
    const host = linkedHost();
    const vnode = page(host);

    expect(host.resolveLink).toHaveBeenCalledWith({ targetNodeId: "keller", activeIndicator: "dot" });
    const overlay = findAll(vnode, "edomi-link")[0];
    expect(overlay).toBeDefined();
    // A real link for assistive tech, natively focusable + Enter/Space-operable.
    expect(overlay?.props?.role).toBe("link");
    expect(overlay?.props?.type).toBe("button");
    // The NAME comes from the host (golden rule 4), not from a skin-side lookup.
    expect(overlay?.props?.["aria-label"]).toBe("zur Seite keller");
    expect(host.linkLabel).toHaveBeenCalled();
  });

  it("a click follows the link through the HOST — the skin never navigates", () => {
    const host = linkedHost();
    const vnode = page(host);

    callProp(findAll(vnode, "edomi-link")[0], "onClick");

    expect(host.followLink).toHaveBeenCalledWith({ targetNodeId: "keller", activeIndicator: "dot" });
    // The skin has no navigation of its own: `navigate(pageId)` stays untouched,
    // because a link target may be a LOCATION the host has to descend first.
    expect(host.navigate).not.toHaveBeenCalled();
  });

  it("draws the author's active indicator from the HOST's verdict", () => {
    const inactive = findAll(page(linkedHost()), "edomi-item")[0];
    expect(inactive?.props?.["data-link-indicator"]).toBe("dot");
    expect(inactive?.props?.["data-link-active"]).toBeUndefined();

    const host = linkedHost({ isLinkActive: vi.fn(() => true) });
    const vnode = page(host);
    const active = findAll(vnode, "edomi-item")[0];
    expect(active?.props?.["data-link-active"]).toBe("true");
    expect(host.isLinkActive).toHaveBeenCalledWith({ targetNodeId: "keller", activeIndicator: "dot" });
    // The verdict is asked ONCE per item and reused for markup + affordance.
    expect((host.isLinkActive as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
  });

  it('does NOT claim aria-current="page" for an ANCESTOR target', () => {
    // `isLinkActive` is the host's BRANCH verdict — true for the current page OR
    // an ancestor of it. Wiring it straight to `aria-current="page"` told
    // assistive tech "this link points at the page you are on" for a link that
    // navigates somewhere else entirely. The visual branch marker stays.
    const host = linkedHost({ isLinkActive: vi.fn(() => true) });
    const vnode = page(host);
    expect(findAll(vnode, "edomi-item")[0]?.props?.["data-link-active"]).toBe("true");
    // currentPageId is "bad", the link targets "keller" — an ancestor, not here.
    expect(findAll(vnode, "edomi-link")[0]?.props?.["aria-current"]).toBeUndefined();
  });

  it('claims aria-current="page" only when the target IS the current page', () => {
    const host = linkedHost({
      isLinkActive: vi.fn(() => true),
      resolveLink: vi.fn(() => ({ kind: "navigate" as const, pageId: "bad" })),
    });
    expect(findAll(page(host), "edomi-link")[0]?.props?.["aria-current"]).toBe("page");
  });

  it("a PIN-gated target never claims to be the current page", () => {
    // `gate` leads onto the PIN path, not onto the page — even if the gated
    // pageId happened to equal the current one, the click does not land there.
    const host = linkedHost({
      isLinkActive: vi.fn(() => true),
      resolveLink: vi.fn(() => ({ kind: "gate" as const, pageId: "bad", accessNodeId: "keller" })),
    });
    expect(findAll(page(host), "edomi-link")[0]?.props?.["aria-current"]).toBeUndefined();
  });

  it("a PIN-gated target still offers the jump — onto the PIN path", () => {
    const host = linkedHost({
      resolveLink: vi.fn(() => ({ kind: "gate" as const, pageId: "technik", accessNodeId: "keller" })),
    });
    const overlay = findAll(page(host), "edomi-link")[0];

    expect(overlay?.props?.["data-link-outcome"]).toBe("gate");
    const klass = overlay?.props?.class as string[];
    expect(klass).toContain("is-gated");
  });

  it("an unknown target gets NO affordance, and says so in the DOM (rule 3)", () => {
    const host = linkedHost({
      resolveLink: vi.fn(() => ({ kind: "unknown" as const, targetNodeId: "keller" })),
    });
    const vnode = page(host);

    expect(findAll(vnode, "edomi-link")).toHaveLength(0);
    const item = findAll(vnode, "edomi-item")[0];
    expect(item?.props?.["data-link-unknown"]).toBe("true");
    // Still inspectable: the target is readable even without an affordance.
    expect(item?.props?.["data-link"]).toBe("keller");
  });

  it("leaves exactly ONE focus stop per linked item — the covered tile is inert", () => {
    // The BLOCKER a reviewer found: the overlay covers the tile for the pointer
    // (z-index), but a WRITABLE ionic tile keeps `role="button" tabindex="0"
    // aria-pressed`. Without `inert` that is a second focus stop announcing an
    // operable switch the mouse can never reach (WCAG 4.1.2) — the very double
    // affordance the host steps back from at the cell level.
    const host = linkedHost({
      renderTile: (deviceId: string) =>
        h("div", { class: "host-tile", "data-id": deviceId, role: "button", tabindex: 0 }),
    });
    const item = findAll(page(host), "edomi-item")[0];

    const body = findAll(item, "edomi-item-body")[0];
    expect(body, "the covered tile must be wrapped").toBeDefined();
    expect(body?.props?.inert).toBe(true);
    // The tile is INSIDE that wrapper, so `inert` actually covers it.
    expect(findAll(body, "host-tile")).toHaveLength(1);
    // …and the affordance itself is NOT inert.
    expect(findAll(item, "edomi-link")[0]?.props?.inert).toBeUndefined();
  });

  it("suppresses the covered tile's OPERABILITY without hiding its information", () => {
    // The regression the `inert` fix itself introduced: inert content is hidden
    // from assistive tech, not merely unfocusable. A screen-reader user heard the
    // navigation label and nothing else — device name, state, warning were gone.
    // The link therefore describes itself by the wrapper it covers.
    const host = linkedHost();
    const item = findAll(page(host), "edomi-item")[0];
    const body = findAll(item, "edomi-item-body")[0];
    const overlay = findAll(item, "edomi-link")[0];

    const bodyId = body?.props?.id;
    expect(typeof bodyId, "the covered content needs an id to be referenced").toBe("string");
    expect(bodyId).toBe("edomi-item-body-cam1");
    // The description points AT the covered content, so the tile's text is read
    // out with the link instead of being dropped with it.
    expect(overlay?.props?.["aria-describedby"]).toBe(bodyId);
    // The name still comes from the host; the description is the added part.
    expect(overlay?.props?.["aria-label"]).toBe("zur Seite keller");
  });

  it("does not wrap — and so does not inert — an item without a link", () => {
    const item = findAll(page(stubHost()), "edomi-item")[0];
    expect(findAll(item, "edomi-item-body")).toHaveLength(0);
    expect(findAll(item, "host-tile")).toHaveLength(1);
  });

  it("an unknown target leaves the tile fully operable (no overlay => no inert)", () => {
    const host = linkedHost({
      resolveLink: vi.fn(() => ({ kind: "unknown" as const, targetNodeId: "keller" })),
    });
    const item = findAll(page(host), "edomi-item")[0];
    expect(findAll(item, "edomi-item-body")).toHaveLength(0);
  });

  it("the accessible name carries the GATE state, straight from the host", () => {
    // A cursor cannot say "this asks for a PIN first" on touch or to a screen
    // reader. The host owns the state, so the host words it — the skin only
    // hands back the outcome it already holds.
    const host = linkedHost({
      resolveLink: vi.fn(() => ({ kind: "gate" as const, pageId: "technik", accessNodeId: "keller" })),
      linkLabel: vi.fn((_l, outcome) => (outcome?.kind === "gate" ? "PIN nötig" : "frei")),
    });
    const overlay = findAll(page(host), "edomi-link")[0];

    expect(overlay?.props?.["aria-label"]).toBe("PIN nötig");
    expect(host.linkLabel).toHaveBeenCalledWith(
      { targetNodeId: "keller", activeIndicator: "dot" },
      { kind: "gate", pageId: "technik", accessNodeId: "keller" },
    );
  });

  it("an item without a link is completely untouched (additive)", () => {
    const item = findAll(page(stubHost()), "edomi-item")[0];
    expect(item?.props?.["data-link"]).toBeUndefined();
    expect(item?.props?.["data-link-covers"]).toBeUndefined();
    expect(findAll(page(stubHost()), "edomi-link")).toHaveLength(0);
  });

  it("gives the jump a PERMANENTLY visible mark, not one that hangs on activeIndicator", async () => {
    // `activeIndicator` marks by contract only whether the TARGET is active, and
    // its documented default is `none`. With the mark gated on that state, a
    // linked element had no content, no border and no background: on touch it
    // looked like an ordinary tile whose own control is `inert` underneath and
    // whose tap navigates. A declared capability owes an affordance.
    const css = await readFile(new URL("../src/edomi.css", import.meta.url), "utf8");

    // Every rule block whose selector list draws something ON `.edomi-link`.
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(([, sel, body]) => ({ sel: (sel ?? "").trim(), body: body ?? "" }))
      .filter((r) => /\.edomi-link(?![\w-])/.test(r.sel));
    expect(blocks.length, "the link must be styled at all").toBeGreaterThan(0);

    const mark = blocks.filter(
      (r) => /\.edomi-link[^,]*::after/.test(r.sel) && /content\s*:/.test(r.body),
    );
    expect(mark.length, "the stretched button needs a mark of its own").toBeGreaterThan(0);
    // It carries colour (a shape nobody can see is not an affordance) …
    expect(mark.some((r) => /var\(--edomi-accent\)/.test(r.body))).toBe(true);
    // … and it is UNCONDITIONAL: no selector of the mark asks for the author's
    // active state or indicator kind.
    for (const r of mark) {
      expect(r.sel, `the mark must not hang on author state: ${r.sel}`).not.toMatch(
        /\[data-link-(active|indicator)/,
      );
    }
    // The author's own indicator stays gated exactly as before — this spec adds a
    // permanent mark, it does not turn `none` into `dot`.
    const indicator = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(([, sel]) => (sel ?? "").trim())
      .filter((sel) => /data-link-indicator/.test(sel));
    expect(indicator.length).toBeGreaterThan(0);
    for (const sel of indicator) expect(sel).toMatch(/data-link-active/);
  });

  /**
   * A TRIPWIRE, not "the proof". It reads one WINDOW of the file (the link code
   * path) and would NOT catch a tree descent placed above `linkOverlay` and
   * passed in — a reviewer demonstrated exactly that. It is kept because it
   * catches the likely regression (someone reaching for the tree right where the
   * link is drawn) cheaply.
   *
   * The load-bearing proof is behavioural and lives above: every link spec drives
   * a stub host whose `navTree` is EMPTY, so a skin that resolved anything itself
   * could not produce the right affordance at all.
   */
  it("tripwire: the link code path holds no tree- or access-logic of its own", async () => {
    const url = new URL("../src/page.ts", import.meta.url);
    const src = await readFile(url, "utf8");
    const start = src.indexOf("function linkOverlay");
    const end = src.indexOf("/** The bounding extent");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const region = src.slice(start, end);

    for (const forbidden of ["navTree", ".access", ".children", "parent_id", "parentOf"]) {
      expect(region, `link code must not touch ${forbidden}`).not.toContain(forbidden);
    }
    // What it DOES do is call the host.
    for (const call of ["host.resolveLink", "host.followLink", "host.isLinkActive", "host.linkLabel"]) {
      expect(region).toContain(call);
    }
  });
});
