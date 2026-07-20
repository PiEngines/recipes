from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from app.database import Base


class ShoppingListItem(Base):
    """Eine Position der Einkaufsliste.

    v1: genau eine implizite Liste je User — kein Listen-Objekt, kein Naming,
    keine Mehrfachlisten.

    Die Position ist self-contained: Name, Menge und Einheit sind Snapshots und
    bereits auf die beim Übernehmen gewählten Portionen skaliert. Auch
    `recipe_title` ist ein Snapshot — das Gruppen-Label „Nach Rezept" bleibt
    damit stabil, wenn das Rezept umbenannt oder gelöscht wird.
    `recipe_id` dient nur noch Badge und Link.

    Summiert wird erst beim Lesen, nie in der DB.
    """

    __tablename__ = "shopping_list_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # NULL = manuell angelegt. SET NULL, damit gelöschte Rezepte die Liste nicht mitreißen.
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    recipe_title = Column(String(255), nullable=True)

    name = Column(String(255), nullable=False)
    amount = Column(String(100), nullable=True)  # String wie Ingredient.amount, unterstützt „½"
    unit = Column(String(100), nullable=True)

    checked = Column(Boolean, nullable=False, default=False, server_default="false")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
