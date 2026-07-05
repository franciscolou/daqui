"""
Insere dados de teste adicionais SEM apagar o banco existente.
Idempotente: se já foi rodado (detecta usuário marcador), não duplica.

Execute: python -m app.seed_testdata
"""
import time
from datetime import datetime, timedelta, timezone

from app.core import geocoding
from app.core.security import hash_password
from app.database import SessionLocal, create_tables
from app.models.comment import Comment
from app.models.message import Message
from app.models.notification import Notification
from app.models.post import Post, PostLike
from app.models.user import User

LOU_EMAIL = "lotiungames@gmail.com"
MARKER_EMAIL = "helena.leme@daqui.com"  # se existir, já rodou


def ago(minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


def seed():
    create_tables()
    db = SessionLocal()

    if db.query(User).filter(User.email == MARKER_EMAIL).first():
        print("Dados de teste já inseridos, pulando.")
        db.close()
        return

    lou = db.query(User).filter(User.email == LOU_EMAIL).first()
    if not lou:
        print(f"⚠ Conta lou ({LOU_EMAIL}) não encontrada. Abortando.")
        db.close()
        return

    # Dá um avatar e bairro consistente à lou
    if not lou.avatar_url:
        lou.avatar_url = "https://i.pravatar.cc/150?img=15"
    lou.badge = lou.badge or "morador"
    if not getattr(lou, "username", None):
        lou.username = "lou"
    lou_bairro = lou.neighborhood or "Leme"
    if lou.latitude is None:
        lou.latitude, lou.longitude = -22.9631, -43.1665  # centro do Leme
    if lou_bairro == "Leme":
        lou.city = "Rio de Janeiro"
        lou.state = "RJ"

    # ── Vizinhos da lou (mesmo bairro) ───────────────────────────
    neighbors_data = [
        dict(username="helena", name="Helena Prado", email=MARKER_EMAIL, neighborhood=lou_bairro, city="Rio de Janeiro", state="RJ",
             badge="lider", verified=True, avatar_url="https://i.pravatar.cc/150?img=31",
             latitude=-22.9622, longitude=-43.1658),
        dict(username="bruno", name="Bruno Tavares", email="bruno.leme@daqui.com", neighborhood=lou_bairro, city="Rio de Janeiro", state="RJ",
             badge="morador", verified=True, avatar_url="https://i.pravatar.cc/150?img=12",
             latitude=-22.9640, longitude=-43.1668),
        dict(username="sofia", name="Sofia Andrade", email="sofia.leme@daqui.com", neighborhood=lou_bairro, city="Rio de Janeiro", state="RJ",
             badge="comerciante", verified=True, avatar_url="https://i.pravatar.cc/150?img=24",
             latitude=-22.9648, longitude=-43.1662),
        dict(username="diego", name="Diego Martins", email="diego.leme@daqui.com", neighborhood=lou_bairro, city="Rio de Janeiro", state="RJ",
             badge="morador", verified=False, avatar_url="https://i.pravatar.cc/150?img=8",
             latitude=-22.9618, longitude=-43.1650),
    ]
    neighbors = {}
    for d in neighbors_data:
        u = User(**d, hashed_password=hash_password("senha123"))
        db.add(u)
        neighbors[d["name"].split()[0].lower()] = u
    db.flush()

    helena = neighbors["helena"]
    bruno = neighbors["bruno"]
    sofia = neighbors["sofia"]
    diego = neighbors["diego"]

    # Usuários de Vila Madalena já existentes (para enriquecer o feed do Francisco)
    def by_email(email):
        return db.query(User).filter(User.email == email).first()

    francisco = by_email("francisco@daqui.com")
    ana = by_email("ana@daqui.com")
    beatriz = by_email("beatriz@daqui.com")
    mariana = by_email("mariana@daqui.com")

    # ── Posts ────────────────────────────────────────────────────
    # (chave, autor, bairro, categoria, título, conteúdo, image_url, important, pinned, min_atrás)
    posts_spec = [
        # Bairro da lou (Leme) — para o feed da lou ter conteúdo
        ("leme_welcome", helena, lou_bairro, "aviso", "Bem-vindos ao grupo do Leme! 🌊",
         "Pessoal, criamos este espaço para os moradores do Leme se conectarem. Sejam todos bem-vindos! Usem com respeito e carinho. 💚",
         None, False, True, 60),
        ("leme_feira", sofia, lou_bairro, "evento", "Feirinha de orgânicos no sábado",
         "Neste sábado das 8h às 13h tem feira de produtos orgânicos na pracinha do Leme. Hortifruti fresquinho direto do produtor! 🥬🍎",
         "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600", False, False, 120),
        ("leme_seguranca", bruno, lou_bairro, "seguranca", "Atenção a carros parados na orla",
         "Vi dois carros suspeitos parados perto do quiosque 3 ontem à noite. Já avisei a guarda. Fiquem atentos ao sair tarde. 🚨",
         None, True, False, 180),
        ("leme_lou1", lou, lou_bairro, "recomendacao", "Melhor pastel do Leme 🥟",
         "Gente, descobri um quiosque com o pastel de queijo mais incrível da orla. Fica perto do posto 2. Recomendo demais o caldo de cana também!",
         "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600", False, False, 30),
        ("leme_lou2", lou, lou_bairro, "ajuda", "Alguém indica um bom encanador?",
         "Preciso resolver um vazamento na pia da cozinha. Alguém conhece um encanador de confiança aqui no Leme? 🔧",
         None, False, False, 15),
        ("leme_lou3", lou, lou_bairro, "geral", "Pôr do sol de hoje no Leme 🌅",
         "Não resisti e tirei essa foto da mureta. A vista daqui continua sendo a melhor do Rio, sem discussão!",
         "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=600", False, False, 5),
        ("leme_pet", diego, lou_bairro, "pets", "Gatinho encontrado na rua Gustavo Sampaio",
         "Achei esse gatinho cinza muito dócil perto do número 200. Está com fome mas saudável. Alguém perdeu? Posso abrigar por uns dias. 🐱",
         "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600", False, False, 240),
        ("leme_venda", sofia, lou_bairro, "venda", "Bicicleta seminova — R$ 650",
         "Vendo bike aro 29, pouco uso, ideal pra orla. Revisada, freios novos. Retirada no Leme. Chama no direct! 🚲",
         "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600", False, False, 300),
        ("leme_evento2", helena, lou_bairro, "evento", "Mutirão de limpeza da praia 🏖️",
         "Domingo às 7h vamos fazer um mutirão de limpeza na praia do Leme. Levem luvas e sacos. Café da manhã por conta da associação!",
         None, False, False, 420),

        # Mais conteúdo do Leme (autores que também moram no bairro)
        ("vm_extra1", ana, lou_bairro, "evento", "Sarau na Praça Almirante Júlio de Noronha",
         "Sábado tem sarau de poesia e música na praça! A partir das 17h. Tragam uma cadeira e boa energia. 🎶",
         None, False, False, 90),
        ("vm_extra2", beatriz, lou_bairro, "recomendacao", "Novo café com wi-fi excelente ☕",
         "Abriu um café na Rua Gustavo Sampaio perfeito pra trabalhar: tomadas em todas as mesas, wi-fi rápido e café ótimo. Recomendo!",
         "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600", False, False, 200),
        ("vm_extra3", mariana, lou_bairro, "ajuda", "Doação de roupas de inverno 🧥",
         "Estou organizando uma doação de agasalhos. Quem tiver roupas de frio em bom estado, deixa comigo até sexta. Vamos aquecer alguém!",
         None, False, False, 350),
    ]

    # Coordenadas na orla do Leme, atribuídas em rodízio aos posts com bairro = Leme.
    LEME_COORDS = [
        ("Rua Gustavo Sampaio, Leme", -22.9625, -43.1668),
        ("Av. Atlântica, Leme", -22.9612, -43.1655),
        ("Rua General Ribeiro da Costa, Leme", -22.9640, -43.1672),
        ("Praça Almirante Júlio de Noronha, Leme", -22.9635, -43.1660),
        ("Rua Anchieta, Leme", -22.9648, -43.1665),
        ("Av. Atlântica, Posto 2, Leme", -22.9620, -43.1648),
        ("Ladeira do Leme, Leme", -22.9655, -43.1670),
    ]

    posts = {}
    coord_i = 0
    for key, author, bairro, cat, title, content, img, important, pinned, mins in posts_spec:
        location = lat = lon = None
        if bairro == lou_bairro:
            location, lat, lon = LEME_COORDS[coord_i % len(LEME_COORDS)]
            coord_i += 1
            # Coordenadas precisas via geocoding (fallback p/ o valor fixo se offline).
            res = geocoding.forward(location)
            if res:
                lat, lon = res["latitude"], res["longitude"]
            time.sleep(1.1)
        p = Post(
            author_id=author.id, neighborhood=bairro, category=cat,
            title=title, content=content, image_urls=[img] if img else [],
            important=important, pinned=pinned, created_at=ago(mins),
            location=location, latitude=lat, longitude=lon,
        )
        db.add(p)
        posts[key] = p
    db.flush()

    # ── Comentários ──────────────────────────────────────────────
    # (post_key, autor, conteúdo, min_atrás)
    comments_spec = [
        ("leme_welcome", lou, "Que legal! Acabei de me mudar pro Leme, adorei a iniciativa 💚", 50),
        ("leme_welcome", bruno, "Boa, Helena! Já era hora de termos um grupo nosso.", 48),
        ("leme_welcome", diego, "Massa demais!", 40),
        ("leme_feira", lou, "Adoro essa feira! O pão de fermentação natural é ótimo 🥖", 100),
        ("leme_feira", diego, "Vou marcar presença 🙌", 95),
        ("leme_seguranca", helena, "Obrigada pelo aviso, Bruno. Compartilhei no grupo do prédio.", 170),
        ("leme_seguranca", lou, "Vi esses carros também! Bom ficar de olho.", 160),
        ("leme_lou1", sofia, "Esse quiosque é maravilhoso mesmo! O de carne também é top.", 25),
        ("leme_lou1", bruno, "Agora fiquei com fome 😂 vou lá hoje.", 20),
        ("leme_lou2", helena, "Tenho o contato de um excelente, te mando no direct!", 12),
        ("leme_lou3", diego, "Que foto linda! O Leme não decepciona 🌅", 4),
        ("leme_lou3", sofia, "Perfeita! Pode ser foto de cartão postal.", 3),
        ("leme_pet", lou, "Que fofo! Vou perguntar pros vizinhos se alguém perdeu.", 230),
        ("leme_venda", lou, "A bike ainda está disponível?", 280),
        ("vm_extra1", francisco, "Vou levar a galera! Sarau é sempre ótimo 🎶", 80),
        ("vm_extra2", francisco, "Boa dica! Preciso de um lugar assim pra trabalhar.", 190),
    ]
    for post_key, author, content, mins in comments_spec:
        db.add(Comment(post_id=posts[post_key].id, author_id=author.id,
                       content=content, created_at=ago(mins)))

    # ── Curtidas ─────────────────────────────────────────────────
    # (post_key, [usuários que curtiram])
    likes_spec = [
        ("leme_welcome", [lou, bruno, sofia, diego]),
        ("leme_feira", [lou, diego, helena]),
        ("leme_seguranca", [lou, helena, sofia, diego]),
        ("leme_lou1", [helena, bruno, sofia, diego]),
        ("leme_lou2", [helena, bruno]),
        ("leme_lou3", [helena, bruno, sofia, diego]),
        ("leme_pet", [lou, helena, sofia]),
        ("leme_venda", [lou, bruno]),
        ("leme_evento2", [lou, bruno, sofia]),
        ("vm_extra1", [francisco, beatriz, mariana]),
        ("vm_extra2", [francisco, ana]),
        ("vm_extra3", [francisco, ana, beatriz]),
    ]
    # lou também curte posts dos vizinhos (já contemplado acima em parte)
    for post_key, users in likes_spec:
        for u in users:
            db.add(PostLike(post_id=posts[post_key].id, user_id=u.id))

    # ── Mensagens (conversas envolvendo a lou) ───────────────────
    msgs_spec = [
        (helena, lou, "Oi Lou! Bem-vinda ao Leme 😊 Qualquer coisa que precisar, é só chamar!", 55, True),
        (lou, helena, "Muito obrigada, Helena! Já tô amando o bairro 💚", 53, True),
        (helena, lou, "Te mando o contato daquele encanador hoje à noite, tá?", 11, False),
        (bruno, lou, "Lou, o pastel que você indicou é realmente sensacional! Valeu pela dica 🥟", 18, False),
        (sofia, lou, "Oi! A bike ainda está disponível sim, quer ver pessoalmente?", 270, False),
    ]
    for sender, receiver, content, mins, read in msgs_spec:
        db.add(Message(sender_id=sender.id, receiver_id=receiver.id,
                       content=content, read=read, created_at=ago(mins)))

    # ── Notificações para a lou ──────────────────────────────────
    notifs_spec = [
        (lou, helena, "like", "Helena Prado curtiu sua recomendação sobre o pastel do Leme", "leme_lou1", 24, False),
        (lou, sofia, "comment", 'Sofia Andrade comentou: "Esse quiosque é maravilhoso mesmo!"', "leme_lou1", 25, False),
        (lou, diego, "like", "Diego Martins e outros curtiram sua foto do pôr do sol", "leme_lou3", 4, False),
        (lou, helena, "comment", 'Helena Prado comentou: "Tenho o contato de um excelente!"', "leme_lou2", 12, False),
        (lou, None, "welcome", "Bem-vinda ao Daqui! Complete seu perfil e conheça seus vizinhos do Leme 🌊", None, 70, True),
        (lou, helena, "event", "Helena Prado convidou você para o Mutirão de limpeza da praia", "leme_evento2", 420, True),
    ]
    for user, actor, ntype, content, post_key, mins, read in notifs_spec:
        db.add(Notification(
            user_id=user.id,
            actor_id=actor.id if actor else None,
            type=ntype, content=content,
            post_id=posts[post_key].id if post_key else None,
            read=read, created_at=ago(mins),
        ))

    # Notificações para o Francisco também
    db.add(Notification(user_id=francisco.id, actor_id=ana.id, type="comment",
                        content='Ana Paula Lima comentou no seu post', post_id=posts["vm_extra1"].id,
                        read=False, created_at=ago(80)))

    db.flush()

    # ── Recalcula contagens derivadas ────────────────────────────
    all_posts = db.query(Post).all()
    for p in all_posts:
        p.likes_count = db.query(PostLike).filter(PostLike.post_id == p.id).count()
        p.comments_count = db.query(Comment).filter(Comment.post_id == p.id).count()

    for u in db.query(User).all():
        u.posts_count = db.query(Post).filter(Post.author_id == u.id).count()
        u.comments_count = db.query(Comment).filter(Comment.author_id == u.id).count()

    db.commit()

    # Resumo
    print("✅ Dados de teste inseridos com sucesso!")
    print(f"   Vizinhos novos no {lou_bairro}: Helena, Bruno, Sofia, Diego")
    print(f"   Posts totais: {db.query(Post).count()}")
    print(f"   Comentários totais: {db.query(Comment).count()}")
    print(f"   Curtidas totais: {db.query(PostLike).count()}")
    print(f"   Mensagens totais: {db.query(Message).count()}")
    print(f"   Notificações totais: {db.query(Notification).count()}")
    print(f"   Posts da lou: {db.query(Post).filter(Post.author_id == lou.id).count()}")
    db.close()


if __name__ == "__main__":
    seed()
