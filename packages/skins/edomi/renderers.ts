// @obs-visu-skins/edomi — the skin's export surface (CONTRACT-v1.md §7).
//
// The Edomi POC owns the whole page via a `page` renderer (nav + pixel-precise
// layer canvas + popups). It re-uses the ionic CONTENT tile/detail renderers —
// the pixel precision comes from the host placing tiles by their author position
// (the skin declares `honors: ['position']`), not from bespoke tiles. So a single
// set of content renderers backs both the responsive ionic skin and this pixel
// skin; only the page-level appearance differs (golden rule: renderer by type,
// skin owns the how).

import { tiles, details } from "@obs-visu-skins/ionic";

export { tiles, details };
export { page } from "./src/page.js";
