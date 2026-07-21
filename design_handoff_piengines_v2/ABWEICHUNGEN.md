# ABWEICHUNGEN — PiEngines Handover v2

Dokumentiert **alle** bewussten Abweichungen von der ursprünglichen Anforderung (auch die vom Lead angeordneten) sowie bekannte Inkonsistenzen im Prototyp. Damit der Lead die Handover an die Entwicklung ohne Rückfragen schreiben kann.

**Stand:** 18.07.2026 · Quelle der Screens: `PiEngines FINAL.dc.html`

---

## A · Vom Lead angeordnete Abweichungen (per Fragebogen, 18.07.2026)

| # | Anforderung im Original-Brief | Umgesetzt stattdessen | Angeordnet von |
|---|---|---|---|
| A1 | Bottom-Nav = **Home / Suchen / + / Garten / Profil** | Bottom-Nav = **Home / Rezepte / Neu(+) / Garten / Mehr** — **Profil liegt unter »Mehr«, ist KEIN eigener Slot** | Lead |
| A2 | Je Fläche **Desktop UND Mobile** getrennt (mit Breakpoints) | **Nur Mobile als HTML.** Desktop/Responsive je Fläche nur **schriftlich** in `SPEC.md §4` beschrieben (Breakpoints Mobile<768 · Tablet 768–1024 · Desktop>1024) | Lead |
| A3 | „Falls Auth zum Konzept gehört: mit rein" | **Auth NICHT enthalten** (Login/Registrierung). Existiert im Projekt bisher nicht; bewusst ausgelassen | Lead |
| A4 | „Stories / Aktivität" als Fläche | Abgedeckt durch **Feed-Screen** (`feed.html`) + Story-Zettel-Reihe auf Home. **Kein separater Vollbild-Story-Viewer** designt (bisher nirgends gebaut) | Lead |
| A5 | Ausgabeort | **Neuer, versionierter Ordner** `design_handoff_piengines_v2/`. Das alte Paket `design_handoff_piengines/` (Stand 17.07., VOR Wahl 2.0) bleibt unangetastet erhalten | Lead |

> **Wichtig zu A1:** Der Original-Brief und der aktuelle Design-Stand widersprachen sich hier direkt. Der Lead hat zugunsten des FINAL-Stands (Profil unter »Mehr«) entschieden. Falls die Entwicklung Profil doch als eigenen Slot erwartet, ist das **vor** Implementierung zu klären.

---

## A2 · Abweichungen aus der Umsetzung (Phase F3b, nachgetragen)

Entstanden während der Implementierung, jeweils vom Lead angeordnet oder in der Handover dokumentiert.

| # | Fläche | Design sagt | Umgesetzt stattdessen | Grund |
|---|---|---|---|---|
| F1 | Social-Integration (§14) | OAuth-Flow: „Konto verbinden → deine Beiträge laden → auswählen" | **Manueller Flow:** User fügt die Beitrags-URL selbst ein (Teilen → „Link kopieren"), Vorschau per oEmbed, dann speichern | OAuth ist als Produktentscheidung weggeschoben (Professional-Konto-Pflicht + App-Review). Vgl. D7 |
| F2 | Social-Integration (§14) | — | **Feld „Beschreibung einfügen"** bei Instagram | Instagram liefert per oEmbed keine Caption; ohne sie gäbe es keine Zutaten-Extraktion |
| F3 | Beitrags-Embed | — | **Instagram als direkter Embed-iFrame** (`…/{typ}/{code}/embed/`) statt `embed.js`; TikTok weiter über `embed.js` | Instagrams `embed.js` antwortet live mit HTTP 503, `window.instgrm` bleibt undefiniert |
| F4 | Profil eigen (§13), Profil öffentlich (§15) | Social-Chips „verbundene Konten" | **Weggelassen** | Ohne OAuth gibt es nichts zu verbinden |
| F5 | Profil öffentlich (§15) | Tab „Fotos" | **Tab „Beiträge"** — die manuell verlinkten Instagram-/TikTok-Beiträge | Kein OAuth-Crossposting; die verlinkten Beiträge sind die vorhandene Datenquelle. Leerer Tab wird wie bei „Fotos" ausgeblendet |
| F6 | Profil öffentlich (§15) | Glocke bei „Gefolgt" | **Sichtbar, aber deaktiviert** (`aria-disabled`, Tooltip „bald") | Benachrichtigungen kommen erst in F3b-5. Bewusst nicht entfernt, damit die Fläche später nur aktiviert werden muss |
| F7 | Profil eigen (§13) | Tabs „Meine Rezepte" · „Gespeichert" | **Dritter Tab „Einstellungen"** | Die Seite trug bereits die komplette Kontoverwaltung (Daten, Passwort, Erscheinungsbild, freigegebene Rezepte, Konto löschen). Sie bleibt vollständig erhalten und zieht in einen eigenen Tab |
| F8 | Netzwerk-Liste | „offen" (D6) | **Schlicht im Systemstil:** Segmented Follower/Folge ich, Zeile = Avatar + Name/@username, „Mehr laden"-Button | Design markiert die Fläche als offen; Nachladen explizit statt Infinite-Scroll (verträgt sich mit der ScrollRestoration der App) |

