import enum

from sqlalchemy import Boolean, Column, Integer, String, Text

from app.database import Base


class Lebensdauer(str, enum.Enum):
    einjaehrig = "einjährig"
    zweijaehrig = "zweijährig"
    mehrjaehrig_krautig = "mehrjährig-krautig"
    mehrjaehrig_verholzend = "mehrjährig-verholzend"


class AnbauTyp(str, enum.Enum):
    garten = "Garten"
    garten_frostempfindlich = "Garten-frostempfindlich"
    nur_geschuetzt = "nur-geschützt"
    nicht_kultivierbar = "nicht-kultivierbar"


class Schwierigkeitsgrad(str, enum.Enum):
    anfaenger = "Anfänger"
    fortgeschritten = "Fortgeschritten"
    experte = "Experte"


class Essbarkeit(str, enum.Enum):
    essbar = "essbar"
    essbar_mit_einschraenkung = "essbar-mit-einschränkung"
    nur_verarbeitet = "nur-verarbeitet"
    teilweise_giftig = "teilweise-giftig"


class Plant(Base):
    __tablename__ = "plants"

    id = Column(String(20), primary_key=True)  # Format "KR000001"

    deutscher_name = Column(String(255), nullable=False)
    botanischer_name = Column(String(255), nullable=True)
    botanische_familie = Column(String(255), nullable=True)
    hauptkategorie = Column(String(100), nullable=True)  # freies Vokabular, kein Enum
    weitere_kategorien = Column(Text, nullable=True)
    synonyme = Column(Text, nullable=True)
    quelle_botanik = Column(String(255), nullable=True)
    typische_verwendung = Column(Text, nullable=True)

    licht = Column(String(100), nullable=True)
    bodenfeuchte = Column(String(100), nullable=True)
    bodenanspruch = Column(String(100), nullable=True)
    wasserbedarf = Column(String(100), nullable=True)
    naehrstoffbedarf = Column(String(100), nullable=True)
    hoehe = Column(String(100), nullable=True)

    slug = Column(String(255), nullable=False, unique=True, index=True)
    bild_dateiname = Column(String(255), nullable=True)
    beschreibungstext = Column(Text, nullable=True)

    giftige_teile = Column(Text, nullable=True)
    warnung = Column(Text, nullable=True)

    # 0..5
    geschmacksintensitaet = Column(Integer, nullable=False, default=0)
    frische = Column(Integer, nullable=False, default=0)
    suesse = Column(Integer, nullable=False, default=0)
    saeure = Column(Integer, nullable=False, default=0)
    bitterkeit = Column(Integer, nullable=False, default=0)
    schaerfe = Column(Integer, nullable=False, default=0)
    umami = Column(Integer, nullable=False, default=0)
    zitronig = Column(Integer, nullable=False, default=0)
    anisartig = Column(Integer, nullable=False, default=0)
    menthol = Column(Integer, nullable=False, default=0)
    harzig = Column(Integer, nullable=False, default=0)
    erdig = Column(Integer, nullable=False, default=0)
    blumig = Column(Integer, nullable=False, default=0)
    pfeffrig = Column(Integer, nullable=False, default=0)
    knoblauchartig = Column(Integer, nullable=False, default=0)

    standort_eignung = Column(Integer, nullable=True)  # 1..3

    lebensdauer = Column(String(30), nullable=False)
    anbau_typ = Column(String(30), nullable=False)
    schwierigkeitsgrad = Column(String(20), nullable=True)
    essbarkeit = Column(String(30), nullable=False)

    redaktion_freigegeben = Column(Boolean, nullable=False, default=False, server_default="false")
