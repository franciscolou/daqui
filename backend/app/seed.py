"""
Popula o banco com dados iniciais para desenvolvimento.
Execute: python -m app.seed
"""
import time

from app.core import geocoding
from app.core.security import hash_password
from app.database import SessionLocal, create_tables
from app.models.comment import Comment
from app.models.message import Message
from app.models.notification import Notification
from app.models.post import Post
from app.models.user import User

# Bairro do usuário de teste (francisco) = Leme (Rio). Coordenadas reais na orla,
# para o mapa ter pins de verdade. Carlos (Pinheiros) e Roberto (Jardins) ficam de
# fora do Leme de propósito: demonstram isolamento por bairro e perfil bloqueado.
USERS = [
    dict(username="francisco", name="Francisco Gardenberg", email="francisco@daqui.com", password="senha123",
         neighborhood="Leme", city="Rio de Janeiro", state="RJ", badge="lider", verified=True, latitude=-22.9631, longitude=-43.1665,
         avatar_url="https://i.pravatar.cc/150?img=68"),
    dict(username="anapaula", name="Ana Paula Lima", email="ana@daqui.com", password="senha123",
         neighborhood="Leme", city="Rio de Janeiro", state="RJ", badge="lider", verified=True, latitude=-22.9622, longitude=-43.1658,
         avatar_url="https://i.pravatar.cc/150?img=47"),
    dict(username="carlosmendes", name="Carlos Mendes", email="carlos@daqui.com", password="senha123",
         neighborhood="Pinheiros", badge="morador", verified=True, latitude=-23.5665, longitude=-46.7010,
         avatar_url="https://i.pravatar.cc/150?img=52"),
    dict(username="beatriz", name="Beatriz Santos", email="beatriz@daqui.com", password="senha123",
         neighborhood="Leme", city="Rio de Janeiro", state="RJ", badge="comerciante", verified=True, latitude=-22.9640, longitude=-43.1668,
         avatar_url="https://i.pravatar.cc/150?img=44"),
    dict(username="roberto", name="Roberto Alves", email="roberto@daqui.com", password="senha123",
         neighborhood="Jardins", badge="morador", verified=False, latitude=-23.5710, longitude=-46.6680,
         avatar_url="https://i.pravatar.cc/150?img=57"),
    dict(username="mariana", name="Mariana Costa", email="mariana@daqui.com", password="senha123",
         neighborhood="Leme", city="Rio de Janeiro", state="RJ", badge="morador", verified=True, latitude=-22.9648, longitude=-43.1662,
         avatar_url="https://i.pravatar.cc/150?img=25"),
    dict(username="thiago", name="Thiago Ferreira", email="thiago@daqui.com", password="senha123",
         neighborhood="Leme", city="Rio de Janeiro", state="RJ", badge="morador", verified=True, latitude=-22.9618, longitude=-43.1650,
         avatar_url="https://i.pravatar.cc/150?img=61"),
]

POSTS = [
    dict(author_idx=1, category="aviso", title="Atenção: Obra na Rua Gustavo Sampaio",
         content="Pessoal, a prefeitura vai iniciar obras na Rua Gustavo Sampaio amanhã às 8h. Previsão de 15 dias. Trânsito será desviado pela Av. Prefeito Mendes de Morais.",
         neighborhood="Leme", location="Rua Gustavo Sampaio, Leme", latitude=-22.9625, longitude=-43.1668, pinned=True),
    dict(author_idx=3, category="recomendacao", title="Padaria incrível no Leme!",
         content="Descobri uma padaria na Rua General Ribeiro da Costa. O croissant de manteiga é de outro nível 🥐 Recomendo demais!",
         image_urls=["https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600"],
         neighborhood="Leme", location="Rua General Ribeiro da Costa, Leme", latitude=-22.9640, longitude=-43.1672, likes_count=89, comments_count=23),
    dict(author_idx=1, category="seguranca", title="Cuidado com golpe do WhatsApp",
         content="ATENÇÃO: Estão circulando mensagens se passando pela síndica do Cond. Vista Mar pedindo dados bancários. Não responda!",
         neighborhood="Leme", location="Praça Almirante Júlio de Noronha, Leme", latitude=-22.9635, longitude=-43.1660, important=True, likes_count=156, shares_count=67),
    dict(author_idx=2, category="pets", title="Cachorro desaparecido 😢",
         content="Meu Golden Retriever, Thor, desapareceu ontem perto do Parque Villa-Lobos. Ele usa coleira azul. Recompensa de R$500 💛",
         image_urls=["https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600"],
         neighborhood="Pinheiros", location="Parque Villa-Lobos, Pinheiros", latitude=-23.5470, longitude=-46.7220, important=True, likes_count=203, comments_count=41),
    dict(author_idx=0, category="evento", title="Festa Junina da orla do Leme",
         content="Convite para nossa tradicional Festa Junina! 📅 Sábado, 15/06 a partir das 16h 📍 Rua Gustavo Sampaio, 305. Forró ao vivo, comidas típicas, quadrilha!",
         neighborhood="Leme", location="Rua Gustavo Sampaio, 305, Leme", latitude=-22.9628, longitude=-43.1670, likes_count=312, comments_count=87),
    dict(author_idx=4, category="venda", title="Sofá 3 lugares — R$ 800",
         content="Vendo sofá 3 lugares, cor cinza, em ótimo estado. Só saio por mudança. Mede 2,10m.",
         image_urls=["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600"],
         neighborhood="Jardins", location="Rua Oscar Freire, Jardins", latitude=-23.5620, longitude=-46.6720, likes_count=28, comments_count=9),
    dict(author_idx=1, category="ajuda", title="Alguém tem escada de 3 metros?",
         content="Oi vizinhos! Preciso trocar uma lâmpada no teto de 3 metros de altura e não tenho escada. Alguém pode emprestar por 30 minutos?",
         neighborhood="Leme", likes_count=15),
]