---

## B · Struktur-Abweichungen gegenüber der Flächenliste im Brief

Der Brief nennt einige Flächen zusammengefasst; geliefert wird feiner aufgeteilt (mehr Detail, nichts fehlt):

| Brief | Geliefert | Grund |
|---|---|---|
| „Garten / Kalender (Aufgaben diese Woche)" — eine Fläche | **zwei** Flächen: `mein-beet.html` (Garten-Hub) + `kalender.html` (Saison & Arbeit) | Im Konzept getrennte Screens; „Aufgaben diese Woche" liegt in Kalender→ARBEIT, gespeist aus Mein Beet |
| „Kräuterschule (Übersicht + Pflanzen-Detail)" | `kraeuterschule.html` + `pflanzendetail.html` | wie gefordert, zwei Dateien |
| „Profil" — eine Fläche | **zwei** Flächen: `profil-eigen.html` + `profil-oeffentlich.html` | eigenes vs. fremdes Profil unterscheiden sich in Aktionen/Tabs |
| „RecipeCard" (bestehend) | Als **Foto-Kachel (Wahl 2.0)** geliefert, §2.1 | Redesign: Titel auf Foto statt Farbblock-Karte. Alte RecipeCard nur noch als Fallback-Logik (ohne Foto) |
| „Favoriten" (optional erwähnt) | Als **Tab „GESPEICHERT"** in `profil-eigen.html` (Favoriten + Sammlungen), **kein** eigener Screen | Favoriten sind im Konzept Teil des Profils |
| „Neu / Erstellen" (optional erwähnt) | Enthalten als `neues-rezept.html` (5-Schritte-Wizard) | — |
| — | Zusätzlich `farbkonzept.html` (System-Referenz) geliefert | Ein Farbwert je Kategorie, app-weit; für Entwicklung als verbindliche Palette wichtig |

---

## C · Design-Stand: Wahl 2.0 statt altem Paket

