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