def seed():
    create_tables()
    db = SessionLocal()

    if db.query(User).count() > 0:
        print("Banco já populado, pulando seed.")
        db.close()
        return

    users = []
    for u in USERS:
        pw = u.pop("password")
        user = User(**u, hashed_password=hash_password(pw))
        db.add(user)
        users.append(user)
    db.flush()

    posts = []
    for p in POSTS:
        author_idx = p.pop("author_idx")
        likes = p.pop("likes_count", 0)
        p.pop("comments_count", 0)  # contagem é derivada de comentários reais
        shares = p.pop("shares_count", 0)
        # Coordenadas precisas: geocodifica o endereço (fallback p/ o valor fixo se offline).
        if p.get("location"):
            res = geocoding.forward(p["location"])
            if res:
                p["latitude"] = res["latitude"]
                p["longitude"] = res["longitude"]
            time.sleep(1.1)  # respeita o limite do Nominatim (~1 req/s)
        post = Post(**p, author_id=users[author_idx].id,
                    likes_count=likes, comments_count=0, shares_count=shares)
        db.add(post)
        posts.append(post)
    db.flush()

    # Comentários reais (post_idx, author_idx, content)
    seed_comments = [
        (1, 5, "Adoro essa padaria! O pão de fermentação natural também é ótimo 🥖"),
        (1, 2, "Boa dica! Vou lá essa semana ☕"),
        (1, 6, "Confirmo, atendimento excelente."),
        (2, 3, "Compartilhei no grupo do condomínio. Obrigado pelo alerta!"),
        (2, 0, "Já caíram nesse golpe aqui perto. Fiquem espertos."),
        (3, 1, "Que coisa! Espero que o Thor apareça logo 🙏"),
        (3, 4, "Vi um golden parecido perto da praça hoje de manhã."),
        (4, 2, "Bora! A quadrilha do ano passado foi animadíssima 🎉"),
    ]
    for post_idx, author_idx, content in seed_comments:
        db.add(Comment(post_id=posts[post_idx].id,
                       author_id=users[author_idx].id, content=content))
    db.flush()

    for i, post in enumerate(posts):
        post.comments_count = sum(1 for c in seed_comments if c[0] == i)

    # posts_count/comments_count são derivados dos registros reais, não hardcoded.
    for user in users:
        user.posts_count = sum(1 for p in posts if p.author_id == user.id)
        user.comments_count = sum(1 for _, author_idx, _ in seed_comments if users[author_idx].id == user.id)
    db.flush()

    db.add(Message(sender_id=users[1].id, receiver_id=users[0].id,
                   content="Obrigada pela dica da padaria! Já fui lá 😍"))
    db.add(Message(sender_id=users[6].id, receiver_id=users[0].id,
                   content="Você tem interesse na escada? Posso trazer hoje à tarde"))

    festa = posts[4]       # Festa Junina — post do Francisco (users[0])
    seguranca = posts[2]   # Golpe do WhatsApp — Francisco comentou neste post
    db.add(Notification(user_id=users[0].id, actor_id=users[1].id, type="like_post",
                        post_id=festa.id, target_text=festa.title,
                        content=f"{users[1].name} curtiu seu post"))
    db.add(Notification(user_id=users[0].id, actor_id=users[2].id, type="comment",
                        post_id=festa.id,
                        target_text="Vai ter forró ao vivo? Não perco por nada!",
                        content=f"{users[2].name} comentou no seu post"))
    db.add(Notification(user_id=users[0].id, actor_id=users[3].id, type="like_comment",
                        post_id=seguranca.id,
                        target_text="Já caíram nesse golpe aqui perto. Fiquem espertos.",
                        content=f"{users[3].name} curtiu seu comentário"))
    db.add(Notification(user_id=users[0].id, actor_id=users[5].id, type="follow",
                        content=f"{users[5].name} começou a seguir você"))

    db.commit()
    db.close()
    print("✅ Seed concluído com sucesso!")


if __name__ == "__main__":
    seed()