Das **frühere** Paket `design_handoff_piengines/` (17.07.) zeigt einen **veralteten** Stand (vor „Wahl 2.0"). Dieses v2-Paket wurde komplett aus `PiEngines FINAL.dc.html` neu generiert. Wesentliche Unterschiede:

- **Foto-Kacheln** statt bunter Farbverlaufs-Karten für alle Rezept-/Pflanzen-Thumbnails (Foto-Platzhalter mit Streifenmuster).
- **Zwei Farbwelten** (Braun = Rezepte/Konto, Grün = Garten/Pflanzen), erkennbar am Header-Ton.
- **Rezepte-Browse:** Foto-Grid + schwebendes Filter-Muster (FAB unten rechts, aktive Pills unten links, `+n`-Overflow). Keine obere Chip-Leiste, keine Kategorien-Reihe im Browse, kein Header-Filter-Icon.
- **Such-Fokus-Overlay** als Katalog-Einstieg (Kategorie-Kacheln, Beliebt, Zuletzt gesucht).
- **Home:** Feed-Icon (Personen) im Header statt Segment-Toggle „Für dich · Von Gefolgten" (Toggle wurde **verworfen**).
- **Ein Farbwert je Kategorie** (`farbkonzept.html`), überall gleich verwendet.

Falls die Entwicklung bereits mit dem alten Paket begonnen hat: **v2 ist maßgeblich.**

---

## D · Bekannte Inkonsistenzen / offene Punkte im Prototyp

Diese sind NICHT „fertig entschieden" — bitte in die Handover als offene Klärungen aufnehmen:

| # | Fläche | Punkt | Status |
|---|---|---|---|
| D1 | Feed (`feed.html`) | Der **Empty-State**-Screen trägt in der Bottom-Nav noch die **alten Labels „Suchen" / „Profil"** statt „Rezepte" / „Mehr". Alle anderen 30+ Nav-Instanzen im FINAL sind korrekt (Home/Rezepte/Neu/Garten/Mehr). | **Prototyp-Bug** — vor Umsetzung angleichen. Verbindlich ist §2.7 |
| D2 | Rezepte (§2.10) | **FAB-Farbe** noch nicht final: aktuell dunkel; evtl. Terrakotta zur Abgrenzung vom dunklen Nav-»+« | offen (Design-Entscheidung) |
| D3 | Rezept-Detail | **Cross-Highlighting** (Zutat→Schritte markieren, nicht-relevante auf 35 % dimmen) im Datenmodell vorhanden; **Discoverability** (Hinweis/Icon je Zutatenzeile) noch nicht gelöst | offen |
| D4 | Rezept-Detail | Zutaten-Panel (Kochmodus) und Zutaten-Tab **müssen dieselbe Datenquelle** zeigen (gleiche Portionen/Gruppierung). Im Mockup teils Diskrepanz (8 vs. 10 Portionen) | zu vereinheitlichen |
| D5 | Mein Beet | **Onboarding-Screen** „was wächst bei dir?" noch nicht gebaut; „eigene Pflanze" (ohne Auto-Aufgaben) ohne Screen; Beet↔Vorrat-Verknüpfung im Fratcher noch nicht visualisiert | offen |
| D6 | Profil (eigen) | **Netzwerk-Liste** (Follower/Folge-ich) und **Sammlungs-Detail**-Screen fehlen noch; Freigaben-Einstieg im Rezept-Detail sichtbar machen | offen |
| D7 | Social | **Phase 2 (Crossposting)** beim Rezept-Erstellen geparkt (Professional-Konto-Pflicht + App-Review ~2–4 Wochen). Nur Phase 1 spezifiziert | bewusst geparkt |
| D8 | Story-Viewer | Vollbild-Story-Viewer (aus Story-Zettel-Tap) ist **nicht** designt (siehe A4) | ausgelassen |

---

## E · Format-Hinweise zur Lieferung

- HTML-Dateien sind **Design-Referenzen** (Prototypen), kein Produktionscode — im Ziel-Stack mit dessen Mustern nachbauen.
- Jede Datei ist **self-contained** (inline CSS/SVG, keine externen Assets außer Google-Fonts-Link) und rendert einzeln offline. *Anmerkung:* Fonts (Lora/DM Sans/DM Mono) werden per Google-Fonts-`<link>` geladen — ohne Netz greift der System-Font-Fallback; Layout bleibt intakt.
- Ein Screen-File kann **mehrere Zustände** derselben Fläche nebeneinander zeigen (z. B. Rezepte ①–⑤, Rezept-Detail ①–⑤). Die Zustände sind im File beschriftet und in `SPEC.md §4` benannt.
- Datentyp-Legende (in den Spec-Tabellen): `[R]` Rezept-Datum · `[U]` Nutzer-Datum · `[N]` neues Konzept (Backend neu) · `[S]` statisch/redaktionell. **Das Endpoint-Mapping macht der Lead.**
