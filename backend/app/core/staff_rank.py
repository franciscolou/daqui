from app.models.user import STAFF_RANK, User


def can_manage(actor: User, target: User) -> bool:
    """Actor só pode agir (suspender/reativar/excluir) sobre um alvo de cargo
    estritamente inferior — nunca sobre si mesmo, um par ou um superior."""
    if actor.id == target.id or target.staff_role is None:
        return False
    return STAFF_RANK[actor.staff_role] > STAFF_RANK[target.staff_role]
