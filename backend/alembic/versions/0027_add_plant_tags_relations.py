"""add plant_tags and plant_relations tables

Revision ID: 0027
Revises: 0026
Create Date: 2026-07-12 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plant_tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("pflanzen_id", sa.String(20), nullable=False),
        sa.Column("facet", sa.String(20), nullable=False),
        sa.Column("canonical", sa.Text(), nullable=False),
        sa.Column("ist_stil", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["pflanzen_id"], ["plants.id"], ondelete="CASCADE"),
    )
    op.create_check_constraint(
        "ck_plant_tags_facet",
        "plant_tags",
        "facet IN ('passt_zu', 'kombiniert_mit', 'laenderkueche')",
    )
    op.create_index(
        "ix_plant_tags_pflanze_facet", "plant_tags", ["pflanzen_id", "facet"]
    )

    op.create_table(
        "plant_relations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("pflanzen_id", sa.String(20), nullable=False),
        sa.Column("beziehung", sa.String(30), nullable=False),
        sa.Column("ziel_typ", sa.String(20), nullable=False),
        sa.Column("ziel_pflanze_id", sa.String(20), nullable=True),
        sa.Column("ziel_name", sa.Text(), nullable=True),
        sa.Column("qualifier", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["pflanzen_id"], ["plants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ziel_pflanze_id"], ["plants.id"], ondelete="CASCADE"),
    )
    op.create_check_constraint(
        "ck_plant_relations_beziehung",
        "plant_relations",
        "beziehung IN ('mischkultur_gut', 'mischkultur_schlecht', 'ersatz')",
    )
    op.create_check_constraint(
        "ck_plant_relations_ziel_typ",
        "plant_relations",
        "ziel_typ IN ('pflanze', 'gruppe', 'zutat', 'hinweis')",
    )
    op.create_check_constraint(
        "ck_plant_relations_ziel",
        "plant_relations",
        "(ziel_typ = 'pflanze' AND ziel_pflanze_id IS NOT NULL AND ziel_name IS NULL) "
        "OR (ziel_typ <> 'pflanze' AND ziel_pflanze_id IS NULL AND ziel_name IS NOT NULL)",
    )
    op.create_index(
        "ix_plant_relations_pflanze_beziehung",
        "plant_relations",
        ["pflanzen_id", "beziehung"],
    )
    op.create_index(
        "ix_plant_relations_ziel_pflanze", "plant_relations", ["ziel_pflanze_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_plant_relations_ziel_pflanze", table_name="plant_relations")
    op.drop_index(
        "ix_plant_relations_pflanze_beziehung", table_name="plant_relations"
    )
    op.drop_constraint("ck_plant_relations_ziel", "plant_relations", type_="check")
    op.drop_constraint(
        "ck_plant_relations_ziel_typ", "plant_relations", type_="check"
    )
    op.drop_constraint(
        "ck_plant_relations_beziehung", "plant_relations", type_="check"
    )
    op.drop_table("plant_relations")

    op.drop_index("ix_plant_tags_pflanze_facet", table_name="plant_tags")
    op.drop_constraint("ck_plant_tags_facet", "plant_tags", type_="check")
    op.drop_table("plant_tags")
