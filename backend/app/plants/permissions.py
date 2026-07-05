from app.models import User


def can_view_plants(user: User) -> bool:
    # heute: jeder eingeloggte User; später ABO-/Rollen-Gate
    return True


def can_view_unreleased(user: User) -> bool:
    # später einschränkbar (redaktion_freigegeben=false nur für höhere Rollen/ABO)
    return True
