// TDD-Spec für den Konformitäts-Generator (ARCHITECTURE.md §2).
//
// Positiv: der vollständige ionic-Skin (alle neun Kern-Typen inkl. climate supported,
// unsupported=[]) → kein gap. Die Stufe je Typ folgt der Aktions-Abdeckung gegen den
// Vertrag (§6): alle kanonischen Aktionen = "full", ein Teil = "partial", der Vertrag
// kennt keine Aktion (sensor) = "display".
// Negativ: ein konstruierter Skin-Stub mit deklariertem widget aber fehlendem Renderer
// → "gap"; ein werfender Renderer → "broken". Beides Exit != 0.

import { describe, expect, it } from "vitest";
// `vh` ist derselbe `h` — die Link-Specs binden `h` lokal an den Host-Stub und
// brauchen daneben noch Vues Hyperscript.
import {
  Teleport,
  defineComponent,
  h,
  h as vh,
  mergeProps,
  onMounted,
  ref,
  type VNode,
} from "vue";
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

/**
 * Eine winzige, BESTANDENE Palette. Seit Vertrag 1.13 ist `a11y` Pflicht: ein Skin
 * ohne Deklaration meldet `undeclared` und setzt `hasGap`. Diese Specs prüfen aber
 * die WIDGET-Achse — sie brauchen eine Palette, die trägt, damit `hasGap` weiter
 * genau das bedeutet, was hier gemeint ist. Die Farben sind terminals gemessene
 * Werte (Text 14.9:1), also sicher über der Schwelle.
 */
const AA_STYLES = {
  "./stub.css": '.stub[data-theme="dark"]{--x-bg:#0b0e14;--x-fg:#e6edf3;}',
} as const;
const AA_DECL = {
  stylesheet: "./stub.css",
  themes: { dark: '.stub[data-theme="dark"]' },
  grounds: [{ token: "--x-bg" }],
  tokens: {
    "--x-bg": { role: "ground" as const },
    "--x-fg": { role: "text" as const },
  },
};

