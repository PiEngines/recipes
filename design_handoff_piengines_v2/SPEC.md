# PiEngines — Spezifikation & Vorlagensatz (Wahl 2.0)

**Für:** Lead (Umsetzungs-Handover an die Entwicklung)
**Design-System:** „Oma Hildes Dorfladen" — Ausbaustufe **Wahl 2.0**
**Quelle:** `PiEngines FINAL.dc.html` (maßgebliche Auslieferungs-Canvas)
**Fidelity:** Hi-Fi — finale Farben, Typo, Spacing, Copy. Im Ziel-Stack pixelgenau nachzubauen.
**Stand:** 18.07.2026
**Hinweis:** Die HTML-Dateien in `/screens` sind **Design-Referenzen** (Prototypen), kein Produktionscode. Sie rendern einzeln und offline (inline CSS/SVG). Die Prototypen sind **mobile-first** (390 px Rahmen); die Desktop-Angaben je Fläche beschreiben die responsive Erweiterung (kein Desktop-HTML — bewusste Abweichung, siehe `ABWEICHUNGEN.md`).

> **Vor dem Lesen:** `ABWEICHUNGEN.md` enthält alle bewussten Abweichungen von der Original-Anforderung (inkl. der vom Lead angeordneten) und offene/inkonsistente Punkte im Prototyp. Bitte zuerst überfliegen.

---

## Deckblatt — Flächenliste

| # | Fläche | Datei | Typ | Farbwelt |
|---|---|---|---|---|
| 01 | Home | `screens/home.html` | bestehend (erweitert) | Braun |
| 02 | Rezepte / Suche | `screens/rezepte.html` | bestehend (Redesign Wahl 2.0) | Braun |
| 03 | Rezept-Detail | `screens/rezept-detail.html` | bestehend | Braun |
| 04 | Kategorie-Übersicht | `screens/kategorien.html` | bestehend | Braun |
| 05 | Neues Rezept (Wizard) | `screens/neues-rezept.html` | bestehend | Braun |
| 06 | Feed / Aktivität | `screens/feed.html` | 🆕 **neues Feature** | Braun |
| 07 | Kräuterschule — Übersicht | `screens/kraeuterschule.html` | 🆕 **neues Feature** | Grün |
| 08 | Pflanzen-Detail | `screens/pflanzendetail.html` | 🆕 **neues Feature** | Grün |
| 09 | Fratcher (Kühlschrank-Matching) | `screens/fratcher.html` | 🆕 **neues Feature** | Braun |
| 10 | Shoppingliste | `screens/shoppingliste.html` | 🆕 **neues Feature** | Braun |
| 11 | Kalender (Saison & Arbeit) | `screens/kalender.html` | 🆕 **neues Feature** | Grün |
| 12 | Mein Beet | `screens/mein-beet.html` | 🆕 **neues Feature** | Grün |
| 13 | Profil (eigen) | `screens/profil-eigen.html` | bestehend (erweitert) | Braun |
| 14 | Social-Integration (Insta/TikTok) | `screens/social-integration.html` | 🆕 **neues Feature** | Braun |
| 15 | Profil (öffentlich) | `screens/profil-oeffentlich.html` | bestehend (erweitert) | Braun |
| S | Farbkonzept — Kategorien | `screens/farbkonzept.html` | System-Referenz | — |
| — | Navigation (Top + Bottom) | siehe §3 „Navigation / IA" | global | — |
| — | RecipeCard / RecipeRow / Foto-Kachel | siehe §2 „Komponentenbibliothek" | global | — |

**Legende Datentyp (in den Flächen-Tabellen):** `[R]` bekanntes Rezept-Datum · `[U]` bekanntes Nutzer-Datum · `[N]` **neues Konzept** (Backend muss neu modelliert werden) · `[S]` statisch/redaktionell.

---

# §1 · Globale Design-Basis (Tokens)

### 1.1 Zwei Farbwelten (Wahl 2.0)
Die App teilt sich sichtbar in zwei Welten, erkennbar am Header-Ton:

| Welt | Header-Hex | Gilt für Flächen | TOC-/Akzent-Punkt |
|---|---|---|---|
| **Braun — Rezepte/Konto** | `#2e2618` | Home, Rezepte, Rezept-Detail, Kategorien, Neues Rezept, Feed, Fratcher, Shoppingliste, Profil (eigen/öffentlich), Social | `#7aa060` |
| **Grün — Garten/Pflanzen** | `#2b4524` | Kräuterschule, Pflanzendetail, Kalender, Mein Beet | `#5a7d3f` |

### 1.2 Farben — Light (Standard)
| Token | Hex | Verwendung |
|---|---|---|
| `--bg` | `#f6f0e4` | App-Hintergrund (Creme) |
| `--bg-alt` | `#ede5d4` | Filter-/Meta-Leisten, gedämpfte Flächen |
| `--surface` | `#fffef8` | Karten, Zettel, weiße Akzent-Karte |
| `--ink-braun` | `#2e2618` | Header/Nav Rezepte-Welt, primäre Buttons |
| `--ink-gruen` | `#2b4524` | Header Garten-Welt |
| `--text` | `#2a2218` | Haupttext |
| `--text-muted` | `#9a8870` | Sekundärtext, Autoren, Timestamps |
| `--accent` | `#c85030` | Terrakotta — CTA, aktiv, Badges, Herz-Fill |
| `--green` | `#5a7048` / `#256d3a` | Kräuter/Garten, vegetarisch, „Ernte" |
| `--gold` | `#b87820` | Mengen, Backen, „endet bald" |
| `--blue` | `#3f72b0` | Aussaat (Kalender-Punkte), Hauptgerichte |
| `--wood-shadow` | `#d4b88a` | Karten-Unterkante (4px box-shadow) |
| `--nav-top` | `#d4b88a` / `#c4a870` | Bottom-Nav Oberkante (2px + 2px Schatten) |
| `--hairline` | `rgba(0,0,0,.07)` | Trennlinien auf Creme |

### 1.3 Kategorie-Farbpalette (verbindlich, ein Wert je Kategorie)
Referenz-Screen: `screens/farbkonzept.html`. **Ein Farbwert je Kategorie**, überall gleich: Kategorie-Kacheln, Filter-Chips, SAISON-/Kategorie-Badges. Auf Fotos liegt die Farbe als **Verlaufs-Overlay** (`linear-gradient(135deg, HEX, dunklere Variante)`), damit sie über Bildern lesbar bleibt.

| Gruppe | Kategorie | Hex |
|---|---|---|
| Zubereitung | Backen | `#C67A1E` |
| | Grillen | `#B2331E` |
| | Einkochen | `#2E8C86` |
| | Fermentieren | `#7A4CA0` |
| Gänge & Gerichte | Suppen | `#DD6236` |
| | Salate | `#8FBE3E` |
| | Pasta | `#9E5A2C` |
| | Desserts | `#C25C93` |
| Garten & Vorrat | Kräuter | `#256D3A` |
| | Aufstriche | `#B79A4E` |
| Basis (app-weit) | Frühstück | `#E4B23C` |
| | Hauptgerichte | `#3F72B0` |
| | Getränke | `#8A2E4E` |
| Pflanzen (Kräuterschule) | Küchenkräuter | `#5A7D3F` |
| | Gemüse | `#B06A34` |
| | Obst | `#9E4E6E` |
| | Heilkräuter | `#8A7BA8` |
| | Wildkräuter | `#6E7A3A` |

