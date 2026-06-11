import { defineConfig } from "vite";

// Schlichte Dev-Seite — Vue läuft per Runtime-h() (kein SFC-Plugin nötig).
export default defineConfig({
  server: {
    fs: {
      // Der Vertrag (@obs/visu-contract) ist per pnpm `link:` aus einem Repo
      // ausserhalb dieses Workspaces eingebunden. Vite folgt dem Symlink auf den
      // realen Pfad — beide Wurzeln müssen für den Dev-Server erlaubt sein.
      allow: ["../../..", "/Volumes/Daten/Projekte/openbridge/openbridgeserver-visu-integrate"],
    },
  },
});
