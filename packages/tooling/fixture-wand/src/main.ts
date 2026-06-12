// Fixture-Wand — Vite-Dev-Einstieg. Mountet eine scrollbare Galerie, die jede
// Vertrags-Fixture (Typ × Zustand) durch die Kachel-Renderer eines Skins zeigt.
//
// Skin-umschaltbar: jetzt nur ionic verdrahtet; terminal dockt später hier an,
// indem es als weiterer Eintrag in SKINS landet. Keine Routing-/State-Architektur
// (Goldene Regel 1/4: das Tool besitzt keinen State) — nur eine statische Wand.

import { createApp, defineComponent, h, Fragment } from "vue";
import * as ionic from "@obs-visu-skins/ionic";
import ionicCss from "@obs-visu-skins/ionic/ionic.css?raw";

import { buildWall, type SkinTiles } from "./wall.js";
import { tokensStub, ctxStub } from "./stubs.js";

/** Skin-Registry der Wand. Weitere Skins (terminal …) hier ergänzen. */
const SKINS: Record<string, SkinTiles> = {
  ionic: { tiles: ionic.tiles },
};

const activeSkin = "ionic";

// Skin-CSS injizieren, damit die Kacheln wie in der App aussehen.
const style = document.createElement("style");
style.textContent = ionicCss;
document.head.appendChild(style);

// Ionic-Wurzel: ionic.css scoped seine Theme-Variablen + Look-Schalter unter
// .visu-root[data-theme]/[data-stil]. Ohne diese Wurzel bleiben --vz-fg/--vz-tile-bg
// etc. ungesetzt und die Wand zeigt nicht den Skin wie in der App. applyTweaks
// liefert genau diese Attribute + CSS-Variablen.
const root = ionic.applyTweaks();

const Wall = defineComponent({
  name: "FixtureWall",
  setup() {
    const cells = buildWall(SKINS[activeSkin]!, tokensStub, ctxStub());

    return () =>
      h("div", { class: "visu-root", ...root.attrs, style: root.style }, [
        h("main", { class: "fw-wall" }, [
          h("header", { class: "fw-head" }, [
            h("h1", `Fixture-Wand · Skin: ${activeSkin}`),
            h("p", { class: "fw-sub" }, `${cells.length} Fixtures (Typ × Zustand)`),
          ]),
          h(
            "div",
            { class: "fw-grid" },
            cells.map((c) =>
              h("section", { class: "fw-cell", key: `${c.type}.${c.state}` }, [
                h("div", { class: "fw-cell-head" }, [
                  h("span", { class: "fw-type" }, c.type),
                  h("span", { class: "fw-state" }, c.state),
                ]),
                h("div", { class: "fw-cell-body" }, [
                  c.hasRenderer
                    ? h(Fragment, c.vnode as never)
                    : h("div", { class: "fw-gap" }, "(kein Renderer)"),
                ]),
              ]),
            ),
          ),
        ]),
      ]);
  },
});

createApp(Wall).mount("#app");
