"""add plant_calendar table

Revision ID: 0028
Revises: 0027
Create Date: 2026-07-12 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plant_calendar",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("pflanzen_id", sa.String(20), nullable=False),
        sa.Column("kategorie", sa.String(20), nullable=False),
        sa.Column("aktivitaet", sa.String(40), nullable=False),
        sa.Column("phase_von", sa.Integer(), nullable=True),
        sa.Column("phase_bis", sa.Integer(), nullable=True),
        sa.Column("laufend", sa.Boolean(), nullable=False),
        sa.Column("hinweis", sa.Text(), nullable=True),
        sa.Column("quelle", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["pflanzen_id"], ["plants.id"], ondelete="CASCADE"),
    )
    op.create_check_constraint(
        "ck_plant_calendar_kategorie",
        "plant_calendar",
        "kategorie IN ('Anbau', 'Nutzung', 'Pflege')",
    )
    op.create_check_constraint(
        "ck_plant_calendar_aktivitaet",
        "plant_calendar",
        "aktivitaet IN ('Pflanzung', 'Aussaat', 'Vorkultur', 'Teilung/Vermehrung', "
        "'Direktsaat', 'Ernte', 'Blüte', 'Pflege (allgemein)', 'Rückschnitt', "
        "'Winterschutz', 'Düngung')",
    )
    op.create_check_constraint(
        "ck_plant_calendar_phase_paar",
        "plant_calendar",
        "(phase_von IS NULL) = (phase_bis IS NULL)",
    )
    op.create_check_constraint(
        "ck_plant_calendar_phase_range",
        "plant_calendar",
        "phase_von IS NULL OR (phase_von BETWEEN 1 AND 10 "
        "AND phase_bis BETWEEN 1 AND 10 AND phase_von <= phase_bis)",
    )
    op.create_index("ix_plant_calendar_pflanze", "plant_calendar", ["pflanzen_id"])
    op.create_index(
        "ix_plant_calendar_phase", "plant_calendar", ["phase_von", "phase_bis"]
    )


def downgrade() -> None:
    op.drop_index("ix_plant_calendar_phase", table_name="plant_calendar")
    op.drop_index("ix_plant_calendar_pflanze", table_name="plant_calendar")
    op.drop_constraint("ck_plant_calendar_phase_range", "plant_calendar", type_="check")
    op.drop_constraint("ck_plant_calendar_phase_paar", "plant_calendar", type_="check")
    op.drop_constraint("ck_plant_calendar_aktivitaet", "plant_calendar", type_="check")
    op.drop_constraint("ck_plant_calendar_kategorie", "plant_calendar", type_="check")
    op.drop_table("plant_calendar")
