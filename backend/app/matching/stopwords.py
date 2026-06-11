"""German kitchen-language stopwords for the unmatched-step-token scanner.

Tokens in this set never become step-suggestion candidates, even if they
happen to fuzzy-match a BLS entry. The set is intentionally broad and meant
to be extended over time as new false positives are discovered during review.
"""

# Common cooking verbs (infinitive, conjugated and participle forms)
VERBS = {
    "kochen", "kocht", "gekocht",
    "braten", "brät", "gebraten", "anbraten", "andünsten",
    "backen", "bäckt", "gebacken",
    "schneiden", "schneidet", "geschnitten", "klein",
    "rühren", "rührt", "gerührt", "verrühren", "unterrühren", "umrühren",
    "geben", "gibt", "gegeben", "dazugeben", "hinzugeben", "zugeben", "beigeben",
    "mischen", "mischt", "gemischt", "vermischen", "vermengen",
    "abschmecken", "würzen", "gewürzt",
    "schälen", "geschält",
    "hacken", "gehackt",
    "rösten", "geröstet", "anrösten",
    "dünsten", "gedünstet",
    "garen", "gegart",
    "abkühlen", "erhitzen", "erwärmen",
    "pürieren", "püriert",
    "abgießen", "abtropfen", "abseihen",
    "servieren", "anrichten", "garnieren",
    "legen", "stellen", "lassen",
    "entfernen", "halbieren", "vierteln", "würfeln", "raspeln", "reiben",
    "pressen", "auspressen",
    "kneten", "ausrollen", "formen",
    "wenden", "umdrehen",
    "abdecken", "zudecken",
    "ziehen", "ruhen",
    "waschen", "abspülen", "trocknen",
    "vorbereiten", "verteilen", "abdrehen", "aufkochen", "einrühren",
}

ADVERBS = {
    "dann", "danach", "anschließend", "zunächst", "zuerst", "zuletzt",
    "etwas", "wenig", "viel", "mehr", "weniger",
    "kurz", "lange", "langsam", "schnell",
    "gut", "leicht", "fein", "grob",
    "vorsichtig", "gleichmäßig", "regelmäßig",
    "nun", "noch", "bereits", "schon", "wieder", "erneut",
    "ggf", "evtl", "eventuell", "bedarf",
    "ca", "circa", "etwa", "ungefähr",
    "sofort", "direkt", "anfangs",
    "insgesamt", "gesamt", "restliche", "rest", "übrige",
    "weiter", "weiteren",
}

# Measurement units (recipe convention)
UNITS = {
    "g", "kg", "mg", "ml", "l", "el", "tl", "prise", "prisen",
    "stück", "stk", "stange", "stangen", "scheibe", "scheiben",
    "bund", "zehe", "zehen", "blatt", "blätter", "dose", "dosen",
    "packung", "päckchen", "tasse", "tassen", "becher", "glas", "gläser",
    "msp", "messerspitze", "handvoll", "esslöffel", "teelöffel",
    "liter", "gramm", "kilogramm", "milliliter",
}

NUMBER_WORDS = {
    "ein", "eine", "einen", "einem", "einer", "eines",
    "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn",
    "erste", "zweite", "dritte", "letzte", "halbe", "halber", "halben", "halbes",
    "paar",
}

# General-purpose function/connector words
MISC = {
    "und", "oder", "mit", "ohne", "für", "die", "der", "das", "den", "dem",
    "des", "auf", "auch", "dabei", "darin", "davon", "dazu", "damit",
    "zur", "zum", "von", "vom", "ins", "im", "am", "an", "über", "unter",
    "nach", "vor", "bis", "wird", "werden", "wurde", "sind", "ist", "war",
    "haben", "hat", "alle", "alles", "jede", "jeden", "jeder", "jedes",
    "bei", "wie", "als", "sie", "man", "diese", "dieser", "dieses",
}

STOPWORDS: set[str] = VERBS | ADVERBS | UNITS | NUMBER_WORDS | MISC


def is_stopword(token: str) -> bool:
    """True if the token should be ignored entirely (stopword or pure number)."""
    if token in STOPWORDS:
        return True
    if token.isdigit():
        return True
    return False


def add_stopwords(*words: str) -> None:
    """Extend the stopword set at runtime."""
    STOPWORDS.update(w.lower() for w in words)
