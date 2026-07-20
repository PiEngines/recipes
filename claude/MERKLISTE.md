# MERKLISTE — Backend-/Content-Tickets

Stand: 20.07.2026 · Basis `main @ 33686d3` · Ablage: `claude/MERKLISTE.md`
Zweck: nachzuziehende Tickets außerhalb des laufenden Scopes — dürfen nicht verloren gehen.

## A · Content-Lücken Kräuterschule (durch Platzhalter überbrückt, blockieren F1 nicht)

1. **Beschreibungstexte je Pflanze (279)** — `beschreibungstext` = 0/279. F1 rendert Lorem-Fallback bei leerem Feld (UI, nicht DB). Nachziehen: echte Texte importieren → Fallback greift automatisch nicht mehr.
2. **Pflanzenbilder** — `bild_dateiname` referenziert, 0 Dateien. F1 zeigt ein gebündeltes Platzhalter-SVG für alle. Nachziehen: echte Bilder + Storage/Serving; dann `bild_dateiname` nutzen (dabei responsive Varianten/`srcset` erwägen).
3. **`redaktion_freigegeben`-Freigabe** — 0/279 freigegeben; aktuell egal, da `can_view_unreleased()` für alle `True` (Gate = No-op). SOBALD das Gate scharf gestellt wird (Abo/Rollen), müssen Pflanzen freigeschaltet werden (Endpoint `PATCH /api/plants/{slug}/release` existiert bereits), sonst wird die öffentliche Liste leer. **Kopplung: dieses Ticket zusammen mit jeder Verschärfung von `can_view_unreleased` ziehen.**
4. **Echte Rezept↔Pflanze-Verknüpfungen** — der Rezepte-Tab ist derzeit bei jeder Pflanze leer, weil in prod praktisch keine echten Rezepte mit gemappten Zutaten existieren. Sobald Rezepte da sind, greift `GET /api/plants/{slug}/recipes`. Kein Code-Fehler — Datenlücke.

## B · Feature-Nachzügler Kräuterschule (Design gefordert, kein Modell)

5. **Probleme-Tab** — Krankheiten/Schädlinge/Störungen + **Severity** + Gegenmaßnahme. Kein Modell/Content/Endpoint. Full-Stack neu. ⚠️ sicherheitssensibel bei Giftpflanzen. In F1 dokumentiert weggelassen.
6. **Sorten** — Modell + Content + Endpoint + UI-Sektion. In F1 weggelassen.
7. **„Alle →" je Kräuterschule-Regal** — aktuell Anzahl-Badge statt Link; braucht ein Ziel (gefilterte Vollansicht der Gruppe).

## C · Bestehende Backend-Tickets (Rezepte/Social)

8. **`seasonal_tags` in `RecipeListItem`** → SAISON-Badge (Rezepte ④) + Saison-Filtergruppe.
9. **Zeit-Feld in `RecipeMatchItem`** → Pflanzen-Rezepte-Zeile zeigt derzeit nur Art · Autor (kein „10 Min."). Additive Schema-Erweiterung.
10. **Follow-Graph** (Modell + Endpoints) → F3.
11. **Collections-Router** (Modelle da, keine API) → F3.
12. **`bio`-Feld am User** → F3.
13. **Draft-Status** (`RecipeStatus` nur `published`) → F3.
14. **Home-„Kraut der Woche" ablösen** — aktuell hartkodiert („Liebstöckel" in `Home.jsx`); via bestehende Spotlight-Mechanik (Periode = Woche) ersetzbar.
15. **Fratcher-Match-Endpoint** `POST /api/fratcher/match` (Perf: aktuell bis zu 50 Einzel-`GET /api/recipes/{id}` client-seitig).
16. **`--warn`-Token** für Timer-`<30s`-Urgency (aktuell `#C8602A`-Literal in `TimerWidgetGlobal.jsx`).
17. **Optionaler Danger-Literal-Sweep** über restliche Screens (`--danger` existiert).
18. **Alt-Ticket:** Saison-Tagging-Bug `app/seasonal/matcher.py` (`json.loads` bei leerem Text, non-fatal).
