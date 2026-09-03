// TDD-Spec für den Konformitäts-Generator (ARCHITECTURE.md §2).
//
// Positiv: der vollständige ionic-Skin (alle neun Kern-Typen inkl. climate supported,
// unsupported=[]) → kein gap. Die Stufe je Typ folgt der Aktions-Abdeckung gegen den
// Vertrag (§6): alle kanonischen Aktionen = "full", ein Teil = "partial", der Vertrag
// kennt keine Aktion (sensor) = "display".
// Negativ: ein konstruierter Skin-Stub mit deklariertem widget aber fehlendem Renderer
// → "gap"; ein werfender Renderer → "broken". Beides Exit != 0.

import { describe, expect, it } from "vitest";
import type { Renderer, SkinManifest } from "@obs/visu-contract";
import { tiles } from "@obs-visu-skins/ionic";
import ionicManifest from "@obs-visu-skins/ionic/manifest.json" with { type: "json" };
import { version as contractVersion } from "@obs/visu-contract";
import {
  CORE_WIDGET_TYPES,
  LAYOUT_HONORS,
  checkHonors,
  collectActions,
  generateSupport,
  type RendererMap,
} from "../index.js";

const ionic = ionicManifest as unknown as SkinManifest;

describe("generateSupport — ionic (vollständig)", () => {
  it("meldet keine gap/broken und deckt alle neun Kern-Typen ab", () => {
    const { report, hasGap } = generateSupport({ manifest: ionic, tiles });

    expect(hasGap).toBe(false);
    expect(report.skin).toBe("ionic");
    // Der Report reicht die Zielversion des Manifests durch. Bewusst gegen den
    // Vertrag gemessen statt gegen ein Literal: ein Literal hier bliebe gruen,
    // waehrend der Skin hinter dem Vertrag herhinkt - genau der stille Drift,
    // den der Bump auf 1.11 sichtbar machen soll.
    expect(report.targetsContract).toBe(contractVersion);

    // support.json deckt genau die neun Kern-Typen ab (v1.4: inkl. climate).
    expect(Object.keys(report.widgets).sort()).toEqual([...CORE_WIDGET_TYPES].sort());

    // Kein Typ ist offen oder kaputt. Bewusst KEINE Stufen-Erwartung je Typ: die
    // hinge an ionics Manifest, das eine fremde Arbeitslinie ändern darf. `sensor`
    // ist die eine Ausnahme — dass er nie "full" werden kann, folgt aus dem VERTRAG
    // (er kennt für sensor keine Aktion), nicht aus ionics Deklaration.
    expect(report.widgets.sensor?.level).toBe("display");
    expect(report.summary.gap).toBe(0);
    expect(report.summary.broken).toBe(0);
    expect(report.summary.unsupported).toBe(0);
  });

  it("spiegelt nicht die eigene Zielversion, sondern den echten Vertragsstand", () => {
    const { report } = generateSupport({ manifest: ionic, tiles });
    expect(report.contractLatest).toBe(contractVersion);
  });

  it("nennt je Typ die Aktions-Abdeckung, die Fixtures und die Renderer-Herkunft", () => {
    const { report } = generateSupport({ manifest: ionic, tiles });
    // camera kennt genau eine kanonische Aktion (refresh) und zwei Fixtures.
    expect(report.widgets.camera?.actions).toBe("1/1");
    expect(report.widgets.camera?.fixtures).toEqual(["online", "offline"]);
    // Fläche + Implementierung: zwei Skins mit derselben Implementierung (edomi
    // re-exportiert ionics Renderer) sind daran im Report erkennbar.
    expect(report.widgets.camera?.render).toMatch(/^tile:\S+/);
  });

  it("übernimmt das Layout-Modell aus dem geprüften Manifest", () => {
    // Bewusst gegen ein EIGENES Fixture-Manifest, nicht gegen ionic: sonst würde
    // diese Spec im geteilten Tooling rot, sobald ein fremder Skin sein `honors` ändert.
    const manifest: SkinManifest = {
      ...ionic,
      name: "layout-fixture",
      layout: { model: "grid", honors: ["order", "grouping", "role"] },
    };
    const { report } = generateSupport({ manifest, tiles });
    expect(report.layout).toEqual({ model: "grid", honors: ["order", "grouping", "role"] });
  });

  it("schreibt einen deterministischen Zeitstempel über die injizierte now-Quelle", () => {
    const fixed = new Date("2026-06-11T00:00:00.000Z");
    const { report } = generateSupport({ manifest: ionic, tiles }, () => fixed);
    expect(report.generatedAt).toBe("2026-06-11T00:00:00.000Z");
  });
});

