// TDD-Spec für den Konformitäts-Generator (ARCHITECTURE.md §2).
//
// Positiv: der vollständige ionic-Skin (alle neun Kern-Typen inkl. climate supported,
// unsupported=[]) → kein gap. Die Stufe je Typ folgt der Aktions-Abdeckung gegen den
// Vertrag (§6): alle kanonischen Aktionen = "full", ein Teil = "partial", der Vertrag
// kennt keine Aktion (sensor) = "display".
// Negativ: ein konstruierter Skin-Stub mit deklariertem widget aber fehlendem Renderer
// → "gap"; ein werfender Renderer → "broken". Beides Exit != 0.

import { describe, expect, it } from "vitest";
import { h, mergeProps, type VNode } from "vue";
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
  it("meldet keine gap/broken und deckt alle neun Kern-Typen ab", async () => {
    const { report, hasGap } = await generateSupport({ manifest: ionic, tiles });

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

  it("spiegelt nicht die eigene Zielversion, sondern den echten Vertragsstand", async () => {
    const { report } = await generateSupport({ manifest: ionic, tiles });
    expect(report.contractLatest).toBe(contractVersion);
  });

  it("nennt je Typ die Aktions-Abdeckung, die Fixtures und die Renderer-Herkunft", async () => {
    const { report } = await generateSupport({ manifest: ionic, tiles });
    // camera kennt genau eine kanonische Aktion (refresh) und zwei Fixtures.
    expect(report.widgets.camera?.actions).toBe("1/1");
    expect(report.widgets.camera?.fixtures).toEqual(["online", "offline"]);
    // Fläche + Implementierung: zwei Skins mit derselben Implementierung (edomi
    // re-exportiert ionics Renderer) sind daran im Report erkennbar.
    expect(report.widgets.camera?.render).toMatch(/^tile:\S+/);
  });

  it("übernimmt das Layout-Modell aus dem geprüften Manifest", async () => {
    // Bewusst gegen ein EIGENES Fixture-Manifest, nicht gegen ionic: sonst würde
    // diese Spec im geteilten Tooling rot, sobald ein fremder Skin sein `honors` ändert.
    const manifest: SkinManifest = {
      ...ionic,
      name: "layout-fixture",
      layout: { model: "grid", honors: ["order", "grouping", "role"] },
    };
    const { report } = await generateSupport({ manifest, tiles });
    expect(report.layout).toEqual({ model: "grid", honors: ["order", "grouping", "role"] });
  });

  it("schreibt einen deterministischen Zeitstempel über die injizierte now-Quelle", async () => {
    const fixed = new Date("2026-06-11T00:00:00.000Z");
    const { report } = await generateSupport({ manifest: ionic, tiles }, () => fixed);
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

  it('meldet "gap" für ein deklariertes widget ohne passenden tiles-Renderer', async () => {
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

    const { report, hasGap } = await generateSupport({
      manifest: brokenManifest,
      tiles: partialTiles,
    });

    expect(hasGap).toBe(true);
    expect(report.widgets.light?.level).toBe("gap");
    expect(report.summary.gap).toBe(1);
  });

  it('meldet "gap" für einen Renderer ohne widgets-Deklaration', async () => {
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

    const { report, hasGap } = await generateSupport({ manifest, tiles: tilesWithUndeclared });

    expect(hasGap).toBe(true);
    expect(report.widgets.scene?.level).toBe("gap");
  });

  it('markiert in unsupported deklarierte Kern-Typen als "unsupported" (kein gap)', async () => {
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

    const { report, hasGap } = await generateSupport({ manifest, tiles: partialTiles });

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

  it("misst die Aktions-Achse am gerenderten Baum, nicht am Manifest", async () => {
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

    const { report, hasGap } = await generateSupport({
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

  it("zählt eine Aktion, die nur die Detailfläche markiert, als angeboten", async () => {
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

    const { report } = await generateSupport({
      manifest,
      tiles: { light: silent },
      details: { light: toggleInDetail },
    });

    expect(report.widgets.light?.level).toBe("full");
    expect(report.widgets.light?.actions).toBe("2/2");
    expect(report.widgets.light?.render).toContain("detail:");
  });

  it('meldet "broken", wenn ein Renderer eine nicht deklarierte Aktion markiert', async () => {
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

    const { report, hasGap } = await generateSupport({ manifest, tiles: { light: liar } });

    expect(hasGap).toBe(true);
    expect(report.widgets.light?.level).toBe("broken");
    expect(report.widgets.light?.reason).toContain("marks undeclared action(s): setDim");
  });

  it("duldet universelle Host-Aktionen ohne Deklaration (§6)", async () => {
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

    const { report, hasGap } = await generateSupport({ manifest, tiles: { blind: hostMarks } });

    expect(hasGap).toBe(false);
    expect(report.widgets.blind?.level).not.toBe("broken");
  });

  it("liest data-action auch aus rohem Markup (Renderer ohne Framework)", async () => {
    expect(
      [...collectActions('<div data-action="toggle"><b data-action="lock"/></div>')].sort(),
    ).toEqual(["lock", "toggle"]);
  });

  it('meldet "broken" für einen Renderer, der an einer Vertrags-Fixture wirft', async () => {
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

    const { report, hasGap } = await generateSupport({
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

/**
 * Der Prüfer misst schmal und sagt das auch so: EIN Klick-Handler im Baum ruft
 * `followLink`. Nicht geprüft (und nicht behauptet): ob die Affordanz sichtbar,
 * fokussierbar oder bedienbar ist, oder ob sie an DIESEM Item hängt. Das trennt
 * verlässlich "zeichnet den Sprung" von "hat den Host nur gefragt" — mehr soll
 * es nicht leisten.
 */
describe("honors-Achse — der Deklarations-Slot wird gemessen, nicht geglaubt", () => {
  it("kennt das Vokabular AUS dem Vertrag, nicht aus einer Kopie", async () => {
    // Kommt die Liste aus dem Schema, wächst sie mit jedem Vertrags-Bump mit.
    expect(LAYOUT_HONORS).toContain("link");
    expect(LAYOUT_HONORS).toContain("order");
  });

  it("lehnt einen unbekannten honors-String ab (ein Tippfehler wäre sonst stumm)", async () => {
    const findings = await checkHonors(honorsSkin(["order", "positon"]));
    expect(findings.map((f) => [f.token, f.problem])).toEqual([["positon", "unknown"]]);
  });

  it("akzeptiert das gesamte Vertrags-Vokabular", async () => {
    // `link` braucht zusätzlich einen liefernden Page-Renderer, daher separat.
    const vocabulary = LAYOUT_HONORS.filter((t) => t !== "link");
    expect(await checkHonors(honorsSkin([...vocabulary]))).toEqual([]);
  });

  it("`link` ohne Page-Renderer: nichts kann den Sprung zeichnen", async () => {
    const findings = await checkHonors(honorsSkin(["link"]));
    expect(findings.map((f) => f.problem)).toEqual(["unrenderable"]);
  });

  it("`link` deklariert, aber der Page-Renderer zeichnet nichts => undelivered", async () => {
    // Genau die Kehrseite, die #146 beklagt: der Host tritt wegen der Deklaration
    // mit SEINER Affordanz zurück — zeichnet der Skin dann nichts, gibt es gar keine.
    const findings = await checkHonors(honorsSkin(["link"], () => "<div/>"));
    expect(findings.map((f) => f.problem)).toEqual(["undelivered"]);
  });

  it("den Host nur zu FRAGEN reicht nicht — followLink muss gerufen werden", async () => {
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
    expect((await checkHonors(honorsSkin(["link"], asksOnly))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("`link` + ein Klick-Handler, der followLink ruft => sauber", async () => {
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
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  /* ---------------------------------------- Gegenproben zum Probelauf selbst */

  // Die drei folgenden Specs sind Gegenproben GEGEN DEN WÄCHTER, nicht gegen einen
  // Skin: sie beschreiben je einen Renderer, der im Browser nachweislich springt
  // und den der Probelauf trotzdem ablehnte. Ohne sie bleibt "der Wächter ist
  // grün" eine Aussage über den Wächter, nicht über die Skins.

  it("ein Handler, der sein Ereignis anfasst, gilt als geliefert (nicht als undelivered)", async () => {
    // Der Normalfall in Vue: `(event) => { event.preventDefault(); … }`. Ohne
    // Ereignis-Argument warf die erste Zeile, `followLink` kam nie dran, und ein
    // konformer Skin fiel in der CI durch.
    const page = (host: never) => {
      const h = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const children: unknown[] = [];
      for (const layer of h.layersFor(h.currentPageId)) {
        for (const item of layer.items) {
          if (!item.link) continue;
          children.push({
            props: {
              onClick: (event: {
                preventDefault: () => void;
                stopPropagation: () => void;
                currentTarget: { tagName: string };
              }) => {
                event.preventDefault();
                event.stopPropagation();
                if (event.currentTarget.tagName === "NOPE") return;
                h.followLink(item.link);
              },
            },
          });
        }
      }
      return { props: {}, children };
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("ein Handler, der erst nach einem await springt, gilt als geliefert", async () => {
    const page = (host: never) => {
      const h = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const children: unknown[] = [];
      for (const layer of h.layersFor(h.currentPageId)) {
        for (const item of layer.items) {
          if (!item.link) continue;
          children.push({
            props: {
              onClick: async () => {
                await Promise.resolve();
                h.followLink(item.link);
              },
            },
          });
        }
      }
      return { props: {}, children };
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("löst Komponenten-VNodes auf — ein komponentisierter Page-Renderer liefert", async () => {
    // `h(PageComponent, { host })`: der äussere VNode trägt weder props noch
    // children mit dem Handler. Die Aktions-Achse löste das längst auf, der
    // Probelauf nicht — und wies jeden komponentisierten Skin als undelivered ab.
    const Inner = (props: { host: unknown }) => {
      const h = props.host as {
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
    const page = (host: never) => ({ type: Inner, props: { host }, children: null });
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("und der Wächter fällt weiterhin: ein leerer Komponenten-Baum ist undelivered", async () => {
    // Die Kehrprobe zur Komponenten-Auflösung. Ohne sie belegte die Spec oben nur,
    // dass etwas grün wird — nicht, dass die Auflösung noch etwas ablehnen kann.
    const Empty = () => ({ props: {}, children: [] });
    const page = (host: never) => ({ type: Empty, props: { host }, children: null });
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  /* ------------------------- Listener-Formen, mit ECHTEM Vue gebaut (Runde 3) */

  /**
   * Warum eine Tabelle statt Einzelfällen: G1/G2/G3 waren drei Varianten
   * DERSELBEN Frage — sieht die Probe, was der Browser sieht? Einzelspecs
   * beantworten sie je einmal; eine Tabelle über die Formen, die Vue wirklich
   * erzeugt, deckt das Feld ab und wächst mit, wenn eine Form dazukommt.
   *
   * Die Bäume baut deshalb ECHTES Vue (`h`, `mergeProps`, eine Options-API-
   * Komponente), nicht meine Vorstellung davon, wie ein VNode aussieht — sonst
   * prüfte die Spec nur, dass zwei Nachbildungen zueinander passen.
   *
   * Was die Probe NICHT tut (und bewusst nicht): den Baum mit Vue mounten und
   * einen echten Klick schicken. Das wäre die höchste Treue, verlangte aber ein
   * DOM und machte Vue zur Pflicht-Abhängigkeit des Konformitätslaufs — und der
   * Vertrag erlaubt ausdrücklich Skins OHNE Vue (`Renderer` darf rohes Markup
   * liefern, `collectActions` liest genau das). Der Wächter bleibt deshalb
   * framework-neutral; nur seine GEGENPROBEN fahren echtes Vue.
   */

  /** Ein Page-Renderer, der den Sprung mit genau diesen Props zeichnet. */
  function pageDrawing(propsFor: (follow: () => void) => Record<string, unknown>) {
    return (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const children: VNode[] = [];
      for (const layer of svc.layersFor(svc.currentPageId)) {
        for (const item of layer.items) {
          if (!item.link) continue;
          children.push(h("button", propsFor(() => void svc.followLink(item.link))));
        }
      }
      return h("div", null, children);
    };
  }

  // Die Namen sind exakt die, die Vues Compiler aus den Ereignis-Modifikatoren
  // erzeugt: `.once` → onClickOnce, `.capture` → onClickCapture, `.passive` →
  // onClickPassive, kombinierbar. Der Browser ruft sie alle als Klick-Handler.
  const CLICK_FORMS: [string, (f: () => void) => Record<string, unknown>][] = [
    ["onClick", (f) => ({ onClick: f })],
    ["onclick (roher DOM-Name)", (f) => ({ onclick: f })],
    ["onClickOnce (.once)", (f) => ({ onClickOnce: f })],
    ["onClickCapture (.capture)", (f) => ({ onClickCapture: f })],
    ["onClickOnceCapture (.once.capture)", (f) => ({ onClickOnceCapture: f })],
    ["onClickPassive (.passive)", (f) => ({ onClickPassive: f })],
    // mergeProps ist Vues eigene Funktion — sie macht aus zwei Listenern ein
    // ARRAY unter einem Namen. `typeof value === "function"` sah davon nichts.
    ["Array nach mergeProps", (f) => mergeProps({ onClick: () => {} }, { onClick: f })],
  ];

  for (const [name, propsFor] of CLICK_FORMS) {
    it(`zählt die Listener-Form ${name}`, async () => {
      expect(await checkHonors(honorsSkin(["link"], pageDrawing(propsFor)))).toEqual([]);
    });
  }

  // Die Kehrseite: was KEIN Klick-Listener ist, darf auch nicht mitzählen —
  // sonst wäre der geweitete Wächter nur noch nachgiebig.
  const NOT_CLICK: [string, (f: () => void) => Record<string, unknown>][] = [
    ["onClickOutside (ein Komponenten-Emit, kein Klick)", (f) => ({ onClickOutside: f })],
    ["onKeydown", (f) => ({ onKeydown: f })],
    ["onDblclick", (f) => ({ onDblclick: f })],
  ];

  for (const [name, propsFor] of NOT_CLICK) {
    it(`zählt ${name} NICHT`, async () => {
      const findings = await checkHonors(honorsSkin(["link"], pageDrawing(propsFor)));
      expect(findings.map((f) => f.problem)).toEqual(["undelivered"]);
    });
  }

  it("löst eine Options-API-Komponente auf, deren render() über `this` geht", async () => {
    // Vue ruft `render()` mit dem Komponenten-Proxy. Als nackte Funktion gerufen
    // warf `this.host` an der ersten Zeile, die Ausnahme galt als leerer
    // Teilbaum — und ein Skin, der im Browser funktioniert, fiel durch.
    const OptionsComponent = {
      props: { host: { type: Object, required: true } },
      render(this: {
        host: {
          layersFor: (id: string) => { items: { link?: unknown }[] }[];
          currentPageId: string;
          followLink: (l: unknown) => unknown;
        };
      }) {
        const svc = this.host;
        const children: VNode[] = [];
        for (const layer of svc.layersFor(svc.currentPageId)) {
          for (const item of layer.items) {
            if (item.link) children.push(h("button", { onClick: () => void svc.followLink(item.link) }));
          }
        }
        return h("div", null, children);
      },
    };
    const page = (host: never) => h(OptionsComponent as never, { host });
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("…auch, wenn sie über `this.$props` statt über `this.host` geht", async () => {
    const OptionsComponent = {
      props: { host: { type: Object, required: true } },
      render(this: {
        $props: {
          host: {
            layersFor: (id: string) => { items: { link?: unknown }[] }[];
            currentPageId: string;
            followLink: (l: unknown) => unknown;
          };
        };
      }) {
        const svc = this.$props.host;
        const children: VNode[] = [];
        for (const layer of svc.layersFor(svc.currentPageId)) {
          for (const item of layer.items) {
            if (item.link) children.push(h("button", { onClick: () => void svc.followLink(item.link) }));
          }
        }
        return h("div", null, children);
      },
    };
    const page = (host: never) => h(OptionsComponent as never, { host });
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("verwirft, was der Renderer WÄHREND des Zeichnens ruft — leerer Baum bleibt undelivered", async () => {
    // Das Loch, das die Ereignis-/Komponenten-Weitung aufgerissen hatte:
    // `probe.linkCalls` wurde beim Rendern gefüllt und vor dem Handler-Lauf nicht
    // geleert. Ein Renderer, der `followLink` beim RENDERN ruft und einen leeren
    // Baum liefert, bestand die Prüfung — genau der Fall, den `undelivered`
    // fangen soll. (Im Browser wäre er ohnehin kaputt: er navigiert beim blossen
    // Anzeigen der Seite.)
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      for (const layer of svc.layersFor(svc.currentPageId)) {
        for (const item of layer.items) if (item.link) svc.followLink(item.link);
      }
      return h("div", null, []);
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("…auch, wenn der Render-Zeit-Aufruf in einer KOMPONENTE steckt", async () => {
    // Der Schnitt oben hatte eine Lücke: das Auflösen der Komponenten passiert
    // beim SAMMELN der Handler, und das stand hinter `probe.reset()`. Der
    // Render-Zeit-Aufruf einer Komponente floss dadurch wieder ins Protokoll —
    // dasselbe Loch, eine Ebene tiefer. Erst sammeln, dann leeren, dann feuern.
    const Component = {
      props: { host: { type: Object, required: true } },
      render(this: {
        $props: {
          host: {
            layersFor: (id: string) => { items: { link?: unknown }[] }[];
            currentPageId: string;
            followLink: (l: unknown) => unknown;
          };
        };
      }) {
        const svc = this.$props.host;
        for (const layer of svc.layersFor(svc.currentPageId)) {
          for (const item of layer.items) if (item.link) svc.followLink(item.link);
        }
        return h("div", null, []);
      },
    };
    const page = (host: never) => h(Component as never, { host });
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("löst eine setup()-Komponente auf — die häufigste Composition-API-Form", async () => {
    // `defineComponent({ setup() { return () => h(…) } })` hat WEDER einen
    // aufrufbaren `type` NOCH ein `type.render`, solange Vue keine Instanz gebaut
    // hat. Der Teilbaum blieb ungeprüft, und ein funktionierender Link in genau
    // dieser Form galt als `undelivered`.
    const Component = {
      props: { host: { type: Object, required: true } },
      setup(props: {
        host: {
          layersFor: (id: string) => { items: { link?: unknown }[] }[];
          currentPageId: string;
          followLink: (l: unknown) => unknown;
        };
      }) {
        const svc = props.host;
        return () => {
          const children: VNode[] = [];
          for (const layer of svc.layersFor(svc.currentPageId)) {
            for (const item of layer.items) {
              if (item.link)
                children.push(h("button", { onClick: () => void svc.followLink(item.link) }));
            }
          }
          return h("div", null, children);
        };
      },
    };
    const page = (host: never) => h(Component as never, { host });
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("…und auch die Form, in der setup() Bindungen statt einer Render-Funktion liefert", async () => {
    const Component = {
      props: { host: { type: Object, required: true } },
      setup(props: { host: unknown }) {
        return { svc: props.host };
      },
      render(this: {
        svc: {
          layersFor: (id: string) => { items: { link?: unknown }[] }[];
          currentPageId: string;
          followLink: (l: unknown) => unknown;
        };
      }) {
        const svc = this.svc;
        const children: VNode[] = [];
        for (const layer of svc.layersFor(svc.currentPageId)) {
          for (const item of layer.items) {
            if (item.link)
              children.push(h("button", { onClick: () => void svc.followLink(item.link) }));
          }
        }
        return h("div", null, children);
      },
    };
    const page = (host: never) => h(Component as never, { host });
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("zählt ein Komponenten-EREIGNIS nicht als Klick-Handler", async () => {
    // `h({ emits: ['click'], … }, { onClick })` sieht aus wie ein Klick, ist aber
    // ein Komponenten-Ereignis: Vue ruft den Listener NUR, wenn die Komponente
    // selbst `emit('click')` ruft. Ein Nutzerklick erreicht ihn nie — der
    // Probelauf rief ihn trotzdem direkt auf und nahm eine Seite ohne jede
    // funktionierende Sprung-Affordanz ab.
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const link = svc.layersFor(svc.currentPageId)[0]?.items.find((i) => i.link)?.link;
      const Emitter = { emits: ["click"], render: () => h("div", null, []) };
      return h(Emitter as never, { onClick: () => void svc.followLink(link) });
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("…aber ohne `emits: ['click']` fällt der Listener durch und zählt weiter", async () => {
    // Der Nachbarfall: deklariert die Komponente `click` NICHT, reicht Vue den
    // Listener nach seinen Fallthrough-Regeln an das Wurzelelement weiter. Dann
    // ist er sehr wohl ein echter Klick-Handler, und ihn wegzuwerfen hätte einen
    // konformen Skin abgelehnt.
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const link = svc.layersFor(svc.currentPageId)[0]?.items.find((i) => i.link)?.link;
      const Plain = { render: () => h("div", null, []) };
      return h(Plain as never, { onClick: () => void svc.followLink(link) });
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("hält an, wo `stopImmediatePropagation` einen echten Klick anhielte", async () => {
    // `mergeProps` legt mehrere Listener als Array unter EINEM Prop-Namen ab. Vue
    // ruft sie mit DEMSELBEN Ereignis der Reihe nach und bricht ab, sobald einer
    // `stopImmediatePropagation()` ruft. Der Probelauf feuerte jedes Glied einzeln
    // mit frischem Ereignis — ein Array, dessen SPÄTERER Listener `followLink`
    // ruft, bestand damit, obwohl ein echter Klick dort nie ankommt.
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const link = svc.layersFor(svc.currentPageId)[0]?.items.find((i) => i.link)?.link;
      return h("button", {
        onClick: [
          (e: { stopImmediatePropagation: () => void }) => e.stopImmediatePropagation(),
          () => void svc.followLink(link),
        ],
      });
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("…und ohne den Abbruch läuft dasselbe Array durch", async () => {
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const link = svc.layersFor(svc.currentPageId)[0]?.items.find((i) => i.link)?.link;
      return h("button", { onClick: [() => {}, () => void svc.followLink(link)] });
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("hängt nicht an einem Handler, dessen Versprechen nie eintrifft", async () => {
    // Der Probelauf ruft FREMDEN Code. Ohne Deckel hielt ein Handler, der auf
    // einen Dienst wartet, den es hier nicht gibt, den ganzen Lauf an — das Gate
    // lief in den CI-Timeout, statt einen Befund zu melden.
    const page = () => h("button", { onClick: () => new Promise(() => {}) });
    const findings = await checkHonors(honorsSkin(["link"], page as never));
    expect(findings.map((f) => f.problem)).toEqual(["undelivered"]);
  }, 20_000);

  it("…und ein Renderer, der beim Zeichnen fragt UND einen Handler setzt, bleibt sauber", async () => {
    // Der Nachbarfall zum Schnitt oben: das Verwerfen darf den Normalfall nicht
    // mitnehmen. edomi ruft beim Rendern `resolveLink`/`isLinkActive`/`linkLabel`.
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        resolveLink: (l: unknown) => unknown;
        isLinkActive: (l: unknown) => boolean;
        followLink: (l: unknown) => unknown;
      };
      const children: VNode[] = [];
      for (const layer of svc.layersFor(svc.currentPageId)) {
        for (const item of layer.items) {
          if (!item.link) continue;
          svc.resolveLink(item.link);
          svc.isLinkActive(item.link);
          children.push(h("button", { onClick: () => void svc.followLink(item.link) }));
        }
      }
      return h("div", null, children);
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("ein honors-Befund ist ein harter Fehler wie eine gap", async () => {
    const { hasGap, honors } = await generateSupport(honorsSkin(["nope"]));
    expect(honors).toHaveLength(1);
    expect(hasGap).toBe(true);
  });

  it("und er steht IM Artefakt, nicht nur im Exit-Code des Laufs", async () => {
    // F3: bei `unknown`/`unrenderable`/`undelivered` wurde support.json trotzdem
    // mit der BEHAUPTETEN honors-Liste und ohne einen einzigen Befund serialisiert.
    // stderr und Exit-Code sind nach dem Lauf weg — das Artefakt blieb liegen.
    const { report } = await generateSupport(honorsSkin(["link"]));
    expect(report.layout?.honors).toEqual(["link"]);
    expect(report.layout?.honorsFindings).toEqual([
      {
        token: "link",
        problem: "unrenderable",
        detail: "kein Page-Renderer - nur er sieht LayerItem.link",
      },
    ]);
  });

  it("ein sauberer Skin trägt KEIN honorsFindings im Artefakt", async () => {
    const { report } = await generateSupport(honorsSkin(["order"]));
    expect(report.layout).toEqual({ model: "grid", honors: ["order"] });
  });
});
