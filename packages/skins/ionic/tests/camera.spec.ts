// I-camera (#30) — TDD für die camera-Kachel des Ionic-Skins (Vertrag v1.2).
//
// Belegt: die reine Renderer-Funktion liefert für jede camera-Fixture (online/
// offline) ein nicht-leeres, korrektes VNode (Standbild · online-Indikator) und
// markiert ausschließlich die kanonische Aktion refresh über data-action — kein
// State, kein d.x=…, Fallback/Platzhalter bei null/offline (Goldene Regeln).

import { describe, expect, it } from "vitest";
import { isVNode, type VNode } from "vue";
import type { CameraDevice } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import { CameraTile } from "../src/tiles/Camera.js";
import { actions, classOf, find, flatten, tokensStub, ctxStub } from "./_vnode.js";

const cameraFx = fixtures.camera as Record<"online" | "offline", Omit<CameraDevice, "type">>;

const asCamera = (raw: Omit<CameraDevice, "type">): CameraDevice =>
  ({ type: "camera", ...raw }) as CameraDevice;

const render = (state: "online" | "offline"): VNode =>
  CameraTile(asCamera(cameraFx[state]), tokensStub, ctxStub()) as VNode;

describe("ionic camera tile (#30) — Kamera-Kachel", () => {
  it("rendert für jeden Zustand ein nicht-leeres VNode", () => {
    for (const state of ["online", "offline"] as const) {
      const vnode = render(state);
      expect(isVNode(vnode)).toBe(true);
      expect(vnode.type).toBe("div");
      expect(flatten(vnode).length).toBeGreaterThan(1);
    }
  });

  it("zeigt das Standbild, wenn online + snapshotUrl gesetzt sind", () => {
    const vnode = render("online");
    const img = find(vnode, "img");
    expect(img).toBeDefined();
    expect((img!.props as Record<string, unknown>).src).toBe(
      "https://cam.local/front/snapshot.jpg",
    );
  });

  it("fällt offline (snapshotUrl null) auf einen Platzhalter zurück (kein <img>)", () => {
    const vnode = render("offline");
    expect(find(vnode, "img")).toBeUndefined();
    expect(find(vnode, "div", "vz-cam-placeholder")).toBeDefined();
  });

  it("markiert die kanonische Aktion refresh über data-action", () => {
    expect(actions(render("online"))).toContain("refresh");
    expect(actions(render("offline"))).toContain("refresh");
  });

  it("spiegelt den online-Zustand im Tile-Klassennamen (is-online nur online)", () => {
    expect(classOf(render("online"))).toContain("is-online");
    expect(classOf(render("offline"))).not.toContain("is-online");
  });

  it("zeigt einen online/offline-Indikator", () => {
    const on = find(render("online"), "span", "vz-cam-dot");
    expect(on).toBeDefined();
    const off = find(render("offline"), "span", "vz-cam-dot");
    expect(off).toBeDefined();
  });

  it("trägt einen Akzent + aria-label (kein eigener State)", () => {
    const root = render("online").props as Record<string, unknown>;
    expect(root.style).toBeDefined();
    expect(typeof root["aria-label"]).toBe("string");
  });
});
