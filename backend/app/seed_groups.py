"""
Popula o banco com grupos de teste (idempotente — pula grupos já existentes pelo nome).
Execute: python -m app.seed_groups

Cenários montados em torno do francisco (bairro Leme):
- dono de um grupo fechado ("Condomínio Vista Mar")
- admin de um grupo aberto ("Moradores do Leme")
- membro comum de outro grupo aberto ("Feira & Trocas do Leme")
- NÃO-membro de um grupo aberto do Leme ("Jardinagem no Leme") → dá pra achar no
  Descobrir e entrar
- há um grupo aberto de Pinheiros ("Pinheiros Pet Lovers") que NÃO deve aparecer
  para o francisco — demonstra o isolamento por bairro.
"""
from app.database import SessionLocal, create_tables
from app.models.group import (
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_OWNER,
    Group,
    GroupMember,
    GroupMessage,
)
from app.models.user import User

# (owner, [(username, role)], last_messages) — contagem de abertos decrescente: 5,4,3,2
GROUPS = [
    dict(
        name="Moradores do Leme",
        description="Grupo geral dos moradores do Leme. Avisos, dúvidas e prosa.",
        is_open=True,
        owner="anapaula",
        members=[("francisco", ROLE_ADMIN), ("beatriz", ROLE_MEMBER),
                 ("mariana", ROLE_MEMBER), ("thiago", ROLE_MEMBER)],
        messages=[("anapaula", "Bem-vindos ao grupo dos moradores do Leme! 🏖️"),
                  ("thiago", "Boa! Alguém sabe se a feira de sábado vai rolar?"),
                  ("francisco", "Vai sim, confirmei com a organização.")],
    ),
    dict(
        name="Feira & Trocas do Leme",
        description="Compra, venda e troca de coisas entre vizinhos do Leme.",
        is_open=True,
        owner="thiago",
        members=[("francisco", ROLE_MEMBER), ("beatriz", ROLE_MEMBER),
                 ("mariana", ROLE_MEMBER)],
        messages=[("beatriz", "Tenho uma bicicleta infantil pra doar, alguém precisa?"),
                  ("mariana", "Eu quero pro meu sobrinho! 🚲")],
    ),
    dict(
        name="Jardinagem no Leme",
        description="Dicas de plantas, hortas e jardins na varanda.",
        is_open=True,
        owner="beatriz",
        members=[("anapaula", ROLE_MEMBER), ("mariana", ROLE_MEMBER)],
        messages=[("beatriz", "Minha manjericão bombou esse mês 🌿")],
    ),
    dict(
        name="Corrida na Orla",
        description="Bora correr na orla do Leme de manhã!",
        is_open=True,
        owner="mariana",
        members=[("thiago", ROLE_MEMBER)],
        messages=[("mariana", "Amanhã 6h no posto 1, quem topa?")],
    ),
    dict(
        name="Condomínio Vista Mar",
        description="Grupo privado do condomínio (síndica + moradores).",
        is_open=False,
        owner="francisco",
        members=[("anapaula", ROLE_ADMIN), ("beatriz", ROLE_MEMBER)],
        messages=[("francisco", "Reunião de condomínio dia 20 às 19h no salão."),
                  ("anapaula", "Anotado! Vou avisar o pessoal do meu andar.")],
    ),
    dict(
        name="Pinheiros Pet Lovers",
        description="Tutores de pets em Pinheiros.",
        is_open=True,
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
                is_open=spec["is_open"],
                owner_id=owner.id,
                neighborhood=owner.neighborhood,
                members_count=0,
            )
            db.add(group)
            db.flush()

            db.add(GroupMember(group_id=group.id, user_id=owner.id, role=ROLE_OWNER))
            count = 1
            for username, role in spec["members"]:
                u = users.get(username)
                # Só entra quem é do mesmo bairro do grupo (regra do domínio).
                if not u or u.neighborhood != group.neighborhood:
                    continue
                db.add(GroupMember(group_id=group.id, user_id=u.id, role=role))
                count += 1
            group.members_count = count

            for username, content in spec["messages"]:
                u = users.get(username)
                if u:
                    db.add(GroupMessage(group_id=group.id, sender_id=u.id, content=content))

            created += 1
            print(f"✓ '{spec['name']}' ({spec['neighborhood'] if 'neighborhood' in spec else owner.neighborhood}, "
                  f"{'aberto' if spec['is_open'] else 'fechado'}) — {count} membros")

        db.commit()
        print(f"\n✅ {created} grupo(s) criado(s).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_groups()
