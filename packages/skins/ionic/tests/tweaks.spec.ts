// I5 #8 — Tweak-Anwendung: applyTweaks bildet Tweak-Werte rein auf Wurzel-Attribute
// + CSS-Custom-Properties ab (Spiegel von app.js rootStyle + data-* auf .visu-root).
// TDD: belegt Defaults, Attribut-Verdrahtung, Klemmen an den Extremen (AA-Boden)
// und die State-Freiheit (gleiche Eingabe → gleiche Ausgabe, keine Mutation).

import { describe, expect, it } from "vitest";
import manifest from "../manifest.json" with { type: "json" };
import { applyTweaks, TWEAK_DEFAULTS } from "../src/tweaks.js";

describe("ionic skin — applyTweaks (I5)", () => {
  it("liefert für leere Eingabe die sauberen Defaults als Attribute", () => {
    const { attrs } = applyTweaks();
    expect(attrs["data-stil"]).toBe("glass");
    expect(attrs["data-acc-style"]).toBe("bar");
    expect(attrs["data-theme"]).toBe("image");
    expect(attrs["data-room-group"]).toBe("labels");
    expect(attrs["data-titlebar"]).toBe("0");
  });

  it("setzt die numerischen Tweaks als CSS-Custom-Properties", () => {
    const { style } = applyTweaks();
    expect(style["--vz-blur"]).toBe("22px");
    expect(style["--vz-tile-alpha"]).toBe("0.55");
    expect(style["--vz-cell"]).toBe("108px");
    expect(style["--vz-glow"]).toBe("1");
    expect(style["--vz-room-gap"]).toBe("22px");
  });

  it("skaliert die Zellhöhe über cellScale", () => {
    expect(applyTweaks({ cellScale: 1.4 }).style["--vz-cell"]).toBe("151px");
    expect(applyTweaks({ cellScale: 0.8 }).style["--vz-cell"]).toBe("86px");
  });

  it("reicht stil/accentStyle/theme als Attribute durch", () => {
    const { attrs } = applyTweaks({ stil: "md", accentStyle: "ring", theme: "dark" });
    expect(attrs["data-stil"]).toBe("md");
    expect(attrs["data-acc-style"]).toBe("ring");
    expect(attrs["data-theme"]).toBe("dark");
  });

  it("zeigt die Titelleiste, wenn showTitlebar=true", () => {
    expect(applyTweaks({ showTitlebar: true }).attrs["data-titlebar"]).toBe("1");
  });

  it("klemmt Slider an die Manifest-Grenzen (AA-Boden an den Extremen)", () => {
    const lo = applyTweaks({ glassBlur: -10, tileAlpha: 0.1, cellScale: 0.1, glow: -1 });
    expect(lo.style["--vz-blur"]).toBe("0px");
    expect(lo.style["--vz-tile-alpha"]).toBe("0.3");
    expect(lo.style["--vz-cell"]).toBe("86px"); // clamp 0.8 → 108*0.8
    expect(lo.style["--vz-glow"]).toBe("0");

    const hi = applyTweaks({ glassBlur: 999, tileAlpha: 9, cellScale: 9, glow: 9 });
    expect(hi.style["--vz-blur"]).toBe("40px");
    expect(hi.style["--vz-tile-alpha"]).toBe("0.9");
    expect(hi.style["--vz-cell"]).toBe("151px"); // clamp 1.4 → 108*1.4
    expect(hi.style["--vz-glow"]).toBe("1.6");
  });

  it("setzt den Raumabstand auf 0, wenn roomGroup=off", () => {
    const { style } = applyTweaks({ roomGroup: "off", roomGap: 40 });
    expect(style["--vz-room-gap"]).toBe("0px");
  });

  it("setzt Akzentfarbe und Hintergrundbild nur, wenn der Host sie liefert", () => {
    expect(applyTweaks().style["--vz-accent"]).toBeUndefined();
    const set = applyTweaks({ accent: "#45b1ae", photo: "p.jpg" });
    expect(set.style["--vz-accent"]).toBe("#45b1ae");
    expect(set.style["--vz-photo"]).toBe("url('p.jpg')");
  });

  it("maskiert Anführungszeichen/Backslashes in der Foto-URL (kein CSS-Bruch)", () => {
    expect(applyTweaks({ photo: "Kid's room.jpg" }).style["--vz-photo"]).toBe(
      "url('Kid\\'s room.jpg')",
    );
    expect(applyTweaks({ photo: "a\\b.jpg" }).style["--vz-photo"]).toBe("url('a\\\\b.jpg')");
  });

  it("validiert Select-Tweaks gegen die Manifest-Optionen (Fallback auf Default)", () => {
    const bogus = applyTweaks({
      // ungültige/veraltete Werte (z. B. aus persistiertem JSON eines älteren Hosts)
      stil: "neon" as never,
      theme: "midnight" as never,
      accentStyle: "halo" as never,
      roomGroup: "stacked" as never,
    });
    expect(bogus.attrs["data-stil"]).toBe(TWEAK_DEFAULTS.stil);
    expect(bogus.attrs["data-theme"]).toBe(TWEAK_DEFAULTS.theme);
    expect(bogus.attrs["data-acc-style"]).toBe(TWEAK_DEFAULTS.accentStyle);
    expect(bogus.attrs["data-room-group"]).toBe(TWEAK_DEFAULTS.roomGroup);
    // gültige Werte werden weiterhin durchgereicht
    const ok = applyTweaks({ stil: "md", theme: "dark", accentStyle: "ring", roomGroup: "gap" });
    expect(ok.attrs["data-stil"]).toBe("md");
    expect(ok.attrs["data-theme"]).toBe("dark");
    expect(ok.attrs["data-acc-style"]).toBe("ring");
    expect(ok.attrs["data-room-group"]).toBe("gap");
  });

  it("ist rein — gleiche Eingabe liefert gleiches Ergebnis und mutiert nicht", () => {
    const input = { stil: "ios" as const, glow: 1.2 };
    const a = applyTweaks(input);
    const b = applyTweaks(input);
    expect(a).toEqual(b);
    expect(input).toEqual({ stil: "ios", glow: 1.2 });
  });

  it("Defaults spiegeln das Manifest (stil/accentStyle/glassBlur/tileAlpha/cellScale/glow)", () => {
    const t = manifest.tweaks;
    expect(TWEAK_DEFAULTS.stil).toBe(t.stil.default);
    expect(TWEAK_DEFAULTS.accentStyle).toBe(t.accentStyle.default);
    expect(TWEAK_DEFAULTS.glassBlur).toBe(t.glassBlur.default);
    expect(TWEAK_DEFAULTS.tileAlpha).toBe(t.tileAlpha.default);
    expect(TWEAK_DEFAULTS.cellScale).toBe(t.cellScale.default);
    expect(TWEAK_DEFAULTS.glow).toBe(t.glow.default);
  });
});
