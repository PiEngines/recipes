"""oEmbed-Abruf fuer externe Beitraege (F3b-1 · Commit 1).

Der Abruf passiert bewusst **serverseitig**: das umgeht CORS, haelt Timeout und
Fehlerbehandlung an einer Stelle und liefert dem Frontend eine einheitliche
Antwortform, egal wie unterschiedlich die Plattform-APIs antworten.

Endpunkte — beide **ohne Token**:
  Instagram: GET graph.facebook.com/v25.0/instagram_oembed?url=…
  TikTok:    GET www.tiktok.com/oembed?url=…

Zur Token-Frage: Meta hatte 2020 eine Token-Pflicht fuer die oEmbed-Endpunkte
eingefuehrt und diese am 15.06.2026 wieder zurueckgenommen — inklusive App
Review. Dieses Modul braucht deshalb keinerlei App-Credentials. Sollte Meta das
erneut drehen, ist die Stelle hier lokalisiert: ein `access_token`-Param in
`_params_fuer`.

Instagram liefert per oEmbed **keine** Caption — `caption_text` bleibt dort
`None` und wird ausschliesslich manuell nachgetragen (Commit 2). TikTok legt die
Caption in `title` ab.

Kein Scraping: ausschliesslich die offiziellen oEmbed-Endpunkte.
"""
import logging
from dataclasses import dataclass

import httpx

from app.models import ExternalPlatform

logger = logging.getLogger(__name__)

_TIMEOUT = 5.0

_ENDPOINTS: dict[ExternalPlatform, str] = {
    ExternalPlatform.instagram: "https://graph.facebook.com/v25.0/instagram_oembed",
    ExternalPlatform.tiktok: "https://www.tiktok.com/oembed",
}

# Spaltenbreiten aus `ExternalPost` — eine fremde Antwort darf niemals einen
# DB-Fehler ausloesen, deshalb wird hier gekappt statt dort zu scheitern.
_MAX_THUMBNAIL = 1000
_MAX_AUTHOR = 255


class OEmbedError(RuntimeError):
    """Abruf fehlgeschlagen: Netzwerk, Timeout, Nicht-200 oder kaputtes JSON."""


@dataclass(frozen=True)
class OEmbedResult:
    """Plattform-neutrales Ergebnis eines oEmbed-Abrufs."""

    html: str | None = None
    thumbnail_url: str | None = None
    author_name: str | None = None
    caption_text: str | None = None


def _gekuerzt(wert: object, limit: int) -> str | None:
    """Fremde Strings auf Spaltenbreite kappen; alles andere verwerfen."""
    if not isinstance(wert, str):
        return None
    return wert.strip()[:limit] or None


def _params_fuer(platform: ExternalPlatform, url: str) -> dict[str, str]:
    params = {"url": url}
    if platform is ExternalPlatform.instagram:
        # Das Embed-Skript laedt das Frontend selbst und genau einmal. Ein per
        # innerHTML eingefuegtes <script> wuerde vom Browser ohnehin nicht
        # ausgefuehrt — der Tag im HTML waere also nur totes Gewicht.
        params["omitscript"] = "true"
    return params


def fetch_oembed(platform: ExternalPlatform | str, url: str) -> OEmbedResult:
    """oEmbed-Daten eines Beitrags holen.

    Bewusst synchron (`httpx.Client`, nicht `AsyncClient`): die Route-Handler in
    diesem Projekt sind synchron und laufen damit im Threadpool — der Event-Loop
    wird also nicht blockiert. Ein `AsyncClient` in einem `def`-Handler ginge
    ohne eigenen Loop gar nicht.

    Raises:
        OEmbedError: bei jedem Fehlschlag; der Aufrufer entscheidet, ob das
            hart (Preview) oder weich (Enrichment beim Speichern) wirkt.
    """
    platform = ExternalPlatform(platform)

    try:
        with httpx.Client(timeout=_TIMEOUT, follow_redirects=True) as client:
            response = client.get(_ENDPOINTS[platform], params=_params_fuer(platform, url))
        response.raise_for_status()
        daten = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        # ValueError deckt auch json.JSONDecodeError ab (Subklasse).
        logger.warning("oEmbed fetch failed for %s (%s): %s", url, platform.value, exc)
        raise OEmbedError(str(exc)) from exc

    if not isinstance(daten, dict):
        raise OEmbedError("Unerwartete oEmbed-Antwort")

    return OEmbedResult(
        html=daten.get("html") or None,
        thumbnail_url=_gekuerzt(daten.get("thumbnail_url"), _MAX_THUMBNAIL),
        author_name=_gekuerzt(daten.get("author_name"), _MAX_AUTHOR),
        # Nur TikTok liefert die Caption (im Feld `title`). Instagram nicht —
        # dort bleibt sie None und kommt manuell nach.
        caption_text=(
            _gekuerzt(daten.get("title"), 10_000)
            if platform is ExternalPlatform.tiktok
            else None
        ),
    )