describe("generateSupport — ionic (vollständig)", () => {
  it("meldet keine gap/broken und deckt alle neun Kern-Typen ab", async () => {
    const { report } = await generateSupport({ manifest: ionic, tiles });

    // Bewusst NICHT `hasGap`: das Flag deckt seit Vertrag 1.13 auch die Farb-Achse
    // ab, und ionics Palette ist dort gemessen rot (theme-unabhängige Akzente auf
    // hellem Grund). Diese Spec prüft die WIDGET-Achse — die ist sauber, und die
    // Farb-Achse hat ihre eigenen Specs. Ein `hasGap`-false hier würde die
    // Farbmessung stillstellen, statt sie zu prüfen.
    expect(report.summary.gap).toBe(0);
    expect(report.summary.broken).toBe(0);
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
      a11y: AA_DECL,
    };
    const partialTiles: RendererMap = {
      light: marking("toggle"),
      switch: marking("toggle"),
      blind: marking("setPosition"),
      jalousie: marking("setPosition"),
    };

    const { report, hasGap } = await generateSupport({
      manifest,
      tiles: partialTiles,
      styles: AA_STYLES,
    });

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
      a11y: AA_DECL,
    };

    const { report, hasGap } = await generateSupport({
      manifest,
      tiles: { light: silent, switch: silent },
      styles: AA_STYLES,
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
      a11y: AA_DECL,
    };

    const { report, hasGap } = await generateSupport({
      manifest,
      tiles: { blind: hostMarks },
      styles: AA_STYLES,
    });

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
const svcOf = (host: never) =>
  host as unknown as {
    layersFor: (id: string) => { items: { link?: unknown }[] }[];
    currentPageId: string;
    followLink: (l: unknown) => unknown;
  };
  // ALLE Links des gestellten Layers. Der Probelauf stellt drei Formen — markiert,
  // gewoehnlich, PIN-geschuetzt — und verlangt fuer jede eine Affordanz, so wie der
  // Host bei jeder zurueckgetreten ist. Ein Renderer, der nur eine bedient, faellt
  // durch; die Specs bilden deshalb ab, was ein echter Renderer tut.
const allLinks = (svc: ReturnType<typeof svcOf>): unknown[] =>
  (svc.layersFor(svc.currentPageId)[0]?.items ?? [])
    .filter((i: { link?: unknown }) => i.link)
    .map((i: { link?: unknown }) => i.link);
  /**
   * Ein Handler, der JEDE gestellte Link-Form bedient.
   *
   * Die Specs in diesem Block pruefen VUE-VERHALTEN (Emits, Fallthrough,
   * Ereignis-Ziel, Teleport, spaeter Mount) — nicht, ob ein Renderer alle Formen
   * abdeckt. Dafuer gibt es einen eigenen Block. Damit sie am verschaerften
   * Probelauf nicht aus dem falschen Grund scheitern, folgt ihre eine Flaeche
   * allen Zielen.
   */
const followAll = (svc: ReturnType<typeof svcOf>) => () => {
  for (const l of allLinks(svc)) void svc.followLink(l);
  };

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
      const children: VNode[] = [];
      for (const layer of h.layersFor(h.currentPageId)) {
        for (const item of layer.items) {
          if (item.link) children.push(vh("button", { onClick: () => h.followLink(item.link) }));
        }
      }
      return vh("div", {}, children);
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
      const children: VNode[] = [];
      for (const layer of h.layersFor(h.currentPageId)) {
        for (const item of layer.items) {
          if (!item.link) continue;
          children.push(
            vh("button", {
              onClick: (event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                if ((event.currentTarget as HTMLElement).tagName === "NOPE") return;
                h.followLink(item.link);
              },
            }),
          );
        }
      }
      return vh("div", {}, children);
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
      const children: VNode[] = [];
      for (const layer of h.layersFor(h.currentPageId)) {
        for (const item of layer.items) {
          if (!item.link) continue;
          children.push(
            vh("button", {
              onClick: async () => {
                await Promise.resolve();
                h.followLink(item.link);
              },
            }),
          );
        }
      }
      return vh("div", {}, children);
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
      const children: VNode[] = [];
      for (const layer of h.layersFor(h.currentPageId)) {
        for (const item of layer.items) {
          if (item.link) children.push(vh("button", { onClick: () => h.followLink(item.link) }));
        }
      }
      return vh("div", {}, children);
    };
    const page = (host: never) => vh(Inner as never, { host });
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("und der Wächter fällt weiterhin: ein leerer Komponenten-Baum ist undelivered", async () => {
    // Die Kehrprobe zur Komponenten-Auflösung. Ohne sie belegte die Spec oben nur,
    // dass etwas grün wird — nicht, dass die Auflösung noch etwas ablehnen kann.
    const Empty = () => vh("div", {}, []);
    const page = (host: never) => vh(Empty as never, { host });
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
      const Emitter = { emits: ["click"], render: () => h("div", null, []) };
      return h(Emitter as never, { onClick: followAll(svc) });
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
      const Plain = { render: () => h("div", null, []) };
      return h(Plain as never, { onClick: followAll(svc) });
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
      return h("button", {
        onClick: [
          (e: { stopImmediatePropagation: () => void }) => e.stopImmediatePropagation(),
          followAll(svc),
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
      return h("button", { onClick: [() => {}, followAll(svc)] });
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

/**
 * Die sieben Faelle, an denen die NACHBILDUNG von Vues Verhalten zuletzt scheiterte.
 *
 * Sie stehen hier nicht, weil je einer von ihnen einzeln behoben worden waere —
 * sondern weil der Probelauf die Seite jetzt WIRKLICH mountet und WIRKLICH klickt.
 * Vue bringt seine Semantik selbst mit; diese Specs halten fest, dass sie damit
 * stimmt, und wuerden rot, wenn jemand wieder anfinge, sie nachzubauen.
 */
describe("honors-Probelauf — Vue liefert die Semantik, nicht unsere Nachbildung", () => {

  it("routet ein Komponenten-Ereignis an den Listener des Eltern-VNode", async () => {
    // `emits: ["click"]` + `emit("click")` im Kind: Vue ruft damit den `onClick`
    // des Komponenten-VNode. Die Nachbildung ersetzte `emit` durch ein No-op und
    // schloss den aeusseren Listener zugleich aus — ein voellig normaler
    // komponenten-vermittelter Sprung galt als `undelivered`.
    const page = (host: never) => {
      const svc = svcOf(host);
      const Button = {
        emits: ["click"],
        setup(_p: unknown, { emit }: { emit: (e: string) => void }) {
          return () => vh("button", { onClick: () => emit("click") });
        },
      };
      return vh(Button as never, { onClick: followAll(svc) });
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("zaehlt einen Listener NICHT, den `inheritAttrs: false` nirgends anhaengt", async () => {
    // Ohne Fallthrough landet der `onClick` an keinem Element. Die Nachbildung rief
    // ihn trotzdem direkt auf und nahm eine Seite ab, die im Browser nichts tut.
    const page = (host: never) => {
      const svc = svcOf(host);
      const Isolated = { inheritAttrs: false, render: () => vh("div", {}, []) };
      return vh(Isolated as never, { onClick: followAll(svc) });
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("teilt EIN Ereignis ueber mehrere Klick-Props desselben Elements", async () => {
    // `onClick` und `onClickOnce` sind fuer Vue derselbe native `click`. Haelt der
    // erste mit `stopImmediatePropagation()` an, kommt der zweite nicht mehr dran.
    // Getrennte Dispatches mit je frischem Ereignis liessen ihn durch.
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh("button", {
        onClick: (e: MouseEvent) => e.stopImmediatePropagation(),
        onClickOnce: followAll(svc),
      });
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("bleibt unter der Zeitgrenze, auch bei vielen nie eintreffenden Handlern", async () => {
    // Ein Deckel JE HANDLER skalierte nicht: hundert haengende Handler summierten
    // sich auf Minuten und liefen genau in den CI-Timeout, den er verhindern soll.
    // Das Budget gilt fuer die ganze Phase.
    const page = () =>
      vh(
        "div",
        {},
        Array.from({ length: 100 }, () => vh("button", { onClick: () => new Promise(() => {}) })),
      );
    const started = Date.now();
    const findings = await checkHonors(honorsSkin(["link"], page as never));
    expect(findings.map((f) => f.problem)).toEqual(["undelivered"]);
    expect(Date.now() - started, "die ganze Phase, nicht je Handler").toBeLessThan(10_000);
  }, 30_000);

  it("gibt dem Handler ein Ereignis mit dem ECHTEN geklickten Element", async () => {
    // Ein Handler darf `event.currentTarget.dataset` lesen, bevor er springt. Der
    // Stellvertreter war immer ein generischer Button mit leerem `dataset` — ein
    // konformer Skin fiel durch, weil seine Bedingung nie zutraf.
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh("button", {
        "data-link": "keller",
        onClick: (e: MouseEvent) => {
          const el = e.currentTarget as HTMLElement;
          if (el.dataset.link !== "keller") return;
          if (el.getAttribute("data-link") !== "keller") return;
          followAll(svc)();
        },
      });
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("klickt keine Slot-Kinder, die der Renderer gar nicht einsetzt", async () => {
    // Eine Komponente, die ihren Default-Slot NICHT rendert: Vue mountet diese
    // Kinder nie. Die Nachbildung lief `vnode.children` trotzdem ab und liess
    // einen verworfenen Button den Skin durchbringen.
    const page = (host: never) => {
      const svc = svcOf(host);
      const Discards = { render: () => vh("div", {}, ["nichts vom Slot"]) };
      return vh(Discards as never, {}, {
        default: () => [vh("button", { onClick: followAll(svc) })],
      } as never);
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("kennt Vues rohe `on:click`-Schreibweise und faellt nicht auf `on-click` herein", async () => {
    // Vue registriert `on:click` als `click`; `on-click` dagegen als Ereignis
    // `-click`, das ein Klick nie ausloest. Der alte Namensvergleich hatte beides
    // genau falsch herum.
    const withColon = (host: never) => {
      const svc = svcOf(host);
      return vh("button", { "on:click": followAll(svc) });
    };
    expect(await checkHonors(honorsSkin(["link"], withColon))).toEqual([]);

    const withHyphen = (host: never) => {
      const svc = svcOf(host);
      return vh("button", { "on-click": followAll(svc) });
    };
    expect((await checkHonors(honorsSkin(["link"], withHyphen))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });
});

describe("honors-Achse — die Gegenrichtung: geliefert, aber nicht deklariert", () => {
  it("meldet einen gezeichneten Sprung, den das Manifest nicht deklariert", async () => {
    // Der Host tritt mit seiner EIGENEN Sprung-Affordanz nur zurueck, wenn das
    // Token deklariert ist. Zeichnet der Skin den Sprung trotzdem, liegen zwei
    // Klickflaechen und zwei Fokusstopps uebereinander — und weil ohne
    // Deklaration bisher gar nicht gemessen wurde, blieb der Lauf sauber,
    // GERADE WEIL der Fehler da war.
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const children: VNode[] = [];
      for (const layer of svc.layersFor(svc.currentPageId)) {
        for (const item of layer.items) {
          if (item.link) children.push(vh("button", { onClick: () => void svc.followLink(item.link) }));
        }
      }
      return vh("div", {}, children);
    };
    const findings = await checkHonors(honorsSkin(["order"], page));
    expect(findings.map((f) => f.problem)).toEqual(["undeclared"]);
    expect(findings[0]?.token).toBe("link");
  });

  it("…und schweigt, wenn der Renderer keinen Sprung zeichnet", async () => {
    // Die Gegenprobe: ein Page-Renderer OHNE Sprung darf ohne Deklaration nicht
    // gemeldet werden — sonst waere jeder Skin mit Seiten-Renderer ein Befund.
    const page = () => vh("div", {}, [vh("button", {})]);
    expect(await checkHonors(honorsSkin(["order"], page as never))).toEqual([]);
  });

  it("…und meldet den Sprung NICHT doppelt, wenn er deklariert ist", async () => {
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        followLink: (l: unknown) => unknown;
      };
      const children: VNode[] = [];
      for (const layer of svc.layersFor(svc.currentPageId)) {
        for (const item of layer.items) {
          if (item.link) children.push(vh("button", { onClick: () => void svc.followLink(item.link) }));
        }
      }
      return vh("div", {}, children);
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });
});

describe("honors-Probelauf — geklickt wird, was ein Nutzer anfassen kann", () => {

  it("nimmt eine Affordanz auf einem `disabled` Steuerelement NICHT ab", async () => {
    // `dispatchEvent` umgeht die Unterdrueckung des Browsers und ruft den Handler
    // auch auf einem deaktivierten Steuerelement. Der Probelauf haette damit eine
    // Affordanz abgenommen, die niemand aktivieren kann — das Gegenteil dessen,
    // was die Deklaration verspricht.
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh("button", { disabled: true, onClick: followAll(svc) });
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("…und auch keine in einem `inert`-Teilbaum", async () => {
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh("div", { inert: true }, [
        vh("button", { onClick: followAll(svc) }),
      ]);
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("…aber dieselbe Flaeche ohne `disabled` zaehlt", async () => {
    // Der Nachbarfall: das Aussortieren darf den Normalfall nicht mitnehmen.
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh("button", { onClick: followAll(svc) });
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("verlangt, dass `followLink` das Ziel DES ITEMS bekommt", async () => {
    // Der Name allein genuegt nicht: ein Renderer, der das gestellte `LayerItem`
    // ignoriert und eine eigene Flaeche mit festverdrahtetem Ziel zeichnet, ruft
    // `followLink` ebenfalls — der Host zoege daraufhin seine Affordanz zurueck,
    // waehrend das Ziel des Items nirgends erreichbar ist.
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh("button", {
        onClick: () => void svc.followLink({ targetNodeId: "ganz-woanders" }),
      });
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("findet eine Affordanz, die per `Teleport` ausserhalb des Containers landet", async () => {
    // Eine Overlay-Flaeche nach `document.body` zu teleportieren ist ein voellig
    // gueltiger Renderer. Wer nur den Container absucht, meldet ihn als
    // `undelivered`.
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh(Teleport, { to: "body" }, [
        vh("button", { onClick: followAll(svc) }),
      ]);
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });

  it("findet eine Affordanz, die erst NACH dem Mount erscheint", async () => {
    // `defineAsyncComponent`, `Suspense` oder eine Komponente, die sich nach dem
    // Mount aktualisiert: ein einmaliger Schnappschuss der Elemente sieht die
    // Affordanz nie.
    const page = (host: never) => {
      const svc = svcOf(host);
      const Late = defineComponent({
        setup() {
          const ready = ref(false);
          setTimeout(() => {
            ready.value = true;
          }, 30);
          return () =>
            ready.value
              ? vh("button", { onClick: followAll(svc) })
              : vh("span", {}, "lädt");
        },
      });
      return vh(Late as never, {});
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  }, 20_000);
});

describe("honors-Probelauf — jede gestellte Link-FORM braucht eine Affordanz", () => {
  it("lehnt einen Renderer ab, der nur markierte Links bedient", async () => {
    // `activeIndicator` ist optional, dokumentierter Default `none`. Ein Renderer,
    // der seine Klickflaeche nur fuer markierte Links baut, liess jeden
    // GEWOEHNLICHEN Link ohne Affordanz — nachdem der Host wegen der Deklaration
    // zurueckgetreten war.
    const page = (host: never) => {
      const svc = svcOf(host);
      const items = (svc.layersFor(svc.currentPageId)[0]?.items ?? []) as {
        link?: { targetNodeId: string; activeIndicator?: string };
      }[];
      return vh(
        "div",
        {},
        items
          .filter((i) => i.link?.activeIndicator)
          .map((i) => vh("button", { onClick: () => void svc.followLink(i.link) })),
      );
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("lehnt einen Renderer ab, der nur frei erreichbare Ziele bedient", async () => {
    // Ein PIN-geschuetztes Ziel loest als `gate` auf. Genau dort ist die Affordanz
    // noetig — sie fuehrt auf den PIN-Pfad. Wer nur bei `navigate` zeichnet, laesst
    // sie weg, waehrend der Host zurueckgetreten ist.
    const page = (host: never) => {
      const svc = host as unknown as {
        layersFor: (id: string) => { items: { link?: unknown }[] }[];
        currentPageId: string;
        resolveLink: (l: unknown) => { kind: string };
        followLink: (l: unknown) => unknown;
      };
      const links = (svc.layersFor(svc.currentPageId)[0]?.items ?? [])
        .filter((i) => i.link)
        .map((i) => i.link);
      return vh(
        "div",
        {},
        links
          .filter((l) => svc.resolveLink(l).kind === "navigate")
          .map((l) => vh("button", { onClick: () => void svc.followLink(l) })),
      );
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("verwirft einen Sprung aus aufgeschobener Mount-Arbeit", async () => {
    // `app.mount()` kehrt zurueck, BEVOR ein `onMounted(async () => { await …;
    // followLink() })` fortsetzt. Lag der Phasenschnitt davor, landete genau
    // dieser Aufruf im Protokoll und galt spaeter als Klick-Beleg — der Renderer
    // bestand also mit exakt dem Verhalten, das der Schnitt ausschliessen soll:
    // navigieren beim blossen Anzeigen.
    const page = (host: never) => {
      const svc = svcOf(host);
      const Nav = defineComponent({
        setup() {
          onMounted(async () => {
            await Promise.resolve();
            followAll(svc)();
          });
          return () => vh("div", {}, "nichts zum Klicken");
        },
      });
      return vh(Nav as never, {});
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("verbraucht einen delegierten `once`-Listener nicht mit einem Rahmen-Klick", async () => {
    // `querySelectorAll` liefert Vorfahren VOR ihren Nachfahren. Ein gueltiger
    // delegierter `onClickOnce` am Rahmen, der nur folgt, wenn
    // `event.target.closest(...)` trifft, wurde dadurch vom Klick auf den Rahmen
    // selbst aufgezehrt — der spaetere Klick auf den Knopf erreichte ihn nicht
    // mehr, obwohl ein Nutzer genau dort zuerst klickt.
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh(
        "div",
        {
          onClickOnce: (e: MouseEvent) => {
            const el = e.target as HTMLElement;
            if (!el.closest("[data-link]")) return;
            followAll(svc)();
          },
        },
        [vh("button", { "data-link": "ja" }, "spring")],
      );
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
  });
});

describe("honors-Probelauf — jeder Lauf misst nur sich selbst", () => {
  it("klickt keine Steuerelemente, die vor dem Mount schon im Dokument standen", async () => {
    // Das Gate faehrt drei Skins nacheinander im SELBEN Dokument. Was ein
    // frueherer Lauf am Body hinterliess, sammelte der naechste mit ein — Skin B
    // haette die Reste von Skin A geklickt und deren `followLink` als eigene
    // Affordanz gezaehlt. Hier steht der Fremdkoerper stellvertretend dafuer.
    const foreign = document.createElement("button");
    let clickedForeign = false;
    foreign.addEventListener("click", () => {
      clickedForeign = true;
    });
    document.body.appendChild(foreign);
    try {
      const page = () => vh("div", {}, "nichts zum Klicken");
      const findings = await checkHonors(honorsSkin(["link"], page as never));
      expect(findings.map((f) => f.problem)).toEqual(["undelivered"]);
      expect(clickedForeign, "ein fremdes Steuerelement wurde geklickt").toBe(false);
    } finally {
      foreign.remove();
    }
  });

  it("laesst das Dokument so zurueck, wie es war — auch nach `Teleport`", async () => {
    // `unmount()` entfernt nicht zwangslaeufig, was ein Teleport ausserhalb des
    // Containers angelegt hat. Ohne Aufraeumen waechst das Dokument ueber die
    // Skins hinweg, und der naechste Lauf faende fremde Steuerelemente vor.
    const beforeCount = document.body.children.length;
    const page = (host: never) => {
      const svc = svcOf(host);
      return vh(
        Teleport,
        { to: "body" },
        allLinks(svc).map((link) => vh("button", { onClick: () => void svc.followLink(link) })),
      );
    };
    expect(await checkHonors(honorsSkin(["link"], page))).toEqual([]);
    expect(document.body.children.length, "der Lauf hat etwas zurueckgelassen").toBe(beforeCount);
  });

  it("raeumt auch auf, wenn der Renderer mitten im Mounten wirft", async () => {
    const beforeCount = document.body.children.length;
    const Boom = defineComponent({
      setup() {
        return () => {
          throw new Error("mitten im Rendern");
        };
      },
    });
    const page = () => vh(Boom as never, {});
    // `broken`, nicht `undelivered`: ein Wurf ist ein anderer Mangel als „zeichnet
    // nichts" — siehe den Block weiter unten.
    expect((await checkHonors(honorsSkin(["link"], page as never))).map((f) => f.problem)).toEqual([
      "broken",
    ]);
    expect(document.body.children.length, "die halb gemountete Anwendung blieb stehen").toBe(
      beforeCount,
    );
  });
});

describe("honors-Achse — die beiden Richtungen messen verschieden streng", () => {
  it("meldet `undeclared` auch, wenn nur EINE Link-Form gezeichnet wird", async () => {
    // Die verschaerfte Messung ("jede Form braucht eine Affordanz") gehoert zur
    // DEKLARIERTEN Richtung. In der Gegenrichtung ist schon EIN gezeichneter
    // Sprung der Befund: er ueberlagert die Affordanz, die der Host mangels
    // Deklaration weiterhin selbst zeichnet. Mit demselben strengen Praedikat
    // blieb genau dieser Fall stumm.
    const page = (host: never) => {
      const svc = svcOf(host);
      const one = allLinks(svc)[0];
      return vh("button", { onClick: () => void svc.followLink(one) });
    };
    const findings = await checkHonors(honorsSkin(["order"], page));
    expect(findings.map((f) => f.problem)).toEqual(["undeclared"]);
  });

  it("…waehrend die deklarierte Richtung weiterhin ALLE Formen verlangt", async () => {
    const page = (host: never) => {
      const svc = svcOf(host);
      const one = allLinks(svc)[0];
      return vh("button", { onClick: () => void svc.followLink(one) });
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  });

  it("verwirft einen Sprung aus SPAETER Mount-Arbeit, nicht nur aus sofortiger", async () => {
    // Drei Null-Timer reichten nur fuer Mikrotasks. Ein `onMounted`, das 50 ms
    // wartet, kam danach — der Aufruf landete waehrend der Klick-Phase im
    // Protokoll und galt als Beleg, obwohl die Seite nichts Klickbares zeichnet.
    const page = (host: never) => {
      const svc = svcOf(host);
      const Nav = defineComponent({
        setup() {
          onMounted(async () => {
            await new Promise((r) => setTimeout(r, 50));
            followAll(svc)();
          });
          return () => vh("div", {}, "nichts zum Klicken");
        },
      });
      return vh(Nav as never, {});
    };
    expect((await checkHonors(honorsSkin(["link"], page))).map((f) => f.problem)).toEqual([
      "undelivered",
    ]);
  }, 30_000);
});

describe("Aktions-Achse — die Komponente sieht ihre Props so, wie Vue sie liefert", () => {
  const actionSkin = (tiles: RendererMap) => ({
    manifest: {
      name: "props-stub",
      targetsContract: contractVersion,
      unsupported: [],
      widgets: { switch: { actions: ["toggle"] } },
      layout: { model: "grid", honors: [] },
    } as unknown as SkinManifest,
    tiles,
  });

  it("wendet den deklarierten `default` an, bevor sie den Baum abläuft", async () => {
    // Vue setzt beim Instanziieren die Defaults der Prop-Deklaration. Der rohe
    // Prop-Beutel des VNode kennt sie nicht: eine Aktions-Komponente, deren
    // weggelassenes `enabled` per Deklaration `true` wäre, bekam `undefined`,
    // zeichnete ihr `data-action` nicht — und eine tatsächlich angebotene Aktion
    // rutschte von `full` auf `display`.
    const Action = {
      props: { enabled: { type: Boolean, default: true } },
      setup(props: { enabled: boolean }) {
        return () => (props.enabled ? vh("button", { "data-action": "toggle" }) : vh("span"));
      },
    };
    const tile: Renderer = () => vh(Action as never, {}) as never;
    const { report } = await generateSupport(actionSkin({ switch: tile }));
    expect(report.widgets.switch?.actions).toBe("1/1");
    expect(report.widgets.switch?.level).toBe("full");
  });

  it("macht aus einem deklarierten Boolean ohne Wert `false`, nicht `undefined`", async () => {
    // Der Nachbarfall: die Normalisierung darf nicht alles wahr machen. Ohne Wert
    // ist ein deklariertes Boolean `false` — die Aktion wird dann zu Recht NICHT
    // gezeichnet.
    const Action = {
      props: { enabled: { type: Boolean } },
      setup(props: { enabled: boolean }) {
        return () => (props.enabled ? vh("button", { "data-action": "toggle" }) : vh("span"));
      },
    };
    const tile: Renderer = () => vh(Action as never, {}) as never;
    const { report } = await generateSupport(actionSkin({ switch: tile }));
    expect(report.widgets.switch?.actions).toBe("0/1");
  });

  it("liest `<C enabled>` — den leeren String — als `true`", async () => {
    const Action = {
      props: { enabled: { type: Boolean } },
      setup(props: { enabled: boolean }) {
        return () => (props.enabled ? vh("button", { "data-action": "toggle" }) : vh("span"));
      },
    };
    const tile: Renderer = () => vh(Action as never, { enabled: "" }) as never;
    const { report } = await generateSupport(actionSkin({ switch: tile }));
    expect(report.widgets.switch?.actions).toBe("1/1");
  });

  it("aber NICHT, wenn `String` in der Union vor `Boolean` steht", async () => {
    // Vues `shouldCastTrue` haengt an der REIHENFOLGE: bei `[String, Boolean]` bleibt
    // der leere String ein leerer String. Ohne diese Regel meldete die Achse eine
    // Aktion, die die montierte Anwendung nicht zeichnet — die Komponente hier gibt
    // `data-action` nur bei striktem `true` aus.
    const Action = {
      props: { enabled: { type: [String, Boolean] } },
      setup(props: { enabled: string | boolean }) {
        return () =>
          props.enabled === true ? vh("button", { "data-action": "toggle" }) : vh("span");
      },
    };
    const tile: Renderer = () => vh(Action as never, { enabled: "" }) as never;
    const { report } = await generateSupport(actionSkin({ switch: tile }));
    expect(report.widgets.switch?.actions).toBe("0/1");
  });

  it("und doch, wenn `Boolean` vorne steht", async () => {
    // Die Gegenprobe zur Reihenfolge — sonst waere die Regel bloss ein pauschales
    // "Union mit String castet nie".
    const Action = {
      props: { enabled: { type: [Boolean, String] } },
      setup(props: { enabled: string | boolean }) {
        return () =>
          props.enabled === true ? vh("button", { "data-action": "toggle" }) : vh("span");
      },
    };
    const tile: Renderer = () => vh(Action as never, { enabled: "" }) as never;
    const { report } = await generateSupport(actionSkin({ switch: tile }));
    expect(report.widgets.switch?.actions).toBe("1/1");
  });

  it("eine `default`-Fabrik bekommt die rohen Props", async () => {
    // Vue reicht der Fabrik die rohen Props (`default(rawProps) { … }`). Ohne
    // Argument warf sie, und `renderAll` hielt das Widget fuer `broken` — oder sie
    // rechnete einen anderen Default und die Achse erfand ein `data-action`, das die
    // montierte Anwendung nicht zeichnet.
    const Action = {
      props: {
        kind: { type: String },
        enabled: {
          type: Boolean,
          default(rawProps: { kind?: string }) {
            return rawProps.kind === "switch";
          },
        },
      },
      setup(props: { enabled: boolean }) {
        return () => (props.enabled ? vh("button", { "data-action": "toggle" }) : vh("span"));
      },
    };
    const tile: Renderer = () => vh(Action as never, { kind: "switch" }) as never;
    const { report } = await generateSupport(actionSkin({ switch: tile }));
    expect(report.widgets.switch?.actions).toBe("1/1");
  });
});

describe("honors-Achse — nicht messen ist kein Bestehen, und ein Wurf ist ein Befund", () => {
  it("meldet einen werfenden Page-Renderer AUCH ohne `link`-Deklaration", async () => {
    // Die Render-Achse fährt `tiles`/`details`/`presets`, aber nie `skin.page`.
    // Ein Skin mit kaputtem Ganzseiten-Renderer bekam deshalb einen sauberen
    // Report, solange er `link` nicht deklarierte — der Fehler fiel nirgends auf.
    const Boom = defineComponent({
      setup() {
        return () => {
          throw new Error("kaputt");
        };
      },
    });
    const page = () => vh(Boom as never, {});
    const findings = await checkHonors(honorsSkin(["order"], page as never));
    expect(findings.map((f) => f.problem)).toEqual(["broken"]);
  });

  it("…und mit Deklaration ebenfalls als `broken`, nicht als `undelivered`", async () => {
    // Der Unterschied trägt Information: „zeichnet nichts" ist ein anderer Mangel
    // als „wirft beim Zeichnen".
    const Boom = defineComponent({
      setup() {
        return () => {
          throw new Error("kaputt");
        };
      },
    });
    const page = () => vh(Boom as never, {});
    const findings = await checkHonors(honorsSkin(["link"], page as never));
    expect(findings.map((f) => f.problem)).toEqual(["broken"]);
  });

  it("ein Renderer, der schlicht nichts Klickbares zeichnet, bleibt `undelivered`", async () => {
    // Die Gegenprobe: `broken` darf den gewöhnlichen Fall nicht schlucken.
    const page = () => vh("div", {}, "nichts zum Klicken");
    const findings = await checkHonors(honorsSkin(["link"], page as never));
    expect(findings.map((f) => f.problem)).toEqual(["undelivered"]);
  });
});

describe("Riegel 10 — Farbe aus dem Renderer, nicht aus dem Blatt", () => {
  const SHEET_PATH = "./probe.css";
  const PASSING = '.p{--bg:#ffffff;--fg:#000000}';
  const A11Y = {
    stylesheet: SHEET_PATH,
    themes: { dark: ".p" },
    grounds: [{ token: "--bg" }],
    tokens: { "--bg": { role: "ground" }, "--fg": { role: "text" } },
  };

  function skinWith(tile: Renderer) {
    return {
      manifest: {
        name: "probe",
        targetsContract: contractVersion,
        unsupported: CORE_WIDGET_TYPES.filter((t) => t !== "switch"),
        widgets: { switch: {} },
        layout: { model: "grid", honors: [] },
        a11y: A11Y,
      } as unknown as SkinManifest,
      tiles: { switch: tile },
      styles: { [SHEET_PATH]: PASSING },
    };
  }

  it("ein Farbliteral im `style`-Prop ist ein Befund", async () => {
    // Die Farb-Achse sieht sonst nur Stylesheets: ein Renderer konnte eine
    // unbeteiligte, bestandene Palette deklarieren und trotzdem `#777` ueber eine
    // helle Flaeche legen.
    const tile: Renderer = () => vh("div", { style: { color: "#777777" } }) as never;
    const { report } = await generateSupport(skinWith(tile));
    expect(report.a11y?.findings.map((f) => f.detail).join(" ")).toContain("Renderer-Inline-Stil");
    expect(report.a11y?.status).toBe("fail");
  });

  it("dieselbe Farbe in rohem Markup ebenso", async () => {
    const tile: Renderer = () => vh("div", { innerHTML: '<b style="color:#777">x</b>' }) as never;
    const { report } = await generateSupport(skinWith(tile));
    expect(report.a11y?.findings.map((f) => f.detail).join(" ")).toContain("Renderer-Inline-Stil");
  });

  it("ein `var()` auf einen deklarierten Token ist in Ordnung", async () => {
    // Die Gegenprobe: der Riegel darf nicht jeden Inline-Stil verbieten — genau so
    // soll ein Renderer die Palette benutzen.
    const tile: Renderer = () => vh("div", { style: { color: "var(--fg)" } }) as never;
    const { report } = await generateSupport(skinWith(tile));
    expect(report.a11y?.findings).toEqual([]);
    expect(report.a11y?.status).toBe("pass");
  });

  it("ein Inline-Stil ohne Farbe ist keiner", async () => {
    const tile: Renderer = () => vh("div", { style: { fontWeight: 600, gap: "4px" } }) as never;
    const { report } = await generateSupport(skinWith(tile));
    expect(report.a11y?.findings).toEqual([]);
  });
});
