// @obs-visu-skins/edomi — the skin's export surface (CONTRACT-v1.md §7).
//
// The Edomi POC owns the whole page via a `page` renderer (nav + pixel-precise
// layer canvas + popups). It re-uses the ionic CONTENT tile/detail renderers —
// the pixel precision comes from the host placing tiles by their author position
// (the skin declares `honors: ['position']`), not from bespoke tiles. So a single
// set of content renderers backs both the responsive ionic skin and this pixel
// skin; only the page-level appearance differs (golden rule: renderer by type,
// skin owns the how).

import { tiles, details, presets } from "@obs-visu-skins/ionic";

// Re-use the ionic content renderers AND its position-preset surface so a
// blind/jalousie with configured presets keeps its long-press quick menu (the
// manifest declares the matching `gestures`); the pixel precision comes from the
// host placing tiles by their author box, not from bespoke content.
export { tiles, details, presets };
export { page } from "./src/page.js";
