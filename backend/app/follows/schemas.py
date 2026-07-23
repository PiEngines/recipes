from pydantic import BaseModel


class FollowUserItem(BaseModel):
    """Kompakte User-Darstellung für Follower-/Following-Listen."""

    id: int
    name: str
    username: str | None = None
    avatar_url: str | None = None
    model_config = {"from_attributes": True}


class FollowUserPage(BaseModel):
    items: list[FollowUserItem] = []
    total: int
    page: int
    page_size: int


class TaxItem(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class UserProfile(BaseModel):
    """Öffentliche Profilsicht auf einen User.

    Neu in F3a — es gab bisher keinen Profil-Read; die Profilseite bediente sich
    allein aus der Rezeptliste. `is_following` bezieht sich auf den Aufrufer.
    """

    id: int
    name: str
    username: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    follower_count: int
    following_count: int
    is_following: bool
    # Vorlieben (BUG-41): nur gefüllt, wenn der Nutzer sie freigegeben hat —
    # die Gate-Logik sitzt im Endpoint, hier steht dann schlicht `None`.
    preferences: str | None = None
    # Ernährungsprofil (Ü18): Ernährungsweise und Ausschlüsse, jeweils nur wenn
    # freigegeben (Gate im Endpoint, sonst leer). **Allergien nie** — sie
    # tauchen in dieser öffentlichen Sicht bewusst gar nicht auf.
    diet_labels: list[TaxItem] = []
    exclusions: list[TaxItem] = []
