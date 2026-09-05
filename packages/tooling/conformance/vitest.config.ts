import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Der honors-Probelauf MOUNTET die Seite mit Vue und feuert echte
    // MouseEvents. `@vue/runtime-dom` greift `document` beim Modul-Laden ab,
    // also muss das DOM stehen, BEVOR irgendein Import Vue nachzieht — das
    // leistet nur die Umgebung, kein Setup-Hook im Test.
    environment: "jsdom",
    include: ["tests/**/*.spec.ts"],
    // Der erste dynamische Import eines Skins zieht Vue + alle Renderer nach und
    // liegt über dem 5s-Default; der Lauf selbst ist schnell. Seit der Probelauf
    // eine DOM-Laufzeit hochzieht, kommt jsdom dazu — im KALTSTART (frisches
    // `pnpm install`, alles noch zu transformieren) riss der Lauf die 30 s und
    // war beim zweiten Mal grün: ein Flake, kein Befund.
    //
    // Das deckt keinen echten Hänger: der honors-Probelauf trägt sein EIGENES
    // Budget von 3 s je Skin, ein hängender Handler wird also dort gefangen und
    // nicht hier. Diese Grenze fängt nur den Kaltstart ab.
    //
    // 120 s seit der a11y-Achse: `pnpm -r test` fährt sechs Pakete gleichzeitig,
    // und die Farbmessung rechnet dabei über Tausende Paarungen. Der erste Lauf
    // nach `pnpm install` riss die 60 s deshalb gelegentlich — einzeln lief
    // dieselbe Datei in 4 s durch, und die Folgeläufe waren grün. Ein Flake also,
    // aber einer mit hässlicher Nebenwirkung: der abgebrochene Test schreibt
    // SPÄTER weiter auf stdout und landet im Puffer des nächsten, dessen
    // JSON.parse dann an einer Stelle bricht, die mit ihm nichts zu tun hat.
    testTimeout: 120_000,
    typecheck: {
      enabled: true,
      include: ["tests/**/*.spec.ts"],
    },
  },
});
