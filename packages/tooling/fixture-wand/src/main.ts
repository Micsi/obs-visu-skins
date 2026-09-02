// Fixture-Wand — Vite-Dev-Einstieg. Mountet eine scrollbare Galerie, die jede
// Vertrags-Fixture (Typ × Zustand) durch die Kachel-Renderer eines Skins zeigt.
//
// Skin- und Theme-Umschaltung oben in der Leiste (#13): der Autor sieht denselben
// Fixture-Satz durch jeden Skin und in jedem Theme. Rote Zellen (gap/broken) sind
// die To-do-Liste; bewusst abgewählte Typen (`manifest.unsupported`) erscheinen
// neutral markiert, nicht rot — „nicht unterstützt" ist eine Aussage, kein Fehler.
//
// Goldene Regel 1/4: der SKIN besitzt keinen State; die Renderer werden rein
// funktional aufgerufen. Der Umschalter hier ist reiner Werkzeug-Zustand.

import { computed, createApp, defineComponent, h, ref, Fragment } from "vue";
import type { CoreWidgetType, Renderer, SkinManifest, Tokens } from "@obs/visu-contract";
import { version as contractVersion } from "@obs/visu-contract";

import * as ionic from "@obs-visu-skins/ionic";
import ionicManifest from "@obs-visu-skins/ionic/manifest.json" with { type: "json" };
import ionicCss from "@obs-visu-skins/ionic/ionic.css?raw";

import * as terminal from "@obs-visu-skins/terminal";
import terminalManifest from "@obs-visu-skins/terminal/manifest.json" with { type: "json" };
import terminalCss from "@obs-visu-skins/terminal/terminal.css?raw";

import { buildWall, type WallCell } from "./wall.js";
import { ctxStub, ionicTokens, terminalTokens } from "./stubs.js";

/** Was die Wand über einen Skin wissen muss. */
interface SkinEntry {
  readonly manifest: SkinManifest;
  readonly tiles: Partial<Record<CoreWidgetType, Renderer>>;
  readonly tokens: Tokens;
  readonly css: string;
  /** Wurzel-Element des Skins für ein Theme (Klasse + Attribute + CSS-Variablen). */
  root(theme: string): {
    class: string;
    attrs: Record<string, string>;
    style: Record<string, string>;
  };
}

const SKINS: Record<string, SkinEntry> = {
  ionic: {
    manifest: ionicManifest as unknown as SkinManifest,
    tiles: ionic.tiles,
    tokens: ionicTokens,
    css: ionicCss,
    root(theme) {
      // ionic.css scoped seine Theme-Variablen unter .visu-root[data-theme]/[data-stil];
      // applyTweaks liefert genau diese Attribute + Variablen.
      const t = ionic.applyTweaks({ theme } as never);
      return {
        class: "visu-root",
        attrs: t.attrs as unknown as Record<string, string>,
        style: t.style,
      };
    },
  },
  terminal: {
    manifest: terminalManifest as unknown as SkinManifest,
    tiles: terminal.tiles,
    tokens: terminalTokens,
    css: terminalCss,
    // terminal.css scoped alles unter .t-root[data-theme]; keine Tweaks.
    root: (theme) => ({ class: "t-root", attrs: { "data-theme": theme }, style: {} }),
  },
};

// Beide Stylesheets sind unter ihrer eigenen Wurzel gescoped und stören einander
// nicht — einmal injizieren, dann schaltet nur noch die Wurzel um.
for (const skin of Object.values(SKINS)) {
  const style = document.createElement("style");
  style.textContent = skin.css;
  document.head.appendChild(style);
}

const STATUS_LABEL: Record<WallCell["status"], string> = {
  ok: "",
  unsupported: "unsupported (bewusst abgewählt)",
  gap: "gap — kein Renderer",
  broken: "broken — Renderer wirft",
};

const Wall = defineComponent({
  name: "FixtureWall",
  setup() {
    const skinId = ref<string>("terminal");
    const theme = ref<string>("dark");

    const skin = computed(() => SKINS[skinId.value]!);
    const themes = computed(() => skin.value.manifest.themes ?? ["light", "dark"]);
    const cells = computed(() =>
      buildWall(
        {
          tiles: skin.value.tiles,
          unsupported: skin.value.manifest.unsupported,
          widgets: skin.value.manifest.widgets,
        },
        skin.value.tokens,
        ctxStub(),
      ),
    );
    const counts = computed(() => {
      const c = { ok: 0, unsupported: 0, gap: 0, broken: 0 };
      for (const cell of cells.value) c[cell.status] += 1;
      return c;
    });

    function pickSkin(event: Event): void {
      skinId.value = (event.target as HTMLSelectElement).value;
      if (!themes.value.includes(theme.value)) theme.value = themes.value[0]!;
    }

    return () => {
      const root = skin.value.root(theme.value);
      const n = counts.value;

      return h("main", { class: "fw-wall" }, [
        h("header", { class: "fw-head" }, [
          h("h1", `Fixture-Wand · Vertrag ${contractVersion}`),
          h("p", { class: "fw-sub" }, [
            `${cells.value.length} Fixtures (Typ × Zustand) · Skin zielt auf ${skin.value.manifest.targetsContract} · `,
            h(
              "span",
              { class: n.gap + n.broken > 0 ? "fw-bad" : "fw-good" },
              `ok ${n.ok} · unsupported ${n.unsupported} · gap ${n.gap} · broken ${n.broken}`,
            ),
          ]),
          h("div", { class: "fw-controls" }, [
            h("label", null, [
              "Skin ",
              h(
                "select",
                { value: skinId.value, onChange: pickSkin },
                Object.keys(SKINS).map((id) => h("option", { value: id }, id)),
              ),
            ]),
            h("label", null, [
              "Theme ",
              h(
                "select",
                {
                  value: theme.value,
                  onChange: (e: Event) => {
                    theme.value = (e.target as HTMLSelectElement).value;
                  },
                },
                themes.value.map((th) => h("option", { value: th }, th)),
              ),
            ]),
          ]),
        ]),
        // Die Skin-Wurzel trägt die Theme-Variablen; alle Zellen liegen darin.
        h(
          "div",
          {
            class: [
              "fw-grid",
              root.class,
              skin.value.manifest.layout.model === "list" && "is-list",
            ],
            ...root.attrs,
            style: root.style,
          },
          cells.value.map((c) =>
            h(
              "section",
              { class: `fw-cell is-${c.status}`, key: `${skinId.value}.${c.type}.${c.state}` },
              [
                h("div", { class: "fw-cell-head" }, [
                  h("span", { class: "fw-type" }, c.type),
                  h("span", { class: "fw-state" }, c.state),
                ]),
                h("div", { class: "fw-cell-body" }, [
                  c.status === "ok"
                    ? h(Fragment, c.vnode as never)
                    : h(
                        "div",
                        { class: c.status === "unsupported" ? "fw-skip" : "fw-gap" },
                        c.error ? `${STATUS_LABEL[c.status]}: ${c.error}` : STATUS_LABEL[c.status],
                      ),
                ]),
              ],
            ),
          ),
        ),
      ]);
    };
  },
});

createApp(Wall).mount("#app");
