"""Integritätstests der Alembic-Kette.

Dialektunabhängig — fängt die Fehler, die beim Anlegen neuer Revisionen
tatsächlich passieren: doppelte Köpfe, Verzweigungen, fehlende `downgrade()`.
Das echte Ausführen gegen Postgres bleibt Sache des Deploys/der Verifikation.
"""
import os

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Revisionen mit bewusst leerem `downgrade()`, jeweils mit Begründung im Code.
# Neue Einträge hier gehören begründet — sonst schlägt der Test zu Recht an.
DOWNGRADE_NOOP_OK = {
    # Guard gegen Doppel-Anwendung; der Spaltenlebenszyklus gehört 0015.
    "0017",
}


@pytest.fixture(scope="module")
def script():
    cfg = Config()
    cfg.set_main_option("script_location", os.path.join(BACKEND, "alembic"))
    return ScriptDirectory.from_config(cfg)


def test_genau_ein_head(script):
    heads = script.get_heads()
    assert len(heads) == 1, f"Mehrere Köpfe: {heads}"


def test_kette_ist_von_base_aus_aufloesbar(script):
    revs = list(script.walk_revisions("base", "heads"))
    assert len(revs) >= 36


def test_keine_verzweigung(script):
    """Jede Revision darf höchstens einen Nachfolger haben."""
    downs = [r.down_revision for r in script.walk_revisions("base", "heads") if r.down_revision]
    doppelt = {d for d in downs if downs.count(d) > 1}
    assert not doppelt, f"Verzweigung an: {doppelt}"


def test_revisionen_fortlaufend_nummeriert(script):
    """Die Revisions-IDs sind vierstellig und lückenlos."""
    ids = sorted(r.revision for r in script.walk_revisions("base", "heads"))
    assert all(r.isdigit() and len(r) == 4 for r in ids), ids
    zahlen = sorted(int(r) for r in ids)
    assert zahlen == list(range(zahlen[0], zahlen[0] + len(zahlen))), f"Lücke in {zahlen}"


def test_jede_revision_hat_upgrade_und_downgrade(script):
    for rev in script.walk_revisions("base", "heads"):
        mod = rev.module
        assert callable(getattr(mod, "upgrade", None)), f"{rev.revision}: kein upgrade()"
        assert callable(getattr(mod, "downgrade", None)), f"{rev.revision}: kein downgrade()"


def test_downgrade_ist_nicht_leer_ausser_forward_only(script):
    """Ein versehentlich leeres downgrade() macht die Migration unumkehrbar."""
    import inspect

    for rev in script.walk_revisions("base", "heads"):
        if rev.revision in DOWNGRADE_NOOP_OK:
            continue
        quelle = inspect.getsource(rev.module.downgrade)
        rumpf = [
            z.strip() for z in quelle.splitlines()[1:]
            if z.strip() and not z.strip().startswith("#") and not z.strip().startswith('"""')
        ]
        assert rumpf and rumpf != ["pass"], f"{rev.revision}: downgrade() ist leer"