describe("generateSupport — gap-hart", () => {
  // Renderer-Stub: reine Funktion, markiert nichts (Form egal für die gap-Prüfung).
  const stubRenderer: Renderer = () => ({ tag: "div" });

  /**
   * Renderer, der die genannten Aktionen wirklich markiert. Seit die Aktions-Achse
   * am Baum gemessen wird, reicht ein stummer Stub für Stufen-Erwartungen nicht mehr —
   * genau das ist der Punkt.
   */
  const marking =
    (...actions: string[]): Renderer =>
    () => ({
      type: "div",
      props: {},
      children: actions.map((a) => ({ type: "button", props: { "data-action": a }, children: a })),
    });

  it('meldet "gap" für ein deklariertes widget ohne passenden tiles-Renderer', () => {
    const brokenManifest: SkinManifest = {
      name: "broken",
      targetsContract: "1.1",
      unsupported: ["camera", "media", "climate"],
      widgets: {
        light: { actions: ["toggle"] },
        switch: { actions: ["toggle"] },
        blind: { actions: ["setPosition"] },
        jalousie: { actions: ["setPosition"] },
        sensor: { actions: [] },
        scene: { actions: ["activateScene"] },
      },
      layout: { model: "grid", honors: ["order"] },
    };
    // light ist deklariert, aber es gibt KEINEN light-Renderer → gap.
    const partialTiles: RendererMap = {
      switch: stubRenderer,
      blind: stubRenderer,
      jalousie: stubRenderer,
      sensor: stubRenderer,
      scene: stubRenderer,
    };

    const { report, hasGap } = generateSupport({
      manifest: brokenManifest,
      tiles: partialTiles,
    });

    expect(hasGap).toBe(true);
    expect(report.widgets.light?.level).toBe("gap");
    expect(report.summary.gap).toBe(1);
  });

  it('meldet "gap" für einen Renderer ohne widgets-Deklaration', () => {
    const manifest: SkinManifest = {
      name: "undeclared",
      targetsContract: "1.1",
      unsupported: ["camera", "media", "climate"],
      widgets: {
        // scene fehlt in der Deklaration, hat aber unten einen Renderer.
        light: { actions: ["toggle"] },
        switch: { actions: ["toggle"] },
        blind: { actions: ["setPosition"] },
        jalousie: { actions: ["setPosition"] },
        sensor: { actions: [] },
      },
      layout: { model: "grid", honors: ["order"] },
    };
    const tilesWithUndeclared: RendererMap = {
      light: stubRenderer,
      switch: stubRenderer,
      blind: stubRenderer,
      jalousie: stubRenderer,
      sensor: stubRenderer,
      scene: stubRenderer,
    };

    const { report, hasGap } = generateSupport({ manifest, tiles: tilesWithUndeclared });

    expect(hasGap).toBe(true);
    expect(report.widgets.scene?.level).toBe("gap");
  });

  it('markiert in unsupported deklarierte Kern-Typen als "unsupported" (kein gap)', () => {
    const manifest: SkinManifest = {
      name: "minimal",
      targetsContract: "1.1",
      // sensor + scene bewusst als unsupported deklariert (climate ebenso, v1.4).
      unsupported: ["camera", "media", "sensor", "scene", "climate"],
      widgets: {
        light: { actions: ["toggle"] },
        switch: { actions: ["toggle"] },
        blind: { actions: ["setPosition"] },
        jalousie: { actions: ["setPosition"] },
      },
      layout: { model: "grid", honors: ["order"] },
    };
    const partialTiles: RendererMap = {
      light: marking("toggle"),
      switch: marking("toggle"),
      blind: marking("setPosition"),
      jalousie: marking("setPosition"),
    };

    const { report, hasGap } = generateSupport({ manifest, tiles: partialTiles });

    expect(hasGap).toBe(false);
    expect(report.widgets.sensor?.level).toBe("unsupported");
    expect(report.widgets.scene?.level).toBe("unsupported");
    // camera + media + sensor + scene + climate als unsupported deklariert (v1.4: 9 Kern-Typen).
    expect(report.summary.unsupported).toBe(5);
    // switch deckt seine einzige kanonische Aktion ab (full); light/blind/jalousie
    // verdrahten nur einen Teil → partial. Der Generator vergibt die Stufe, der Skin
    // behauptet sie nicht selbst.
    expect(report.widgets.switch?.level).toBe("full");
    expect(report.widgets.light?.level).toBe("partial");
    expect(report.widgets.light?.actions).toBe("1/2");
    expect(report.summary.full).toBe(1);
    expect(report.summary.partial).toBe(3);
  });

  it("misst die Aktions-Achse am gerenderten Baum, nicht am Manifest", () => {
    // Der Renderer markiert NICHTS — das Manifest behauptet trotzdem beide Aktionen.
    // Genau diese Lücke soll sichtbar werden: die Stufe folgt dem Baum.
    const silent: Renderer = () => ({ type: "div", props: {}, children: [] });
    const manifest: SkinManifest = {
      name: "claims-too-much",
      targetsContract: "1.10",
      unsupported: ["blind", "jalousie", "sensor", "scene", "media", "camera", "climate"],
      widgets: {
        light: { actions: ["toggle", "setDim"] },
        switch: { actions: ["toggle"] },
      },
      layout: { model: "list", honors: ["order"] },
    };

    const { report, hasGap } = generateSupport({
      manifest,
      tiles: { light: silent, switch: silent },
    });

    // Unbelegte Behauptung ist kein harter Fehler — aber sie hebt die Stufe nicht
    // und wird beim Namen genannt.
    expect(hasGap).toBe(false);
    expect(report.widgets.light?.level).toBe("display");
    expect(report.widgets.light?.actions).toBe("0/2");
    expect(report.widgets.light?.reason).toContain("declared but never marked: setDim, toggle");
  });

  it("zählt eine Aktion, die nur die Detailfläche markiert, als angeboten", () => {
    const silent: Renderer = () => ({ type: "div", props: {}, children: [] });
    const toggleInDetail: Renderer = () => ({
      type: "div",
      props: { "data-action": "toggle" },
      children: [{ type: "b", props: { "data-action": "setDim" }, children: "45" }],
    });
    const manifest: SkinManifest = {
      name: "detail-surface",
      targetsContract: "1.10",
      unsupported: ["switch", "blind", "jalousie", "sensor", "scene", "media", "camera", "climate"],
      widgets: { light: { actions: ["toggle", "setDim"] } },
      layout: { model: "grid", honors: ["order"] },
    };

    const { report } = generateSupport({
      manifest,
      tiles: { light: silent },
      details: { light: toggleInDetail },
    });

    expect(report.widgets.light?.level).toBe("full");
    expect(report.widgets.light?.actions).toBe("2/2");
    expect(report.widgets.light?.render).toContain("detail:");
  });

  it('meldet "broken", wenn ein Renderer eine nicht deklarierte Aktion markiert', () => {
    // Goldene Regel 3: nicht verdrahtet darf nie vorgetäuscht werden.
    const liar: Renderer = () => ({
      type: "div",
      props: { "data-action": "setDim" },
      children: [],
    });
    const manifest: SkinManifest = {
      name: "pretender",
      targetsContract: "1.10",
      unsupported: ["switch", "blind", "jalousie", "sensor", "scene", "media", "camera", "climate"],
      widgets: { light: { actions: ["toggle"] } },
      layout: { model: "grid", honors: ["order"] },
    };

    const { report, hasGap } = generateSupport({ manifest, tiles: { light: liar } });

    expect(hasGap).toBe(true);
    expect(report.widgets.light?.level).toBe("broken");
    expect(report.widgets.light?.reason).toContain("marks undeclared action(s): setDim");
  });

  it("duldet universelle Host-Aktionen ohne Deklaration (§6)", () => {
    const hostMarks: Renderer = () => ({
      type: "div",
      props: { "data-action": "openDetail" },
      children: [{ type: "button", props: { "data-action": "stop" }, children: "■" }],
    });
    const manifest: SkinManifest = {
      name: "host-actions",
      targetsContract: "1.10",
      unsupported: ["light", "switch", "jalousie", "sensor", "scene", "media", "camera", "climate"],
      // `stop` ist für Bewegungs-Widgets UI-only, `openDetail` universell — beide
      // brauchen laut Vertrag keine Deklaration je Widget.
      widgets: { blind: { actions: ["setPosition"] } },
      layout: { model: "grid", honors: ["order"] },
    };

    const { report, hasGap } = generateSupport({ manifest, tiles: { blind: hostMarks } });

    expect(hasGap).toBe(false);
    expect(report.widgets.blind?.level).not.toBe("broken");
  });

  it("liest data-action auch aus rohem Markup (Renderer ohne Framework)", () => {
    expect(
      [...collectActions('<div data-action="toggle"><b data-action="lock"/></div>')].sort(),
    ).toEqual(["lock", "toggle"]);
  });

  it('meldet "broken" für einen Renderer, der an einer Vertrags-Fixture wirft', () => {
    const throwing: Renderer = () => {
      throw new Error("boom");
    };
    const manifest: SkinManifest = {
      name: "throwing",
      targetsContract: "1.10",
      unsupported: ["camera", "media", "climate", "sensor", "scene", "blind", "jalousie"],
      widgets: {
        light: { actions: ["toggle", "setDim"] },
        switch: { actions: ["toggle"] },
      },
      layout: { model: "list", honors: ["order"] },
    };

    const { report, hasGap } = generateSupport({
      manifest,
      tiles: { light: throwing, switch: stubRenderer },
    });

    // broken ist wie gap eine Fehlerstufe → Exit != 0.
    expect(hasGap).toBe(true);
    expect(report.widgets.light?.level).toBe("broken");
    expect(report.widgets.light?.reason).toContain("boom");
    expect(report.summary.broken).toBe(1);
  });
});

