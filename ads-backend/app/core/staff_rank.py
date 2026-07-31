from app.models.admin import AD_ADMIN_RANK, AdAdmin


def can_manage(actor: AdAdmin, target: AdAdmin) -> bool:
    """Actor só pode agir (suspender/reativar/excluir) sobre um alvo de cargo
    estritamente inferior — nunca sobre si mesmo, um par ou um superior."""
    if actor.id == target.id:
        return False
    return AD_ADMIN_RANK[actor.role] > AD_ADMIN_RANK[target.role]
