"""add plant_ingredient_map table

Revision ID: 0029
Revises: 0028
Create Date: 2026-07-13 00:00:00.000000

Kräuterschule Phase 4 – Recipes-Mapping (Option B).

Brücken-Tabelle Pflanze <-> kanonischer Zutaten-Token (N:M).
Bewusst KEIN FK auf die (pro-Rezept, volatile) ingredients.id, sondern der
stabile, normalisierte Zutaten-Token als Join-Key. Auflösung Rezept<->Pflanze
passiert deterministisch zur Query-Zeit über denselben Resolver
(app/plants/ingredient_resolver.py), der auch das Rezept-Zutaten-Matching nutzt.

Idempotenz per Full-Reload (delete+reload) im Seed – daher kein Upsert-Key nötig,
aber Unique(pflanzen_id, token) gegen Duplikate innerhalb eines Reloads.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plant_ingredient_map",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("pflanzen_id", sa.String(20), nullable=False),
        sa.Column("token", sa.Text(), nullable=False),
        # 'derived' = aus vokabular_zutaten abgeleitet, 'override' = kuratierte CSV
        sa.Column("quelle", sa.String(20), nullable=False, server_default="derived"),
        sa.ForeignKeyConstraint(["pflanzen_id"], ["plants.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("pflanzen_id", "token", name="uq_plant_ingredient_map_pflanze_token"),
    )
    op.create_check_constraint(
        "ck_plant_ingredient_map_quelle",
        "plant_ingredient_map",
        "quelle IN ('derived', 'override')",
    )
    # token: Haupt-Zugriffspfad für Rezept->Pflanzen (WHERE token = ANY(...))
    op.create_index("ix_plant_ingredient_map_token", "plant_ingredient_map", ["token"])
    # pflanzen_id: Zugriffspfad für Pflanze->Rezepte (Tokens einer Pflanze holen)
    op.create_index("ix_plant_ingredient_map_pflanze", "plant_ingredient_map", ["pflanzen_id"])


def downgrade() -> None:
    op.drop_index("ix_plant_ingredient_map_pflanze", table_name="plant_ingredient_map")
    op.drop_index("ix_plant_ingredient_map_token", table_name="plant_ingredient_map")
    op.drop_constraint("ck_plant_ingredient_map_quelle", "plant_ingredient_map", type_="check")
    op.drop_table("plant_ingredient_map")
