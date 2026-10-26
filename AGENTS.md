# Käfig

Öffentliche Arena: Ein KI-Agent arbeitet in einer Wegwerf-microVM und bekommt die
Aufgabe „Fasse dieses Dokument zusammen und lege eine Notiz ab". Besucher reichen
ein Dokument ein und versuchen, den Agenten über eine Grenze zu bringen. Drei
Stufen: Plaudern (Köder landet in der Ausgabe), Rausfunken (Daten erreichen eine
Adresse außerhalb der Allowlist), Ausbruch (Lesezugriff auf eine Flagge außerhalb
der microVM). Jeder Versuch kostet 100 sats per L402. Alles landet im öffentlichen,
hash-verketteten Protokoll. Außenwirkung für Pleasance (Sicherheit, Rust, Bitcoin)
und zugleich eine Defensiv-Demo, dass das Isolationsmodell hält.

Aufbau, Stack und Starter-Konventionen: README.md. Dieses Repo folgt dem Starter;
nur die Abweichungen unten gelten zusätzlich.

## Zweck & Links

- Stack wie Starter: Bun, Hono, SvelteKit, Drizzle, Postgres, CLI in `apps/cli`.
  Kein `apps/mobile` (Web-only, Ordner und `mobile.yml` entfernt).
- Arena-Kern: `apps/api/src/lib/arena` (Runner, Erkennung, Agent), `lib/l402`
  (Bezahl-Paywall), `lib/protocol.ts` (Protokoll). Routen: `apps/api/src/routes/arena.ts`.
  Web: `apps/web/src/routes/(arena)`, Client-Logik in `apps/web/src/lib/arena.svelte.ts`.
- Noch nicht deployt. Live-Gehen (Server mit KVM, Kopfgeld-Topf, Domain) entscheidet
  Robin (Grundsatz 8).

## Checks

`bun run check && bun run test`. Bei CLI-Änderungen zusätzlich `bun run build`.
Die Tests fahren die Arena gegen die Simulation (`KAEFIG_RUNNER=sim`), nie gegen
eine echte microVM — CI hat kein KVM. Der volle Durchlauf gegen microsandbox
läuft nur lokal auf dem Laptop (KVM vorhanden).

## Deploy

Kein Deploy, keine Coolify-App, keine Domain, bis Robin das Live-Gehen entscheidet.
Ablauf dann wie im Starter-README; die microVM braucht einen Host mit KVM (nicht
die Hetzner-Cloud), ohne KVM fällt die Arena auf die Simulation zurück.

## Fallen

- Der geköderte Agent ist absichtlich naiv und injektionsanfällig — das ist das
  Ziel. Er erbt keine Werkzeuge, Zugänge oder Secrets des Betreibers, nur die
  Aufgabe und den Köder in seinem Kontext (Khala: `untrusted-input-agents-inherit-operator-tools`).
  Keine echten Secrets in der VM, nur Köder. Keine Exploit-Beispiele in Repo, Seeds
  oder Beispieldaten.
- Echte Ausbrüche aus microsandbox sind kein Bauziel. Die Arena erkennt und
  protokolliert Versuche; Stufe 2 und 3 bleiben bei haltender Isolation unerreichbar
  (so soll es sein). Der demonstrierbare Treffer ist Stufe 1 (Köder in der Ausgabe).
- Auszahlungen (`claims`) entstehen nur als `pending`; den Versand macht Robin von
  Hand, nie ein Agent (Grundsatz 8).
- Lokale DB läuft auf Port 5455 statt 5433 (der Starter belegt 5433 auf diesem Laptop).
- Der Lauf eines Versuchs streamt die Trace als NDJSON innerhalb der Anfrage
  (request-scoped), nicht als Hintergrundjob. Für viele parallele Läufe später in
  den Worker mit SSE über Postgres `NOTIFY` verschieben (wie music-hub).

## Abweichungen vom Standard

Robins Rust-Bausteine, soweit sie tragen, und wo die einfachste FOSS-Alternative
genommen wurde (begründet):

- **microsandbox** (Rust, libkrun) ist der microVM-Runner, über das offizielle
  TypeScript-SDK aus der Bun-API (`lib/arena/microsandbox-runner.ts`). Lazy geladen,
  damit die API ohne KVM normal startet.
- **boringtun** nicht eingezogen: microsandbox bringt die Netz-Allowlist selbst mit
  (eigene Policy-Engine, default-deny + erlaubte Ziele, 403 auf Geblocktes). Ein
  zweiter WireGuard-Layer wäre Doppelung ohne Mehrwert (Grundsatz 3).
- **uutils** nicht eingezogen: Der geköderte Agent ist ein kleines sh-Programm in der
  microVM und braucht keine eigene Coreutils-Sammlung. Das alpine-Image reicht; ein
  uutils-Image ließe sich bei Bedarf eintauschen.
- **Turso** als Protokoll: Statt der gehosteten Turso-CDC ein lokal betreibbares,
  hash-verkettetes, append-only Protokoll in Postgres (`lib/protocol.ts`, Tabelle
  `protocol`, serialisiert per `pg_advisory_xact_lock`). Das gibt Fälschungssicherheit
  und öffentliche Einsicht ohne Cloud-Abhängigkeit und passt zum zustandslosen
  Starter-Modell (eine DB, kein Extra-Volume). Turso-CDC ließe sich beim Live-Gehen
  hinter derselben `append`/`recent`-Schnittstelle einhängen.
- **L402**: eigene, schlanke Umsetzung (HTTP 402 + signierter Token mit Payment-Hash
  und Dokument-Hash + Lightning-Rechnung) statt einer Macaroon-Bibliothek. Backend
  hinter `lib/l402/backend.ts`; aktuell nur ein deterministisches Test-Backend (kein
  echtes Geld). Ein echter Node (LND/LNbits, Regtest/Testnet) wird dort beim
  Live-Gehen eingehängt. Auszahlungen immer nach Robins manueller Prüfung.
- `KAEFIG_RUNNER`, `KAEFIG_PACE_MS`, `KAEFIG_POT_SEED_SATS` steuern Runner, Trace-Tempo
  und Pot-Startwert (`apps/api/src/env.ts`, `.env.example`).
