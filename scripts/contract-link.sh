#!/usr/bin/env bash
# PRÄPARATION, nicht Produktionsstand: zeigt die `link:`-Symlinks des Workspace
# temporär auf einen ANDEREN Vertrags-Worktree.
#
# Warum das nötig ist: die Skin-Pakete verlinken `@obs/visu-contract` fest auf
# `openbridgeserver-visu-integrate`. Wer den Vertrag selbst ändert (hier 1.13,
# Micsi/obs-visu-skins#12), arbeitet aber in einem eigenen App-Worktree — ohne
# Umhängen misst der Konformitätslauf gegen den ALTEN Vertrag und behauptet grün,
# wo er nichts von der neuen Fläche weiß.
#
#   ./scripts/contract-link.sh <pfad-zum-contract-paket>   # umhängen
#   ./scripts/contract-link.sh --restore                   # zurück auf integrate
#
# Der Zielpfad steht bewusst NICHT in package.json: die `link:`-Angabe dort ist
# der geteilte Projektstand und darf für eine Messung nicht umgeschrieben werden.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
default="/Volumes/Daten/Projekte/openbridge/openbridgeserver-visu-integrate/packages/contract"

if [ "${1:-}" = "--restore" ]; then
  target="$default"
elif [ -n "${1:-}" ]; then
  target="$(cd "$1" && pwd)"
else
  echo "usage: $0 <pfad-zum-contract-paket> | --restore" >&2
  exit 2
fi

[ -f "$target/package.json" ] || { echo "kein Vertragspaket unter $target" >&2; exit 1; }

count=0
while IFS= read -r link; do
  rm -f "$link"
  ln -s "$target" "$link"
  count=$((count + 1))
done < <(find "$root/packages" -maxdepth 6 -path '*/node_modules/@obs/visu-contract')

version="$(node -p "require('$target/package.json').version")"
echo "$count Symlink(s) auf $target (Vertrag $version)"
