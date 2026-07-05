"""add plants and phaenophasen tables

Revision ID: 0026
Revises: 0025
Create Date: 2026-07-05 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plants",
        sa.Column("id", sa.String(20), primary_key=True),  # Format "KR000001"
        sa.Column("deutscher_name", sa.String(255), nullable=False),
        sa.Column("botanischer_name", sa.String(255), nullable=True),
        sa.Column("botanische_familie", sa.String(255), nullable=True),
        sa.Column("hauptkategorie", sa.String(100), nullable=True),
        sa.Column("weitere_kategorien", sa.Text(), nullable=True),
        sa.Column("synonyme", sa.Text(), nullable=True),
        sa.Column("quelle_botanik", sa.String(255), nullable=True),
        sa.Column("typische_verwendung", sa.Text(), nullable=True),
        sa.Column("licht", sa.String(100), nullable=True),
        sa.Column("bodenfeuchte", sa.String(100), nullable=True),
        sa.Column("bodenanspruch", sa.String(100), nullable=True),
        sa.Column("wasserbedarf", sa.String(100), nullable=True),
        sa.Column("naehrstoffbedarf", sa.String(100), nullable=True),
        sa.Column("hoehe", sa.String(100), nullable=True),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("bild_dateiname", sa.String(255), nullable=True),
        sa.Column("beschreibungstext", sa.Text(), nullable=True),
        sa.Column("giftige_teile", sa.Text(), nullable=True),
        sa.Column("warnung", sa.Text(), nullable=True),
        sa.Column("geschmacksintensitaet", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("frische", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("suesse", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("saeure", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bitterkeit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("schaerfe", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("umami", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("zitronig", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("anisartig", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("menthol", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("harzig", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("erdig", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blumig", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pfeffrig", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("knoblauchartig", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("standort_eignung", sa.Integer(), nullable=True),  # 1..3
        sa.Column("lebensdauer", sa.String(30), nullable=False),
        sa.Column("anbau_typ", sa.String(30), nullable=False),
        sa.Column("schwierigkeitsgrad", sa.String(20), nullable=True),
        sa.Column("essbarkeit", sa.String(30), nullable=False),
        sa.Column("redaktion_freigegeben", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_plants_slug", "plants", ["slug"], unique=True)
    op.create_check_constraint(
        "ck_plants_lebensdauer",
        "plants",
        "lebensdauer IN ('einjährig', 'zweijährig', 'mehrjährig-krautig', 'mehrjährig-verholzend')",
    )
    op.create_check_constraint(
        "ck_plants_anbau_typ",
        "plants",
        "anbau_typ IN ('Garten', 'Garten-frostempfindlich', 'nur-geschützt', 'nicht-kultivierbar')",
    )
    op.create_check_constraint(
        "ck_plants_schwierigkeitsgrad",
        "plants",
        "schwierigkeitsgrad IN ('Anfänger', 'Fortgeschritten', 'Experte')",
    )
    op.create_check_constraint(
        "ck_plants_essbarkeit",
        "plants",
        "essbarkeit IN ('essbar', 'essbar-mit-einschränkung', 'nur-verarbeitet', 'teilweise-giftig')",
    )

    op.create_table(
        "phaenophasen",
        sa.Column("phase_id", sa.Integer(), primary_key=True, autoincrement=False),  # 1..10
        sa.Column("phase_name", sa.String(255), nullable=False),
        sa.Column("zeigerpflanze", sa.String(255), nullable=True),
        sa.Column("ref_monat_von", sa.Integer(), nullable=False),
        sa.Column("ref_monat_bis", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("phaenophasen")

    op.drop_constraint("ck_plants_essbarkeit", "plants", type_="check")
    op.drop_constraint("ck_plants_schwierigkeitsgrad", "plants", type_="check")
    op.drop_constraint("ck_plants_anbau_typ", "plants", type_="check")
    op.drop_constraint("ck_plants_lebensdauer", "plants", type_="check")
    op.drop_index("ix_plants_slug", table_name="plants")
    op.drop_table("plants")
