// I-media (#30) — TDD für die media-Kachel des Ionic-Skins (Vertrag v1.2).
//
// Belegt: die reine Renderer-Funktion liefert für jede media-Fixture (playing/
// paused/stopped) ein nicht-leeres, korrektes VNode (Cover · Titel/Untertitel ·
// Transport · Lautstärke) und markiert ausschließlich die kanonischen Aktionen
// über data-action (playPause · stop · next · previous · setVolume) — kein State,
// kein d.x=…, kein switch mit stillem Default (Goldene Regeln).

import { describe, expect, it } from "vitest";
import { isVNode, type VNode } from "vue";
import type { MediaDevice } from "@obs/visu-contract";
import fixtures from "@obs/visu-contract/fixtures.json" with { type: "json" };
import { MediaTile } from "../src/tiles/Media.js";
import { actions, find, findAll, flatten, text, tokensStub, ctxStub } from "./_vnode.js";

const mediaFx = fixtures.media as Record<
  "playing" | "paused" | "stopped",
  Omit<MediaDevice, "type">
>;

const asMedia = (raw: Omit<MediaDevice, "type">): MediaDevice =>
  ({ type: "media", ...raw }) as MediaDevice;

const render = (state: "playing" | "paused" | "stopped"): VNode =>
  MediaTile(asMedia(mediaFx[state]), tokensStub, ctxStub()) as VNode;

describe("ionic media tile (#30) — Player-Kachel", () => {
  it("rendert für jeden Zustand ein nicht-leeres VNode", () => {
    for (const state of ["playing", "paused", "stopped"] as const) {
      const vnode = render(state);
      expect(isVNode(vnode)).toBe(true);
      expect(vnode.type).toBe("div");
      expect(flatten(vnode).length).toBeGreaterThan(1);
    }
  });

  it("zeigt Titel + Untertitel der Fixture", () => {
    const vnode = render("playing");
    const title = find(vnode, "div", "vz-media-title");
    expect(title).toBeDefined();
    expect(text(title)).toBe("Sunset Drive");
    const sub = find(vnode, "div", "vz-media-sub");
    expect(text(sub)).toBe("The Midnight");
  });

  it("markiert die kanonischen Transport-Aktionen über data-action", () => {
    const vnode = render("paused");
    const acts = actions(vnode);
    for (const a of ["playPause", "stop", "next", "previous", "setVolume"]) {
      expect(acts).toContain(a);
    }
  });

  it("spiegelt playState in der Play/Pause-Taste (is-playing nur bei playing)", () => {
    const playBtn = (s: "playing" | "paused" | "stopped") =>
      flatten(render(s)).find((v) => v.props?.["data-action"] === "playPause");

    const playing = playBtn("playing");
    expect(playing).toBeDefined();
    expect(String((playing!.props as Record<string, unknown>).class)).toContain("is-playing");

    const paused = playBtn("paused");
    expect(String((paused!.props as Record<string, unknown>).class)).not.toContain("is-playing");
  });

  it("trägt die Lautstärke als data-arg auf der setVolume-Steuerung", () => {
    const vnode = render("playing");
    const vol = flatten(vnode).find((v) => v.props?.["data-action"] === "setVolume");
    expect(vol).toBeDefined();
    expect((vol!.props as Record<string, unknown>)["data-arg"]).toBe("42");
  });

  it("zeigt das Cover, wenn artUrl gesetzt ist", () => {
    const withArt = MediaTile(
      asMedia({ ...mediaFx.playing, artUrl: "https://art.local/cover.jpg" }),
      tokensStub,
      ctxStub(),
    ) as VNode;
    const img = find(withArt, "img");
    expect(img).toBeDefined();
    expect((img!.props as Record<string, unknown>).src).toBe("https://art.local/cover.jpg");
  });

  it("fällt ohne artUrl auf einen Platzhalter (kein <img>) zurück", () => {
    // Alle Fixtures haben artUrl: null → Fallback-Cover, kein img-Element.
    const vnode = render("stopped");
    expect(find(vnode, "img")).toBeUndefined();
    expect(find(vnode, "div", "vz-media-cover")).toBeDefined();
  });

  it("ist nicht selbst Host: trägt einen Akzent + aria-label", () => {
    const vnode = render("playing");
    const root = vnode.props as Record<string, unknown>;
    expect(root.style).toBeDefined();
    expect(typeof root["aria-label"]).toBe("string");
  });

  it("zeigt für den gestoppten Zustand ohne Titel keinen leeren Titel-Block", () => {
    const vnode = render("stopped");
    // stopped: title=null → es darf kein vz-media-title mit Text geben.
    const titles = findAll(vnode, "div", "vz-media-title");
    for (const t of titles) expect(text(t)).not.toBe("");
  });
});
