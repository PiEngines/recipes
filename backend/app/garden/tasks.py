"""Ableitung der Beet-Aufgaben (F2a/G1).

Es wird kein Aufgaben-Content angelegt: Aufgaben ergeben sich aus dem
Pflanzenkalender (`plant_calendar`) einer Beet-Pflanze. Persistiert wird nur
der Erledigt-Vermerk (`user_plant_task_done`).

Reine Funktionen ohne DB-/Request-Bezug — direkt testbar.
"""

# ── Klassifikation ───────────────────────────────────────────────────────────

# „Blüte" ist in den Daten ein Blühzeit-Vermerk (Hinweistexte wie „Jul–Aug",
# „Holunderblüte"), keine Handlungsanweisung — erscheint deshalb als Status,
# nicht als abhakbare Aufgabe (Lead-entschieden).
STATUS_ONLY_ACTIVITIES = {"Blüte"}

# Aktivitäten, die den blauen AUSSAAT-Badge auslösen (wie die Timeline-Zeile
# „Aussaat" im Pflanzen-Detail).
SAAT_ACTIVITIES = {"Aussaat", "Direktsaat", "Vorkultur"}

BADGE_AUSSAAT = "aussaat"
BADGE_WAECHST = "waechst"
BADGE_ERNTE = "ernte"

_UMLAUT = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})


def slugify_activity(text: str) -> str:
    """„Teilung/Vermehrung" → „teilung-vermehrung", „Rückschnitt" → „rueckschnitt"."""
    s = (text or "").lower().translate(_UMLAUT)
    out = []
    for ch in s:
        out.append(ch if ch.isalnum() else "-")
    return "-".join(part for part in "".join(out).split("-") if part)


def task_key_for(aktivitaet: str, phase_von, phase_bis) -> str:
    """Stabile Kennung aus Aktivität + Phasenfenster.

    Das Phasenfenster gehört dazu, weil dieselbe Aktivität bei einer Pflanze
    mehrfach mit verschiedenen Fenstern vorkommen kann (z. B. zwei Erntezeiten).
    """
    base = slugify_activity(aktivitaet)
    if phase_von is None or phase_bis is None:
        return base
    return f"{base}-p{phase_von}-p{phase_bis}"


def months_for_entry(phase_von, phase_bis, laufend, phase_map) -> set[int]:
    """Monate (1..12), die ein Kalender-Eintrag über seine Phänophasen abdeckt.

    `phase_map`: phase_id → Objekt/Dict mit ref_monat_von / ref_monat_bis.
    Spannen dürfen über den Jahreswechsel laufen (Phase 10 „Winter": 12 → 1).
    Einträge ohne Phasen gelten nur als ganzjährig, wenn `laufend` gesetzt ist.
    """
    if phase_von is None or phase_bis is None:
        return set(range(1, 13)) if laufend else set()

    def _ref(phase_id, attr):
        row = phase_map.get(phase_id)
        if row is None:
            return None
        return row[attr] if isinstance(row, dict) else getattr(row, attr, None)

    von = _ref(phase_von, "ref_monat_von")
    bis = _ref(phase_bis, "ref_monat_bis")
    if von is None or bis is None:
        return set()

    months = set()
    m = von
    for _ in range(12):
        months.add(m)
        if m == bis:
            break
        m = 1 if m == 12 else m + 1
    return months


def is_actionable(aktivitaet: str, laufend: bool) -> bool:
    """Abhakbar = diskretes Zeitfenster und echte Handlung.

    Laufende Tätigkeiten („täglich ernten", Pflege allgemein, Düngung) und
    reine Zustandsvermerke (Blüte) sind Status, keine Aufgaben.
    """
    if aktivitaet in STATUS_ONLY_ACTIVITIES:
        return False
    return not laufend


def phase_badge(entries, monat: int, phase_map) -> str:
    """Phasen-Badge einer Beet-Pflanze für den angegebenen Monat.

    Priorität ERNTE > AUSSAAT > WÄCHST. „Wächst" ist der Ruhezustand zwischen
    Pflanzung und Ernte, wenn im Monat nichts Kennzeichnendes ansteht.
    """
    hat_ernte = False
    hat_saat = False
    for e in entries:
        aktivitaet = e["aktivitaet"] if isinstance(e, dict) else e.aktivitaet
        if aktivitaet != "Ernte" and aktivitaet not in SAAT_ACTIVITIES:
            continue
        months = months_for_entry(
            e["phase_von"] if isinstance(e, dict) else e.phase_von,
            e["phase_bis"] if isinstance(e, dict) else e.phase_bis,
            e["laufend"] if isinstance(e, dict) else e.laufend,
            phase_map,
        )
        if monat not in months:
            continue
        if aktivitaet == "Ernte":
            hat_ernte = True
        else:
            hat_saat = True

    if hat_ernte:
        return BADGE_ERNTE
    if hat_saat:
        return BADGE_AUSSAAT
    return BADGE_WAECHST


def phase_name(phase_id, phase_map):
    """Phasenname aus der Referenztabelle — `plant_calendar` führt nur IDs."""
    row = phase_map.get(phase_id)
    if row is None:
        return None
    return row["phase_name"] if isinstance(row, dict) else getattr(row, "phase_name", None)


def derive_entries(entries, monat: int, phase_map):
    """Kalender-Einträge einer Pflanze → im Monat fällige Aufgaben/Status.

    Liefert Dicts mit `task_key`, `aktivitaet`, `hinweis`, `laufend`,
    `actionable` und den aufgelösten Phasennamen.
    Reihenfolge: Aufgaben vor Status, darin alphabetisch nach Aktivität.
    """
    result = []
    for e in entries:
        get = (lambda k: e[k]) if isinstance(e, dict) else (lambda k: getattr(e, k, None))
        aktivitaet = get("aktivitaet")
        laufend = bool(get("laufend"))
        phase_von, phase_bis = get("phase_von"), get("phase_bis")
        months = months_for_entry(phase_von, phase_bis, laufend, phase_map)
        if monat not in months:
            continue
        result.append({
            "task_key": task_key_for(aktivitaet, phase_von, phase_bis),
            "aktivitaet": aktivitaet,
            "hinweis": get("hinweis") or None,
            "laufend": laufend,
            "actionable": is_actionable(aktivitaet, laufend),
            "phase_von_name": phase_name(phase_von, phase_map),
            "phase_bis_name": phase_name(phase_bis, phase_map),
        })

    result.sort(key=lambda t: (not t["actionable"], t["aktivitaet"]))
    return result
