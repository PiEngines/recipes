# PiEngines — Handover-Paket v2 (Wahl 2.0)

Für den Lead, um die Umsetzungs-Handover an die Entwicklung zu schreiben — ohne Rückfragen.

**Stand:** 18.07.2026 · **Quelle:** `PiEngines FINAL.dc.html` (maßgebliche Auslieferungs-Canvas)

## Inhalt
```
design_handoff_piengines_v2/
├── README.md          ← dieses Dokument
├── SPEC.md            ← vollständige Spezifikation (Deckblatt, Tokens, Komponenten, IA, je Fläche, Backend)
├── ABWEICHUNGEN.md    ← alle bewussten Abweichungen (inkl. vom Lead angeordnete) + offene/inkonsistente Punkte
└── screens/           ← 16 self-contained HTML-Dateien (inline CSS/SVG, rendern offline)
    ├── home.html                  (01)
    ├── rezepte.html               (02)  Browse-Grid + Such-Fokus + Filter + Ergebnis + Keine-Treffer
    ├── rezept-detail.html         (03)  Zutaten · Passt-dazu · Kochmodus (3 Panel-Zustände)
    ├── kategorien.html            (04)
    ├── neues-rezept.html          (05)  5-Schritte-Wizard + Vorschau
    ├── feed.html                  (06)  🆕
    ├── kraeuterschule.html        (07)  🆕  Grün
    ├── pflanzendetail.html        (08)  🆕  Grün
    ├── fratcher.html              (09)  🆕
    ├── shoppingliste.html         (10)  🆕
    ├── kalender.html              (11)  🆕  Grün
    ├── mein-beet.html             (12)  🆕  Grün
    ├── profil-eigen.html          (13)
    ├── social-integration.html    (14)  🆕
    ├── profil-oeffentlich.html    (15)
    └── farbkonzept.html           (S)   System-Referenz: ein Farbwert je Kategorie
```

## So liest du das Paket
1. **`ABWEICHUNGEN.md` zuerst** — was weicht bewusst vom Brief ab (u. a. Bottom-Nav Home/Rezepte/Neu/Garten/**Mehr** statt …/Profil; nur Mobile-HTML; kein Auth; kein Story-Viewer), plus bekannte Prototyp-Inkonsistenzen.
2. **`SPEC.md` ist die Quelle der Wahrheit.** Deckblatt (Flächenliste) → §1 Tokens (inkl. Kategorie-Palette + 2 Farbwelten) → §2 Komponenten → §3 Navigation/IA → §4 Flächen (je: Zweck, Layout Mobile/Desktop + Breakpoints, Komponenten, dynamische Inhalte, States, Interaktionen, Copy) → §5 Backend-Übersicht neuer Features.
3. **`screens/*.html`** sind die visuellen Referenzen. Doppelklick öffnet sie offline. Ein File zeigt oft mehrere Zustände einer Fläche nebeneinander.

## Wichtig
- **Fidelity: Hi-Fi.** Finale Farben, Typo, Spacing, Copy — pixelgenau nachzubauen.
- Prototypen sind **mobile-first** (390 px). Desktop/Tablet je Fläche in SPEC.md §4 als responsive Erweiterung (Breakpoints: Mobile < 768 · Tablet 768–1024 · Desktop > 1024). **Bewusst kein Desktop-HTML** (siehe ABWEICHUNGEN.md A2).
- **Datentyp-Legende:** `[R]` Rezept-Datum · `[U]` Nutzer-Datum · `[N]` neues Konzept (Backend neu) · `[S]` statisch/redaktionell. Endpoint-Mapping macht der Lead.
- **Neue Features** (🆕) sind **Full-Stack** einzuplanen — Backend-Datenbedarf je Fläche und gesammelt in §5.

## Design-System
„Oma Hildes Dorfladen" — Ausbaustufe **Wahl 2.0**: Creme-Basis, zwei Farbwelten (Braun = Rezepte/Konto, Grün = Garten/Pflanzen), Terrakotta-Akzent, Foto-Kacheln mit Titel-auf-Bild, Lora/DM-Sans/DM-Mono, charakteristische Holzkante an Karten. Details in SPEC.md §1–§2.
