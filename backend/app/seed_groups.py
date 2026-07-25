"""
Popula o banco com grupos de teste (idempotente — pula grupos já existentes pelo nome).
Execute: python -m app.seed_groups

Cenários montados em torno do francisco (bairro Leme):
- dono de um grupo fechado ("Condomínio Vista Mar")
- admin de um grupo aberto p/ solicitações ("Moradores do Leme"), com uma
  solicitação pendente do thiago pra testar aprovar/recusar
- membro comum de um grupo aberto ao público ("Feira & Trocas do Leme")
- NÃO-membro de um grupo aberto ao público ("Jardinagem no Leme") → dá pra
  achar no Descobrir e entrar na hora
- NÃO-membro de um grupo aberto p/ solicitações ("Corrida na Orla") → dá pra
  achar no Descobrir e mandar uma solicitação (fica pendente até um admin aprovar)
- há um grupo aberto ao público de Pinheiros ("Pinheiros Pet Lovers") que NÃO
  deve aparecer para o francisco — demonstra o isolamento por bairro.
"""
from app.database import SessionLocal, create_tables
from app.models.group import (
    Group,
    GroupJoinRequest,
    GroupMember,
    GroupMessage,
    GroupPrivacy,
    GroupRole,
)
from app.models.user import User

_PRIVACY_LABEL = {
    GroupPrivacy.PUBLIC: "aberto ao público",
    GroupPrivacy.REQUEST: "aberto p/ solicitações",
    GroupPrivacy.CLOSED: "fechado",
}

# (owner, [(username, role)], last_messages) — contagem de abertos decrescente: 5,4,3,2
GROUPS = [
    dict(
        name="Moradores do Leme",
        description="Grupo geral dos moradores do Leme. Avisos, dúvidas e prosa.",
        privacy=GroupPrivacy.REQUEST,
        owner="anapaula",
        members=[("francisco", GroupRole.ADMIN), ("beatriz", GroupRole.MEMBER), ("mariana", GroupRole.MEMBER)],
        pending_requests=["thiago"],
        messages=[("anapaula", "Bem-vindos ao grupo dos moradores do Leme! 🏖️"),
                  ("thiago", "Boa! Alguém sabe se a feira de sábado vai rolar?"),
                  ("francisco", "Vai sim, confirmei com a organização.")],
    ),
    dict(
        name="Feira & Trocas do Leme",
        description="Compra, venda e troca de coisas entre vizinhos do Leme.",
        privacy=GroupPrivacy.PUBLIC,
        owner="thiago",
        members=[("francisco", GroupRole.MEMBER), ("beatriz", GroupRole.MEMBER),
                 ("mariana", GroupRole.MEMBER)],
        messages=[("beatriz", "Tenho uma bicicleta infantil pra doar, alguém precisa?"),
                  ("mariana", "Eu quero pro meu sobrinho! 🚲")],
    ),
    dict(
        name="Jardinagem no Leme",
        description="Dicas de plantas, hortas e jardins na varanda.",
        privacy=GroupPrivacy.PUBLIC,
        owner="beatriz",
        members=[("anapaula", GroupRole.MEMBER), ("mariana", GroupRole.MEMBER)],
        messages=[("beatriz", "Minha manjericão bombou esse mês 🌿")],
    ),
    dict(
        name="Corrida na Orla",
        description="Bora correr na orla do Leme de manhã!",
        privacy=GroupPrivacy.REQUEST,
        owner="mariana",
        members=[("thiago", GroupRole.MEMBER)],
        messages=[("mariana", "Amanhã 6h no posto 1, quem topa?")],
    ),
    dict(
        name="Condomínio Vista Mar",
        description="Grupo privado do condomínio (síndica + moradores).",
        privacy=GroupPrivacy.CLOSED,
        owner="francisco",
        members=[("anapaula", GroupRole.ADMIN), ("beatriz", GroupRole.MEMBER)],
        messages=[("francisco", "Reunião de condomínio dia 20 às 19h no salão."),
                  ("anapaula", "Anotado! Vou avisar o pessoal do meu andar.")],
    ),
    dict(
        name="Pinheiros Pet Lovers",
        description="Tutores de pets em Pinheiros.",
        privacy=GroupPrivacy.PUBLIC,
        owner="carlosmendes",
        members=[],
        messages=[("carlosmendes", "Alguém indica um veterinário 24h por aqui?")],
    ),
]


def seed_groups():
    create_tables()
    db = SessionLocal()
    try:
        users = {u.username: u for u in db.query(User).all()}
        if not users:
            print("Nenhum usuário no banco. Rode `python -m app.seed` antes.")
            return

        created = 0
        for spec in GROUPS:
            if db.query(Group).filter(Group.name == spec["name"]).first():
                print(f"• '{spec['name']}' já existe, pulando.")
                continue
            owner = users.get(spec["owner"])
            if not owner:
                print(f"! dono '{spec['owner']}' não encontrado, pulando '{spec['name']}'.")
                continue

            group = Group(
                name=spec["name"],
                description=spec["description"],
                privacy=spec["privacy"],
                owner_id=owner.id,
                neighborhood=owner.neighborhood,
                members_count=0,
            )
            db.add(group)
            db.flush()

            db.add(GroupMember(group_id=group.id, user_id=owner.id, role=GroupRole.OWNER))
            count = 1
            for username, role in spec["members"]:
                u = users.get(username)
                # Só entra quem é do mesmo bairro do grupo (regra do domínio).
                if not u or u.neighborhood != group.neighborhood:
                    continue
                db.add(GroupMember(group_id=group.id, user_id=u.id, role=role))
                count += 1
            group.members_count = count

            for username in spec.get("pending_requests", []):
                u = users.get(username)
                if not u or u.neighborhood != group.neighborhood:
                    continue
                db.add(GroupJoinRequest(group_id=group.id, user_id=u.id))

            for username, content in spec["messages"]:
                u = users.get(username)
                if u:
                    db.add(GroupMessage(group_id=group.id, sender_id=u.id, content=content))

            created += 1
            print(f"✓ '{spec['name']}' ({owner.neighborhood}, "
                  f"{_PRIVACY_LABEL[spec['privacy']]}) — {count} membros")

        db.commit()
        print(f"\n✅ {created} grupo(s) criado(s).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_groups()
