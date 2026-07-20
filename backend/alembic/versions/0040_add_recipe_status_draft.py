"""add 'draft' to recipe_status enum

Revision ID: 0040
Revises: 0039

FORWARD-ONLY. PostgreSQL kann Enum-Werte nicht entfernen; `downgrade()` ist
deshalb bewusst ein No-op. Ein Rollback setzt den Code zurück — der zusätzliche
Enum-Wert bleibt ungenutzt in der Datenbank liegen und stört dort nicht.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0040"
down_revision: Union[str, None] = "0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE läuft in PostgreSQL nicht innerhalb einer
    # Transaktion — daher der autocommit_block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE recipe_status ADD VALUE IF NOT EXISTS 'draft'")


def downgrade() -> None:
    # Bewusst leer: PostgreSQL kann Enum-Werte nicht droppen (forward-only).
    # Der Wert bleibt harmlos liegen; das Zurücknehmen passiert im Code.
    pass