/* ------------------------------------------- honors-Achse (Vertrag 1.12, #146) */

const honorsSkin = (honors: string[], page?: (host: never) => unknown) => ({
  manifest: {
    name: "honors-stub",
    targetsContract: contractVersion,
    unsupported: [],
    widgets: {},
    layout: { model: "grid", honors },
  } as unknown as SkinManifest,
  tiles: {} as RendererMap,
  ...(page ? { page: page as never } : {}),
});

describe("honors-Achse — der Deklarations-Slot wird gemessen, nicht geglaubt", () => {
  it("kennt das Vokabular AUS dem Vertrag, nicht aus einer Kopie", () => {
    // Kommt die Liste aus dem Schema, wächst sie mit jedem Vertrags-Bump mit.
    expect(LAYOUT_HONORS).toContain("link");
    expect(LAYOUT_HONORS).toContain("order");
  });

  it("lehnt einen unbekannten honors-String ab (ein Tippfehler wäre sonst stumm)", () => {
    const findings = checkHonors(honorsSkin(["order", "positon"]));
    expect(findings.map((f) => [f.token, f.problem])).toEqual([["positon", "unknown"]]);
  });

  it("akzeptiert das gesamte Vertrags-Vokabular", () => {
    // `link` braucht zusätzlich einen liefernden Page-Renderer, daher separat.
    const vocabulary = LAYOUT_HONORS.filter((t) => t !== "link");
    expect(checkHonors(honorsSkin([...vocabulary]))).toEqual([]);
  });

  it("`link` ohne Page-Renderer: nichts kann den Sprung zeichnen", () => {
    const findings = checkHonors(honorsSkin(["link"]));
    expect(findings.map((f) => f.problem)).toEqual(["unrenderable"]);
  });

  it("`link` deklariert, aber der Page-Renderer zeichnet nichts => undelivered", () => {
    // Genau die Kehrseite, die #146 beklagt: der Host tritt wegen der Deklaration
    // mit SEINER Affordanz zurück — zeichnet der Skin dann nichts, gibt es gar keine.
    const findings = checkHonors(honorsSkin(["link"], () => "<div/>"));
    expect(findings.map((f) => f.problem)).toEqual(["undelivered"]);
  });

  it("den Host nur zu FRAGEN reicht nicht — es muss eine Affordanz entstehen", () => {
    // Die Gegenprobe, die diesen Prüfer überhaupt erst geschärft hat: ein Skin,
    // der `isLinkActive` fürs Markup aufruft und den Sprung dann weglässt, kam
    // durch die frühere "hat gefragt"-Fassung glatt durch.
    const asksOnly = (host: never) => {
      const h = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        isLinkActive: (l: unknown) => boolean;
      };
      for (const layer of h.layersFor(h.currentPageId)) {
        for (const item of layer.items) if (item.link) h.isLinkActive(item.link);
      }
      return "<div/>";
    };
    expect(checkHonors(honorsSkin(["link"], asksOnly)).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("`link` + eine aktivierbare Affordanz, die followLink ruft => sauber", () => {
    const page = (host: never) => {
      const h = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const children: unknown[] = [];
      for (const layer of h.layersFor(h.currentPageId)) {
        for (const item of layer.items) {
          if (item.link) children.push({ props: { onClick: () => h.followLink(item.link) } });
        }
      }
      return { props: {}, children };
    };
    expect(checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("ein honors-Befund ist ein harter Fehler wie eine gap", () => {
    const { hasGap, honors } = generateSupport(honorsSkin(["nope"]));
    expect(honors).toHaveLength(1);
    expect(hasGap).toBe(true);
  });
});