### 1.4 Farben — Dark
| Token | Hex |
|---|---|
| `--bg` | `#2a2418` |
| `--bg-alt` | `#32302a` |
| `--surface` | `#3a352b` |
| `--text` | `#f0e8d0` |
| `--text-muted` | `rgba(240,232,208,.5)` |
| Akzente / Kategorie-Farben | unverändert, ggf. +6 % Lightness |

> Dark-Mode = Token-Umschaltung; die Prototypen zeigen Light.

### 1.5 Typografie
| Familie | Gewichte | Rolle |
|---|---|---|
| **Lora** (serif) | 500/700, italic | Titel, Rezept-/Pflanzennamen, Sektionsüberschriften, Titel auf Foto-Kacheln |
| **DM Sans** | 400/500/600/700 | Fließtext, Buttons, Labels |
| **DM Mono** | 400/500 | Metadaten, Tags, Kategorien, Timestamps, Zähler, Nav-Labels |

Skala (px): 9 · 10 · 11 · 13 · 15 · 16 · 18 · 21 · 22 · 24 · 28. Titel meist `italic 700 Lora`. Meta/Tags meist `DM Mono` uppercase, `letter-spacing .08–.16em`. Deutsche Komposita: `hyphens:auto` + `lang="de"`.

### 1.6 Spacing / Radien / Schatten
- **Spacing-Skala:** 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 40 · 44 (px).
- **Radien:** 2–3 px (Tags, Chips) · 4–6 px (Karten) · 8 px (Foto-Kacheln) · 40 px (Phone-Frame) · 50 % (Avatare).
- **Schatten Karte:** `0 2px 8px rgba(0,0,0,.08), 0 4px 0 0 #d4b88a` (charakteristische „Holzkante").
- **Schatten Foto-Kachel:** `0 4px 14px rgba(0,0,0,.12)`.
- **Primär-Button:** Terrakotta `#c85030` + `box-shadow:0 2px 0 #9a3820` (gedruckte Kante).

### 1.7 Foto-Platzhalter (Wahl 2.0 — wichtig)
Alle Rezept-/Pflanzen-/Social-Thumbnails sind **Foto-Platzhalter**, KEINE bunten Farbverläufe: diagonales Streifenmuster `repeating-linear-gradient(45deg, #c8bda4, #c8bda4 8px, #bfb397 8px, #bfb397 16px)`, teils mit ◭-Glyph. Signalisiert dem Entwickler: hier kommt ein echtes Foto rein. Marken-Logos (Instagram/TikTok) bleiben als echte Glyphen.

### 1.8 Icons
Alle Icons **Inline-SVG**, `stroke-width 1.5–1.6`, `stroke-linecap round`, `viewBox 0 0 24 24`. Kein Icon-Font. Set: Lupe, Glocke, **Personen/Feed**, Herz (outline/fill), Chevron, Plus, Home, Blatt (Garten), Person (Profil/Mehr), Timer, Mikrofon, Kamera, Teilen, Check, Stern. Farbe erbt via `currentColor`.

---

# §2 · Komponentenbibliothek

Jede Komponente einmal spezifiziert; Flächen verweisen darauf.

### 2.1 Foto-Kachel / RecipeCard (Wahl 2.0)  `[Redesign]`
Das neue Kern-Element im Browse-Grid. **Kachel-Regeln (Tag-1-fix, ändern sich im Betrieb nie):**
- Feste **4:3** (Featured **16:9**), Foto `object-fit:cover`, `border-radius:8px`, Schatten §1.6.
- **Titel auf dem Bild** (`italic 700 Lora`, weiß) mit kräftigem Gradient unten (`linear-gradient(transparent, rgba(0,0,0,.7))`) + Textschatten → lesbar auch auf hellen Fotos.
- **Kategorie · Zeit** oben links (Chip, Kategorie-Farbe §1.3). **Herz** oben rechts (Kreis, füllt gut aus).
- Unten: **Autor** (Ellipsis) + **★-Bewertung** (fix rechts).
- **Fallback ohne Foto = identische Kachel** mit Kategorie-Farbblock + Glyph → Layout bleibt stabil, sanfter Anreiz, Fotos nachzureichen.
- Varianten: `default` · `saved` (Herz gefüllt) · `season` (SAISON-Badge oben rechts) · `featured` (16:9, volle Breite).

### 2.2 RecipeRow  `[bestehend]` — Standard wo Metadaten zählen
Horizontale Zeile (Fratcher-Treffer, Suche-Ergebnisliste, Pflanzen-Detail „Rezepte"). Foto-Platzhalter links (56–64 px), rechts Titel + Meta-Zeile (Zeit · Bewertung · Autor). Featured-Karte nur redaktionell.

### 2.3 Story-Zettel  🆕
Papier-Kachel `58×72 px`, `background:#fffef8`, Farbstreifen oben (3 px, User-Farbe), Avatar-Kreis 28 px, Name (`8px DM Mono`), Status (`+n neu` / `gesehen`; gesehene `opacity:.5`). States: `neu` · `gesehen` · `eigene (+ hinzufügen)`.

### 2.4 Weiße Akzent-Karte  `[bestehend]`
`background:#fffef8`, Karten-Schatten; für hervorgehobene Einzelinhalte (Kühlschrank-Banner, Tages-Tipp).

### 2.5 Kräuter-Hero / „Kraut der Woche"  🆕
Kreidetafel-Element: `background:#32302a`, `repeating-linear-gradient` (Linien-Textur), inset border `rgba(255,255,255,.06)`, Titel `italic 700 Lora #f0e8d0`. Varianten: `hero` (Home, groß) · `streifen` (klein).

### 2.6 Garten-Karte  🆕
Beet-/Pflanzeneintrag: Phase-Badge (**Aussaat** blau · **Wächst** grün · **Ernte** ocker), Pflanzenname (Lora), Standort + Pflanzdatum (DM Mono), optional Fortschritts-Timeline.

### 2.7 Bottom-Nav (5 Slots)  🆕 — **verbindliche Struktur**
`background:#f6f0e4`, `border-top:2px #d4b88a` + `box-shadow:0 -2px 0 #c4a870`, fix unten, Höhe 78 px. Slots:
**Home · Rezepte · Neu (zentraler dunkler +, 44×44, `#2e2618`, erhöht −16 px) · Garten · Mehr.**
- **Profil liegt unter »Mehr«/Avatar — KEIN eigener Nav-Slot.**
- Aktiv = Terrakotta-Icon + Label. Inaktiv = `#b0a090`. Hit-Target ≥ 44 px.
- **Aktiver Tab je Screen:** eigener Bereich = zugehöriger Slot aktiv; hineingesprungene Unterseiten (fremdes Profil, Feed) = Footer neutral (kein Tab aktiv); Social/Einstellungen = »Mehr« aktiv.

### 2.8 Top-Nav / Header  `[erweitert]`
Header im Farbwelt-Ton (§1.1). Links Kontext-Titel (Lora). Rechts auf Home: **Feed-Icon (Personen)** + **Glocke mit Badge** + Avatar. Auf Detail-Screens: Zurück-Pill links.
> **Trennung (final):** Feed-Icon = Aktivität Gefolgter · Glocke = Reaktionen auf dich. **Kein** Home-Segment-Toggle (verworfen).

### 2.9 Segmented Control  `[bestehend]`
Zwei/drei Segmente (`BEET · KALENDER`, `SAISON · ARBEIT`, `Veröffentlicht · Entwürfe`). Aktiv = dunkle Pille auf hellem Grund.

### 2.10 Filter-Muster (Wahl 2.0)  🆕 — schwebende Ebene über der Nav
- Unten rechts: runder **Filter-FAB** (öffnet Filter-Bottom-Sheet).
- Unten links: **schwebende Pills** der aktiven Filter (weiß, Kategorie-Punkt + ✕), **`+n`-Overflow** (max. 2 sichtbar).
- **Kein** Zähler-Badge am FAB (redundant zu den Pills). Leerer Zustand = nur FAB.
- **Keine** Chip-Leiste oben mehr; **kein** Header-Filter-Icon.
- FAB-Farbe: aktuell dunkel; **offen**, evtl. Terrakotta zur Abgrenzung vom Nav-»+« (siehe ABWEICHUNGEN.md).

### 2.11 Bottom-Sheet / Modal  `[bestehend]`
Von unten, abgerundete Oberkante, Grab-Handle, gedimmter Hintergrund. Für Filter, Teilen, Freigaben.

### 2.12 Severity-Badge  🆕 (Pflanzen-Probleme)
Ampel: leicht (grün) · mittel (gold) · stark (terrakotta).

---

# §3 · Navigation / IA  `[Wahl 2.0]`

**Bottom-Nav (global, 5 Slots — §2.7):**
1. **Home** → `screens/home.html`
2. **Rezepte** → `screens/rezepte.html` (Browse-Grid + Such-Fokus-Overlay)
3. **Neu** (erhöht, +) → `screens/neues-rezept.html` (Wizard)
4. **Garten** → `screens/mein-beet.html` (Segment „BEET · KALENDER")
5. **Mehr** → Einstiegspunkt zu Profil, Social-Integration, Einstellungen, Basics, Freigaben

**Nicht in der Bottom-Nav, erreichbar über:**
- **Profil (eigen)** → über »Mehr« / Avatar.
- **Feed** → **Feed-Icon (Personen) im Home-Header**. Footer bleibt neutral (kein Tab aktiv).
- **Benachrichtigungen** → Glocke im Home-Header.
- **Kräuterschule / Pflanzen-Detail** → Home-Kraut-Hero, Rezept-Detail (Pflanzen-Block), Garten.
- **Fratcher** → Home-Banner + Rezepte-Suche.
- **Shoppingliste** → Rezept-Detail, Fratcher, Profil.
- **Kategorie-Übersicht** → über den **Such-Fokus** (Kategorie-Kacheln → „Alle Kategorien →").
- **Social-Integration** → »Mehr« → Einstellungen.
- **Profil (öffentlich)** → Tap auf Autor/Avatar irgendwo. Footer neutral.

> **Wichtig:** Bottom-Nav bleibt bei **5 Slots**. Profil ist bewusst **kein** Slot (liegt unter »Mehr«).

---

# §4 · Flächen-Spezifikationen

> Struktur je Fläche: **Zweck · Layout (Mobile / Desktop + Breakpoints) · Komponenten · Dynamische Inhalte · States · Interaktionen · Copy.**
> Breakpoints global: **Mobile < 768 px · Tablet 768–1024 px · Desktop > 1024 px.** Prototyp = Mobile.

---

## 01 · Home  `[bestehend, erweitert]` — `screens/home.html`

**Zweck / Fluss:** Einstieg nach Login. Personalisierte Rezepte, saisonaler Garten-/Kräuter-Bezug, Aktivität von Gefolgten. Start jeder Session.

**Layout Mobile (oben→unten):** Statusbar → Header (braun: Begrüßung + Logo · rechts **Feed-Icon** + **Glocke mit Badge** + Avatar) → Story-Zettel-Reihe (horizontal scroll) → Kraut-der-Woche-Hero → „Heute für dich" (Foto-Kacheln) → Kühlschrank-Banner (→ Fratcher) → „Neue Rezepte" (Foto-Kacheln/RecipeRow) → Bottom-Nav.
**Desktop (>1024):** zweispaltig — linke Hauptspalte (Rezepte), rechte Schiene (Kraut-der-Woche + Garten-Teaser, sticky). Story-Reihe volle Breite oben. Bottom-Nav → linke Sidebar-Nav.
**Tablet:** einspaltig wie Mobile, „Heute für dich" 2-spaltig.

**Komponenten:** Top-Nav (§2.8), Story-Zettel (§2.3), Kräuter-Hero (§2.5), Foto-Kachel (§2.1), weiße Akzent-Karte (§2.4), Bottom-Nav (§2.7).

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Begrüßungsname/Avatar | eingeloggter Nutzer | „M" / Maria | `[U]` |
| Feed-Icon | Einstieg Aktivität Gefolgter | — | `[N]` |
| Glocken-Badge | Anzahl ungelesener Reaktionen | 3 | `[N]` |
| Story-Zettel | Nutzer mit neuer Aktivität + Anzahl neu | „Maria · +3 neu" | `[N]` |
| Kraut der Woche | redaktionell/saisonal gewählte Pflanze | „Bärlauch" | `[N]`/`[S]` |
| „Heute für dich" | empfohlene Rezepte | „Ofengemüse" | `[R]` |
| Kühlschrank-Banner | CTA zum Fratcher | „Was kann ich kochen?" | `[S]` |
| Neue Rezepte | zuletzt veröffentlichte Rezepte | Titel · Autor · Ø-Bewertung | `[R]` |

**States:** *loading* — Skeletons für Story-Reihe + Kacheln (Shimmer). *empty* — noch keine Gefolgten: Feed-Icon führt zu Empty-CTA „Menschen entdecken". *error* — Retry-Zeile pro Block, Rest bleibt bedienbar.

**Interaktionen:** Feed-Icon → Feed-Screen. Glocke → Benachrichtigungs-Screen. Story-Tap → Story-Viewer (nicht Teil dieses Handovers, siehe ABWEICHUNGEN.md). Kraut-Hero-Tap → Pflanzen-Detail. Kachel-Tap → Rezept-Detail. Herz-Tap → speichern (optimistisch). Banner → Fratcher.

**Copy:** „Willkommen bei" · „PiEngines" · „— Rezepte & Kräuterschule" · „Kraut der Woche" · „Heute für dich" · „Neue Rezepte" · „Was habe ich im Kühlschrank?".

---

## 02 · Rezepte / Suche  `[Redesign Wahl 2.0]` — `screens/rezepte.html`

**Zweck / Fluss:** Stöbern & gezielt finden. Zentraler Discovery-Knoten (Bottom-Nav „Rezepte"). Enthält 5 Zustände: ① Browse-Grid · ② Such-Fokus-Overlay · ③ Filter-Panel · ④ gefiltertes Grid · ⑤ Keine Treffer (Filter-Diagnose).

**Layout Mobile:**
- **① Browse (Grid, Foto-Kacheln):** Header + Suchfeld → **Foto-Kachel-Grid** (§2.1). **Keine** Kategorien-Reihe, **keine** Chip-Leiste oben. Filter über schwebende Ebene (§2.10): FAB unten rechts, aktive Pills unten links.
- **② Such-Fokus (Overlay):** Tap ins Suchfeld → Overlay mit **Kategorie-Kacheln** (+ „Alle Kategorien →" → Kategorie-Übersicht), „Beliebt", „Zuletzt gesucht".
- **③ Filter-Panel:** Bottom-Sheet (Ernährung / Zeit / Kategorie / Saison).
- **④ Ergebnis (Grid):** Suchbegriff aktiv (mit ✕), „n Treffer für …" + Sortierung oben, nur Treffer-Kacheln, SAISON-Badge oben rechts.
- **⑤ Keine Treffer:** Filter-Diagnose (siehe States).
**Desktop:** Suchfeld zentriert oben, Filter als linke Sidebar (statt Sheet), Grid 3–4-spaltig.

**Komponenten:** Suchfeld, Foto-Kachel (§2.1), Filter-FAB + schwebende Pills (§2.10), Kategorie-Kachel, Filter-Sheet (§2.11), Sortier-Select.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Suchfeld | Freitext-Query | „Lasagne" | `[R]` |
| Foto-Kachel | Rezept (Bild/Titel/Kategorie/Zeit/Autor/★) | „Kürbis-Lasagne · 4,6" | `[R]` |
| Aktive Filter-Pill | gesetzter Filter | „Vegetarisch ✕" | `[S]` |
| Kategorie-Kachel (Fokus) | Kategorie + Anzahl | „Backen · 48" | `[R]` |
| SAISON-Badge | Treffer ist gerade saisonal | ✓ | `[N]` (redakt. Saison-Flag) |

**States:** *loading* — Kachel-Skeletons. *empty (0 Treffer)* — **Filter-Diagnose**: pro aktivem Filter „ohne Vegan: +14" (ganze Zeile = Button → entfernt Filter + zeigt Treffer); sekundär „Alle Filter zurücksetzen". *error* — „Suche gerade nicht möglich" + Retry.

**Interaktionen:** Suchfeld-Fokus → Overlay ②. Filter-FAB → Sheet ③. Filter UND-verknüpft, kombinierbar, einzeln per ✕ (Pill) entfernbar. Suche + Filter kombinierbar. Sortierung: Relevanz/Neueste/Bewertung/Kochzeit. „Alle Kategorien →" → Kategorie-Übersicht. Kachel-Tap → Rezept-Detail.

**Copy:** „Rezepte" · „Stöbern & Entdecken" · „n Treffer für …" · „Alle Kategorien →" · „Beliebt" · „Zuletzt gesucht" · „Keine Treffer" · „Alle Filter zurücksetzen".

---

## 03 · Rezept-Detail  `[bestehend]` — `screens/rezept-detail.html`

**Zweck / Fluss:** Rezept ansehen, planen (Portionen, Shoppingliste), kochen (Kochmodus). Enthält 5 Zustände: ① Zutaten-Tab · ② Passt-dazu-Tab · ③ Kochmodus Panel Peek · ④ Panel Schritt-Zutaten · ⑤ Panel volle Liste.

**Layout Mobile:** Hero (Foto-Platzhalter, Titel-Overlay + Herz + Zurück-Pill) → Meta-Streifen (Vorbereitung/Kochen/Art/Schwierigkeit) → Autor + Datum (+ Ko-Autor bei Modul-Rezepten) → Tabs → Portionen-Scaler → Zutaten (Haupt- + Modul-Rezept mit grüner Border) → „Zur Shoppingliste" → Zubereitung (Schritte) → Pflanzen-Block → „Passt dazu" (Foto-Kacheln).
**Kochmodus:** helles **Zutaten-Panel unten** zeigt Zutaten NUR für den aktiven Schritt, feste Max-Höhe ~170 px, intern scrollbar. Drei Snap-Zustände: **Peek** (Einzeiler) ↔ **Schritt-Zutaten** (Standard) ↔ **volle Liste** (Sheet). Aktiver Schritt = braune Kachel mit Terrakotta-Klammer + Kreisnummer + Timer.
**Desktop:** zweispaltig — links Zutaten sticky, rechts Zubereitung; Hero volle Breite.

**Komponenten:** Hero, Pill-Buttons, Tabs, Meta-Streifen, Portionen-Scaler, Zutaten-Liste (gruppiert), Schritt-Kachel, Zutaten-Panel (3 Snaps), Pflanzen-Chip, Foto-Kachel (§2.1).

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Titel/Hero | Rezeptname + Bild | „Kürbis-Lasagne" | `[R]` |
| Meta | Vorbereitung/Kochen/Art/Schwierigkeit | „20 min · 45 min · Hauptgericht · mittel" | `[R]` |
| Autor / Ko-Autor | Ersteller + Modul-Rezept-Autor | „Maria" · „Béchamel: Klaus" | `[R]`/`[U]` |
| Ø-Bewertung | Durchschnitt + Anzahl | „4,6 · 213" | `[R]` |
| Portionen | skalierbarer Wert | 4 | `[R]` |
| Zutat | Menge + Einheit + Name, je Schritt zugeordnet | „250 g Mehl" | `[R]` |
| Schritt | Anleitungstext + Timer + Foto | „Teig 30 min ruhen" | `[R]` |
| Pflanzen-Block | Kräuter aus dem Rezept | „Salbei →" | `[N]` (Rezept↔Pflanze-Link) |
| Passt dazu | verwandte Rezepte | Foto-Kacheln | `[R]` |

**States:** *loading* — Hero-Skeleton + Zeilen-Platzhalter. *empty* — keine Bewertungen: „Noch keine Bewertung — sei die/der Erste". *error* — „Rezept konnte nicht geladen werden" + Zurück.

**Interaktionen:** Portionen ± → Mengen live neu berechnen (**Panel & Tab identische Quelle**). Zutat-Tap (Kochmodus) → zugehörige Schritte markieren, nicht-relevante auf 35 % dimmen (Cross-Highlighting, siehe ABWEICHUNGEN.md/offen). Schritt abhaken → durchgestrichen/halbtransparent. Timer-Tap → Countdown. „Zur Shoppingliste" → Übernehmen-Screen. Bearbeiten → Wizard. Pflanze-Tap → Pflanzen-Detail.

**Copy:** „Zutaten · Passt dazu" · „Portionen" · „Zur Shoppingliste" · „Timer starten" · „Kräuter im Rezept".

---

## 04 · Kategorie-Übersicht  `[bestehend]` — `screens/kategorien.html`

**Zweck / Fluss:** Katalog-Einstieg über Kategorien (Foto-Kacheln, gruppiert). Erreichbar aus dem Such-Fokus („Alle Kategorien →").

**Layout Mobile:** Saison-Highlight oben („Jetzt: Grillsaison") → gruppiertes **Foto-Kachel-Grid** (2-spaltig) je Kategorie mit Rezeptanzahl (Kategorie-Farbe §1.3 als Overlay) → Hinweiszeile: Quer-Filter (Vegetarisch/Vegan/Schnell) sind KEINE Kategorien, nur in der Suche.
**Desktop:** 3–4-spaltiges Grid.

**Komponenten:** Saison-Highlight-Banner, Kategorie-Foto-Kachel (Bild + Kategorie-Overlay + Name + Anzahl).

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Saison-Highlight | aktuelle redaktionelle Saison | „Jetzt: Grillsaison" | `[S]` |
| Kategorie-Kachel | Name + Rezeptanzahl | „Suppen · 27" | `[R]` |

**States:** *loading* — Kachel-Skeletons. *empty* — praktisch nie; leere Kategorie „0 · bald mehr". *error* — Retry-Zeile.

**Interaktionen:** Kachel-Tap → Rezepte-Ergebnis-Grid mit vorgesetztem Kategorie-Filter. Saison-Highlight-Tap → passende Ergebnisliste.

**Copy:** „Kategorien" · „Jetzt: {Saison}" · „Vegetarisch, Vegan & Schnell findest du als Filter in der Suche."

---

## 05 · Neues Rezept (Wizard)  `[bestehend]` — `screens/neues-rezept.html`

**Zweck / Fluss:** Rezept erstellen. Einstieg über `+` (Bottom-Nav). 5 Schritte + Vorschau-Screen.

**Layout Mobile:** Header (✕ Schließen + Entwurf-Autosave-Indikator) → **horizontaler Stepper** (antippbar, abgeschlossen ✓) → Schritt-Inhalt → Footer („← Zurück" ab Schritt 2, „Weiter"/„Veröffentlichen").
**Schritte:** 1 Titel (Zähler „51/62" ab ~45 Zeichen, hartes Limit 62) → 2 Zutaten (Freitext, `##`-Gruppen, „+ Teilrezept") → 3 Anordnung (nur bei eingebundenem Teilrezept) → 4 Zubereitung (Schritte + Zutaten-Chips je Schritt + Timer/Foto) → 5 Feinschliff (Pflicht: Zeiten/Portionen/Art/Gang; OPTIONAL-Trenner: Schwierigkeit, Saison-Monatsraster, Fotos).
**Desktop:** Stepper links vertikal, Inhalt rechts.

**Komponenten:** Stepper, Textfelder, Freitext-Zutaten, Zutaten-Chip-Auswahl, Timer/Foto-Feld, Saison-Monatsraster, Autosave-Indikator.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Titel | Rezeptname, Limit 62 Zeichen | „Vollkorn-Haferbrötchen" | `[R]` |
| Titel-Zähler | erscheint ab ~45 Zeichen | „51/62" | `[S]` |
| Zutaten-Zeile | Freitext, eine je Zeile | „2 EL Olivenöl" | `[R]` |
| Schritt-Zutaten-Chip | Auswahl aus Schritt-2-Liste | „Olivenöl" | `[R]` |
| Autosave | Entwurfsstatus | „Entwurf gespeichert · 12:04" | `[N]` |

**States:** *loading* — Entwurf laden. *empty* — Erststart: alle Felder leer, Platzhalter. *error* — Autosave fehlgeschlagen: „Nicht gespeichert — erneut versuchen".

**Interaktionen:** Stepper-Tap = Schnellnavigation. Vorschau-Button (im Feinschliff) → Vorschau-Screen — **dort NIE veröffentlichen**, nur „Zurück zum Bearbeiten". Veröffentlichen ausschließlich im Feinschliff. ✕ → Wizard verlassen (Entwurf bleibt).

**Copy:** „Neues Rezept" · „Titel · Zutaten · Anordnung · Zubereitung · Feinschliff" · „+ Teilrezept hinzufügen" · „Entwurf gespeichert" · „Vorschau" · „Zurück zum Bearbeiten" · „Veröffentlichen".

---

## 06 · Feed / Aktivität  🆕 **neues Feature** — `screens/feed.html`

**Zweck / Fluss:** Aktivität von Gefolgten (neue Rezepte, Bewertungen, Reels). Einstieg = **Feed-Icon im Home-Header**. **Abzugrenzen von der Glocke** (= Reaktionen auf DICH). Footer neutral (kein Tab aktiv).

**Layout Mobile:** Titel „Feed" + Unterzeile „von Menschen, denen du folgst" → chronologische Aktivitätskarten (Autor-Avatar + Aktion + Rezept-/Foto-Vorschau + Zeit + Reaktions-Icons). Empty-State separat.
**Desktop:** zentrierte Spalte, max ~640 px.

**Komponenten:** Aktivitätskarte, RecipeRow (§2.2), Avatar.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Aktivität | gefolgter Nutzer + Aktion | „Anna hat ein Rezept veröffentlicht" | `[N]` |
| Zielobjekt | Rezept/Foto | „Zucchini-Puffer" | `[R]` |
| Zeitstempel | relativ | „vor 2 Std" | `[N]` |

**States:** *loading* — Karten-Skeletons. *empty* — „Dein Feed ist noch leer" + CTA „Menschen entdecken". *error* — Retry.

**Interaktionen:** Karten-Tap → Zielobjekt. Autor-Tap → öffentliches Profil. Reaktion → optimistisch.
> **Backend (neu):** Follow-Graph, Aktivitäts-/Event-Stream, Fan-out. Als Full-Stack einplanen.

**Copy:** „Feed" · „von Menschen, denen du folgst" · „vor {n} Std" · „Dein Feed ist noch leer" · „Menschen entdecken".

---

## 07 · Kräuterschule — Übersicht  🆕 **neues Feature** — `screens/kraeuterschule.html`  · Farbwelt Grün

**Zweck / Fluss:** Enzyklopädie aller essbaren Pflanzen. Einstieg: Suche-Bar + Saisonmodul + Kraut-des-Monats + Kategorie-Reihen.

**Layout Mobile:** grüner Header → Suchleiste → **Saisonmodul „Jetzt im Juli"** (Säen / Ernten) → Kraut des Monats (Hero) → Kategorie-Reihen (Küchenkräuter / Gemüse / Obst / Heil- / Wildkräuter, je horizontal scroll, Pflanzentöne §1.3).
**Desktop:** Suchleiste oben, Kategorie-Reihen als Grid-Sektionen.

**Komponenten:** Suchfeld, Saisonmodul, Kräuter-Hero (§2.5), Pflanzen-Kachel (Foto-Platzhalter).

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Saisonmodul | jetzt zu säen/ernten | „Säen: Radieschen · Ernten: Basilikum" | `[N]` |
| Kraut des Monats | redaktionelle Pflanze | „Basilikum" | `[S]` |
| Pflanzen-Kachel | Name + Kategorie | „Petersilie · Küchenkraut" | `[N]` |

**States:** *loading* — Reihen-Skeletons. *empty* — nie (Katalog gepflegt). *error* — Retry pro Reihe.

**Interaktionen:** Kachel/Hero-Tap → Pflanzen-Detail. Suche → Pflanzen-Ergebnisliste. Saison-Eintrag → Pflanzen-Detail (Anbau-Tab).
> **Backend (neu):** Pflanzen-Stammdaten + Phänologie-DB (Säen/Ernten je Monat/Region), Kategorien, Kraut-des-Monats-Redaktion.

**Copy:** „Kräuterschule" · „Jetzt im Juli" · „Säen · Ernten" · „Kraut des Monats" · „Küchenkräuter · Gemüse · Obst · Heilkräuter · Wildkräuter".

---

## 08 · Pflanzen-Detail  🆕 **neues Feature** — `screens/pflanzendetail.html`  · Farbwelt Grün

**Zweck / Fluss:** Alles zu einer Pflanze. Ziel aus Kräuterschule, Rezept-Detail, Garten.

**Layout Mobile:** grüner Hero (Pflanzenname) → **4 Tabs: Steckbrief · Anbau · Probleme · Rezepte.**
- *Steckbrief:* Mischkultur (gut + meiden), Sorten-Reihe, prominenter **„In mein Beet"-CTA**.
- *Anbau:* Beet-Status-Banner (wenn im Beet) + Phänologie-Timeline (Aussaat→Ernte).
- *Probleme:* Krankheiten/Schädlinge, je Symptom + „Was tun" + **Severity-Badge** (§2.12).
- *Rezepte:* Rezepte mit dieser Pflanze (RecipeRow).
**Desktop:** Tabs als linke Navigation, Inhalt rechts.

**Komponenten:** Hero, Tabs, Mischkultur-Chips, Sorten-Kachel, „In mein Beet"-CTA, Phänologie-Timeline, Problem-Karte + Severity-Badge, RecipeRow (§2.2).

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Name/Hero | Pflanze | „Basilikum" | `[N]` |
| Mischkultur | gute/schlechte Nachbarn | „gut: Tomate · meiden: Melisse" | `[N]` |
| Sorten | verfügbare Sorten | „Genoveser" | `[N]` |
| Phänologie | Aussaat-/Ernte-Fenster | „Aussaat März–Mai" | `[N]` |
| Problem | Krankheit/Schädling + Severity | „Falscher Mehltau · mittel" | `[N]` |
| Rezepte | Rezepte mit Pflanze | RecipeRow | `[R]` |
| Beet-Status-Banner | ob/seit wann im Beet | „In deinem Beet seit 12.05." | `[N]` |

**States:** *loading* — Tab-Skeleton. *empty* — Tab „Rezepte" leer: „Noch keine Rezepte mit Basilikum". *error* — Retry.

**Interaktionen:** Tab-Wechsel. „In mein Beet" → Standort/Datum-Formular (Mein Beet). Mischkultur-Chip → jeweilige Pflanze. Rezept-Tap → Rezept-Detail.
> **Backend (neu):** Pflanzen-Stammdaten, Mischkultur-Matrix, Sorten, Phänologie, Problem-Katalog, Rezept↔Pflanze-Verknüpfung, Beet-Zugehörigkeit.

**Copy:** „Steckbrief · Anbau · Probleme · Rezepte" · „In mein Beet" · „Gute Nachbarn · Meiden" · „Sorten" · „Was tun?" · „In deinem Beet seit {Datum}".

---

## 09 · Fratcher (Kühlschrank-Matching)  🆕 **neues Feature** — `screens/fratcher.html`

**Zweck / Fluss:** „Was kann ich mit dem kochen, was ich habe?" Einstieg Home-Banner + Suche.

**Layout Mobile:** Eingabe (drei Gruppen) → Ergebnisse.
- *Aus deinem Beet* (grüne Chips, auto aus Mein Beet, „Beet verwalten →").
- *Im Kühlschrank* (dunkle Chips, manuell + Quick-Adds).
- *Basics — zählen nicht als fehlend* (graue Chips, „Bearbeiten" → frei definierbar).
Ergebnisse: Rezepte mit **Match-%**, fehlende Zutat → „auf die Einkaufsliste", Hinweis „Basics werden ignoriert".
**Desktop:** Eingabe links, Ergebnisliste rechts.

**Komponenten:** Zutaten-Chip (3 Farbklassen), Quick-Add, RecipeRow + Match-%-Badge.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Beet-Chips | Zutaten aus Mein Beet | „Zucchini" | `[N]` |
| Kühlschrank-Chips | manuelle Vorräte | „Eier, Sahne" | `[N]` |
| Basics | ignorierte Grundzutaten (frei def.) | „Salz, Öl, Mehl" | `[N]` |
| Treffer | Rezept + Match-% + fehlende Zutaten | „Zucchini-Puffer · 85 % · fehlt: Dill" | `[R]` |

**States:** *loading* — Match läuft. *empty* — keine Zutaten erfasst: Onboarding-Hinweis + Quick-Adds. *error* — Retry.

**Interaktionen:** Chip add/remove → Ergebnisse live. „auf die Einkaufsliste" → Shoppingliste. „Beet verwalten" → Mein Beet. „Basics bearbeiten" → Basics-Editor (auch in »Mehr«/Einstellungen).
> **Backend (neu):** Vorrats-/Basics-Modell je Nutzer, Beet↔Vorrat-Verknüpfung, Matching-Algorithmus (Zutat↔Rezept, Basics-Ignore).

**Copy:** „Fratcher" · „Aus deinem Beet · Im Kühlschrank · Basics" · „Basics werden ignoriert" · „auf die Einkaufsliste" · „Beet verwalten →".

---

## 10 · Shoppingliste  🆕 **neues Feature** — `screens/shoppingliste.html`

**Zweck / Fluss:** Eine Einkaufsliste, aus mehreren Quellen gespeist (Rezept, Fratcher, manuell, Sprach-Eingabe).

**Layout Mobile:** Header + **Umschalter „Warengruppe ↔ Nach Rezept"** → Liste (abhakbare Zeilen, Mengen) → Footer mit Mic-Button + „Teilen". **Übernehmen-Screen** (aus Rezept): Vorschau der Zutaten mit Pantry-Hinweisen vor dem Hinzufügen.
**Desktop:** zwei Spalten (Liste + Quellen/Teilen-Panel).

**Komponenten:** Segmented (§2.9), Listenzeile mit Checkbox + Mengen, Hinweis-Chip, Teilen-Sheet (§2.11), Mic-Button.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Zeile | Zutat + summierte Menge | „400 g Tomaten" | `[N]` |
| Herkunfts-Chip | zusammengeführte Rezepte | „2 Rezepte · summiert" | `[N]` |
| Pantry-Hinweis | in Basics / evtl. im Beet | „in deinen Basics" | `[N]` |
| Warengruppe | Sortier-Gruppe | „Gemüse" | `[S]` |

**States:** *loading* — Zeilen-Skeleton. *empty* — „Deine Liste ist leer" + „Aus Rezept / manuell hinzufügen". *error* — Sync-Fehler-Banner.

**Interaktionen:** Umschalter Warengruppe↔Rezept. Abhaken (durchstreichen). Doppelte Zutat → Menge summiert + Hinweis-Chip. Mic → Sprach-Eingabe. **Teilen in Stufen** (Sheet): Schnell (WhatsApp/Text/E-Mail) · App-Sync (Bring!-API) · Gemeinsam nutzen (Live-Mitbearbeiter + öffentlicher Link).
> **Backend (neu):** Listen-Modell, Mengen-Aggregation/Einheiten-Normalisierung, Pantry-Abgleich, Teilen/Live-Collab, Bring!-Integration, Speech-to-Text.
> **Ausgeschlossen:** Kochplan-Verknüpfung (Kalender bleibt getrennt).

**Copy:** „Einkaufsliste" · „Warengruppe · Nach Rezept" · „2 Rezepte · summiert" · „in deinen Basics" · „evtl. in deinem Beet" · „Teilen" · „Schnell · App-Sync · Gemeinsam nutzen".

---

## 11 · Kalender (Saison & Arbeit)  🆕 **neues Feature** — `screens/kalender.html`  · Farbwelt Grün

**Zweck / Fluss:** Garten-Linse. Erreichbar über Garten-Nav (Segment „BEET · KALENDER"). Zwei Ansichten per Header-Toggle `SAISON · ARBEIT`.

**Layout Mobile:**
- *SAISON* (redaktionell): Zutaten-Grid mit Status (Hochsaison/läuft an/endet bald), 12-Monats-Saisonleiste je Zutat, saisonale Rezepte (SAISON-Badge, „nutzt n Zutaten aus deinem Beet"), Link zur Kräuterschule.
- *ARBEIT* (persönlich): Monat/Woche-Untertoggle, Pflanzen-Filter-Chips („Mein Beet", Alle/einzeln), Tagespunkte Aussaat (blau)/Pflanzung (grün)/Ernte (ocker), abhakbare Aufgaben „Diese Woche", Pflanzen-Zeitleisten.
**Desktop:** Kalender-Grid breiter, Aufgabenliste als Seitenspalte.

**Komponenten:** Header-Toggle (§2.9), Saison-Statuskachel, 12-Monats-Leiste, Foto-Kachel (§2.1 season), Filter-Chip, Kalender-Tagespunkt, Aufgaben-Zeile (Checkbox), Pflanzen-Zeitleiste.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Saison-Status | Zutat + Saison-Status | „Kürbis · Hochsaison" | `[N]` |
| Saisonleiste | 12-Monats-Verfügbarkeit | Balken Sep–Nov | `[N]` |
| Saison-Rezept | Rezept + Beet-Bezug | „nutzt 3 Zutaten aus deinem Beet" | `[R]`+`[N]` |
| Tagespunkt | Aussaat/Pflanzung/Ernte-Termin | blau 14. | `[N]` |
| Aufgabe | Gartenarbeit diese Woche | „Basilikum pikieren" | `[N]` |

**States:** *loading* — Grid/Aufgaben-Skeleton. *empty (ARBEIT)* — leeres Beet: „Füge Pflanzen zu deinem Beet hinzu, um Aufgaben zu sehen" → Mein Beet. *error* — Retry.

**Interaktionen:** Toggle SAISON↔ARBEIT. Untertoggle Monat/Woche. Filter-Chips. Aufgabe abhaken. Saison-Zutat/Rezept-Tap → Detail. Link → Kräuterschule.
> **Backend (neu):** Saison-DB (Zutat/Monat/Region), Phänologie→Aufgaben-Generator (aus Mein Beet), Aufgaben-Status je Nutzer.
> **Ausgeschlossen:** Kochplan, Shoppingliste-Verknüpfung, Tag-Ansicht.

**Copy:** „Kalender" · „SAISON · ARBEIT" · „Monat · Woche" · „Mein Beet" · „Diese Woche" · „Hochsaison · läuft an · endet bald" · „nutzt {n} Zutaten aus deinem Beet".

---

## 12 · Mein Beet  🆕 **neues Feature** — `screens/mein-beet.html`  · Farbwelt Grün

**Zweck / Fluss:** Garten-Hub. Persönliche Pflanzenverwaltung; Quelle für Kalender-Aufgaben & Pflanzen-Timeline. Bottom-Nav „Garten" (Segment „BEET · KALENDER").

**Layout Mobile:** Segment-Header → Beet-Liste **nach Standort gruppiert** (Hochbeet/Balkon-Topf/Freiland/Fensterbank), je Eintrag Phase-Badge (Aussaat/Wächst/Ernte) → „+ Pflanze hinzufügen".
**Nebenscreens:** Empty-State · Pflanze suchen · Standort/Datum-Formular.
**Desktop:** Standort-Gruppen als Spalten/Karten-Raster.

**Komponenten:** Segmented (§2.9), Garten-Karte (§2.6), Phase-Badge, Suchfeld, Standort/Datum-Formular.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Beet-Eintrag | Art + Pflanzdatum + Standort + Menge | „Tomate · 12.05. · Hochbeet · 3" | `[N]` |
| Phase-Badge | aktuelle Phase (aus Phänologie) | „Wächst" | `[N]` |
| Standort-Gruppe | Gruppierung | „Balkon-Topf" | `[N]` |

**States:** *loading* — Listen-Skeleton. *empty* — Empty-State „Was wächst bei dir?" + „Pflanze hinzufügen". *error* — Retry.

**Interaktionen:** „+ Beet" (Suche → Pflanze → Standort/Datum). Von PDP „In mein Beet". Im Onboarding „was wächst bei dir?". Eintrag-Tap → Pflanzen-Detail. Beet ↔ Vorrat/Fratcher verknüpft, aber getrennt pflegbar.
> **Backend (neu):** Beet-Einträge je Nutzer (Art, Datum, Standort, Menge), Phase-Berechnung aus Phänologie, Verknüpfung zu Fratcher/Kalender.
> **Offen:** Onboarding-Screen selbst; „eigene Pflanze" (ohne Auto-Aufgaben).

**Copy:** „Mein Beet" · „BEET · KALENDER" · „Was wächst bei dir?" · „Pflanze hinzufügen" · „Hochbeet · Balkon-Topf · Freiland · Fensterbank" · „Aussaat · Wächst · Ernte".

---

## 13 · Profil (eigen)  `[bestehend, erweitert]` — `screens/profil-eigen.html`

**Zweck / Fluss:** Eigenes Profil verwalten. Erreichbar über »Mehr« / Avatar (kein eigener Nav-Slot).

**Layout Mobile:** Kopf (Identität + Social-Chips + **antippbare Stats**) → 2 Tabs: **MEINE REZEPTE** (Segment Veröffentlicht/Entwürfe) · **GESPEICHERT** (Favoriten + eigene Sammlungen).
**Desktop:** Kopf breit, Tabs darunter, Rezepte im Grid.

**Komponenten:** Profil-Kopf, Social-Chip, Stat-Zähler (Button), Tabs, Segmented (§2.9), Foto-Kachel/RecipeRow.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Identität | Name + Avatar + Bio | „Maria" | `[U]` |
| Social-Chips | verknüpfte Konten | Instagram, TikTok | `[N]` |
| Stats | Rezepte / Follower / Folge-ich | „24 · 312 · 88" | `[N]` |
| Meine Rezepte | veröffentlicht/Entwürfe | Foto-Kachel | `[R]` |
| Gespeichert | Favoriten + Sammlungen | „Sommer 2026" | `[N]` |

**States:** *loading* — Skeleton Kopf + Grid. *empty* — keine Rezepte: „Erstelle dein erstes Rezept". *error* — Retry.

**Interaktionen:** Stat-Tap → Follower-/Folge-ich-Liste (Netzwerk kein eigener Tab). Segment Veröffentlicht/Entwürfe. Sammlung-Tap → Sammlungs-Detail. Einstellungen → Social-Integration, Basics, Freigaben.
> **Backend:** Follower-Graph `[N]`, Sammlungen `[N]`, Social-Verknüpfung `[N]`; Rezepte/Favoriten `[R]`.
> **Offen:** Netzwerk-Liste + Sammlungs-Detail-Screen.

**Copy:** „Meine Rezepte · Gespeichert" · „Veröffentlicht · Entwürfe" · „Follower · Folge ich" · „Erstelle dein erstes Rezept".

---

## 14 · Social-Integration (Instagram / TikTok)  🆕 **neues Feature** — `screens/social-integration.html`

**Zweck / Fluss:** Eigene Insta-/TikTok-Beiträge verbinden, auswählen und mit PiEngines-Rezepten verknüpfen. Aus »Mehr« → Einstellungen.

**Layout Mobile (3 Screens):** 1) *Konto verbinden* (OAuth-Hinweis; Insta verbunden / TikTok nicht verbunden) → 2) *Beiträge auswählen* (Grid mit Auswahl-Häkchen, Insta/TikTok-Toggle) → 3) *Beitrag ↔ Rezept verknüpfen* (Reel bekommt „Rezept ansehen").
**Desktop:** zweispaltig (Beitrags-Grid links, Verknüpfungs-Panel rechts).

**Komponenten:** OAuth-Verbinden-Karte, Plattform-Toggle, Beitrags-Grid mit Auswahl, Verknüpfungs-Panel, „Rezept ansehen"-Button.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Konto-Status | verbunden/nicht | „Instagram · verbunden" | `[N]` |
| Beitrag | eigenes Foto/Reel | Thumbnail | `[N]` |
| Verknüpfung | Beitrag → Rezept | „Reel → Zucchini-Puffer" | `[N]` |

**States:** *loading* — Beiträge laden (nach OAuth). *empty* — nicht verbunden: Verbinden-CTA; verbunden ohne Beiträge: „Keine Beiträge gefunden". *error* — „Verbindung fehlgeschlagen — erneut anmelden".

**Interaktionen:** Verbinden → OAuth-Flow. Beitrag auswählen/anpinnen. Verknüpfen → Rezept-Picker. „Rezept ansehen" lebt in PiEngines (eingebettetes Reel + eigener Button), **nicht** im nativen Reel.

> **API-Grenzen (Konzept, für Roadmap):**
> - **Instagram**: nur Graph API, nur **Business-/Creator-Konten** (persönliche Konten kein API-Zugriff → User muss auf „Professional" umstellen). Eigene Beiträge lesen (Fotos/Videos/Reels) geht. Publishing nur für Business/Creator; Setup = FB-Business-Konto + FB-Seite + IG-Professional + Meta-Developer-App + genehmigte Publish-Berechtigung + App-Review (~2–4 Wochen). **Fremde Profile NICHT abgreifbar.**
> - **TikTok**: Login Kit + Display API + Content-Posting API, OAuth je Konto, App-Audit nötig (bis bestanden alle Inhalte „privat"; strenge UX-Vorgaben beim Posten).
> - **Phase 1** (Auswählen/Anpinnen/Verknüpfen) machbar. **Phase 2** Crossposting: geparkt (Professional-Konto-Pflicht + Review-Aufwand).
> - **Konsequenz:** „Rezept ansehen" nicht ins native Reel injizierbar → lebt in PiEngines. FOTOS-Tab im öffentlichen Profil funktioniert nur für Creator, die ihr Konto selbst verbunden haben.

**Copy:** „Social verbinden" · „Instagram · TikTok" · „verbunden / nicht verbunden" · „Beiträge auswählen" · „Mit Rezept verknüpfen" · „Rezept ansehen".

---

## 15 · Profil (öffentlich)  `[bestehend, erweitert]` — `screens/profil-oeffentlich.html`

**Zweck / Fluss:** Profil eines anderen Nutzers. Aus Autor-/Avatar-Tap überall. Footer neutral (kein Tab aktiv).

**Layout Mobile:** Kopf (Identität + Social-Chips + antippbare Stats, **kein Titelbild-Balken**) → Folgen/Gefolgt-Button (+ Benachrichtigungs-Glocke bei Gefolgt) → Tabs: **REZEPTE** (Grid) · **FOTOS** (Social-Cross-Posts).
**Desktop:** analog eigenem Profil, ohne Bearbeiten-Funktionen.

**Komponenten:** Profil-Kopf, Social-Chip, Stat-Button, Folgen-Button (2 Zustände), Glocke, Tabs, Foto-Kachel, Foto-Grid.

**Dynamische Inhalte:**
| Element | Semantik | Beispiel | Typ |
|---|---|---|---|
| Identität | fremder Nutzer | „Klaus" | `[U]` |
| Folge-Zustand | folge ich / nicht | „Gefolgt" | `[N]` |
| Rezepte | veröffentlichte Rezepte | Grid | `[R]` |
| Fotos | Social-Cross-Posts (nur wenn Konto verbunden) | Reel-Thumbnail | `[N]` |

**States:** *loading* — Skeleton. *empty* — keine Rezepte: „{Name} hat noch keine Rezepte veröffentlicht"; FOTOS leer/nicht verbunden: Tab ausgeblendet. *error* — Retry.

**Interaktionen:** Folgen/Entfolgen (optimistisch). Glocke → Benachrichtigungen für diesen Nutzer aktivieren. Stat-Tap → Netzwerk-Liste. Rezept-/Foto-Tap → Detail.
> **Backend:** Follow-Aktion `[N]`, öffentliche Rezepte `[R]`, Social-Fotos nur bei eigener Verbindung des Creators `[N]`.

**Copy:** „Folgen · Gefolgt" · „Rezepte · Fotos" · „{Name} hat noch keine Rezepte veröffentlicht".

---

# §5 · Neue Features — Backend-Übersicht (Roadmap-Phasierung)

Alle 🆕-Flächen sind **Full-Stack** (Backend + UI), kein reines Restyling.

| Feature | Kern-Datenbedarf (neu) | Flächen |
|---|---|---|
| **Stories / Feed** | Follow-Graph, Aktivitäts-/Event-Stream, Fan-out, Stories (24 h) | 01, 06 |
| **Kräuterschule** | Pflanzen-Stammdaten, Kategorien, Mischkultur-Matrix, Sorten, Problem-Katalog, Rezept↔Pflanze | 07, 08 |
| **Garten (Mein Beet + Kalender)** | Beet-Einträge je Nutzer, Phänologie-DB, Phase-/Aufgaben-Generator, Saison-DB | 11, 12 |
| **Fratcher** | Vorrats-/Basics-Modell, Beet↔Vorrat-Link, Matching-Algorithmus | 09 |
| **Shoppingliste** | Listen-Modell, Mengen-Aggregation, Pantry-Abgleich, Live-Collab, Bring!/STT | 10 |
| **Social-Integration** | OAuth (Meta Graph, TikTok), Beitrags-Import, Beitrag↔Rezept-Link | 13, 14, 15 |
| **Netzwerk / Sammlungen** | Follower-Listen, benutzerdef. Sammlungen | 06, 13, 15 |

**Restpunkte / offen:** Onboarding-Screen („was wächst bei dir?"), Netzwerk-Liste, Sammlungs-Detail-Screen, Freigaben-Einstieg im Rezept-Detail sichtbar machen, „eigene Pflanze" (ohne Auto-Aufgaben), Social-Phase-2-Crossposting, Cross-Highlighting-Discoverability im Kochmodus. Details in `ABWEICHUNGEN.md`.
