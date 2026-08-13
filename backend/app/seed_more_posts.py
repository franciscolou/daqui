"""Adiciona mais posts de teste para os usuários já seedados por `app.seed`,
sem apagar nada existente. Pensado pra dar volume ao feed/mapa durante testes
manuais (vários bairros, categorias e autores diferentes).
Idempotente: detecta pelo título de um post marcador; se existir, pula.
Execute: python -m app.seed_more_posts
"""
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models.comment import Comment
from app.models.post import Post, PostCategory, PostLike
from app.models.user import User

MARKER_TITLE = "Chegou o verão no bairro! ☀️"


def ago(minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


def seed():
    db = SessionLocal()

    if db.query(Post).filter(Post.title == MARKER_TITLE).first():
        print("Posts extras já inseridos, pulando.")
        db.close()
        return

    def by_email(email):
        u = db.query(User).filter(User.email == email).first()
        if not u:
            raise SystemExit(f"⚠ Usuário {email} não encontrado. Rode `python -m app.seed` antes.")
        return u

    francisco = by_email("francisco@daqui.com")
    ana = by_email("ana@daqui.com")
    carlos = by_email("carlos@daqui.com")
    beatriz = by_email("beatriz@daqui.com")
    roberto = by_email("roberto@daqui.com")
    mariana = by_email("mariana@daqui.com")
    thiago = by_email("thiago@daqui.com")
    julia = by_email("julia@daqui.com")
    fernando = by_email("fernando@daqui.com")
    camila = by_email("camila@daqui.com")
    rafael = by_email("rafael@daqui.com")
    patricia = by_email("patricia@daqui.com")
    bruno = by_email("bruno@daqui.com")
    larissa = by_email("larissa@daqui.com")

    # (autor, bairro, categoria, título, conteúdo, image_url, important, lat, lon, min_atrás)
    posts_spec = [
        (mariana, "Leme", PostCategory.EVENTO, MARKER_TITLE,
         "Bora aproveitar a orla! Aula de vôlei de praia gratuita todo sábado às 9h, em frente ao posto 3. Traz protetor solar 🏐",
         "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=600", False, -22.9636, -43.1663, 45),
        (thiago, "Leme", PostCategory.PERDIDOS, "Chaveiro perdido na praia",
         "Perdi um molho de chaves com um chaveirinho de tartaruga hoje de manhã perto do posto 2. Se alguém achar, avisa aqui!",
         None, False, -22.9615, -43.1652, 130),
        (francisco, "Leme", PostCategory.GERAL, "Reforma da praça está ficando ótima",
         "Passei hoje e o novo playground já está quase pronto. Bancos novos, mais sombra. Parabéns à prefeitura pela iniciativa!",
         "https://images.unsplash.com/photo-1596997000103-e597b3ca50df?w=600", False, -22.9633, -43.1659, 300),
        (ana, "Leme", PostCategory.AVISO, "Coleta de recicláveis muda de dia",
         "A partir da próxima semana a coleta seletiva passa a ser às terças e sextas, não mais quartas. Fiquem ligados!",
         None, False, -22.9620, -43.1670, 500),
        (carlos, "Pinheiros", PostCategory.RECOMENDACAO, "Hamburgueria nova valeu a pena",
         "Testei ontem a hamburgueria que abriu na Rua dos Pinheiros. Blend na medida certa e batata rústica excelente. Recomendo!",
         "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600", False, -23.5658, -46.7005, 90),
        (carlos, "Pinheiros", PostCategory.SEGURANCA, "Iluminação apagada na Rua Teodoro Sampaio",
         "Faz uns dias que dois postes estão apagados perto do metrô. Já registrei reclamação na Enel, protocolo em anexo se alguém precisar.",
         None, True, -23.5610, -46.6980, 240),
        (roberto, "Jardins", PostCategory.VENDA, "Mesa de jantar 6 lugares — R$ 950",
         "Mesa de madeira maciça, 6 lugares, pouco uso. Retirada na Rua Oscar Freire. Fotos reais, sem intermediário.",
         "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600", False, -23.5665, -46.6690, 400),
        (roberto, "Jardins", PostCategory.AJUDA, "Recomendação de eletricista de confiança?",
         "Preciso trocar o quadro de disjuntores do apê. Alguém tem um eletricista de confiança pra indicar aqui nos Jardins?",
         None, False, -23.5695, -46.6705, 60),
        (julia, "Copacabana", PostCategory.EVENTO, "Roda de samba na Praça do Lido",
         "Domingo à tarde tem roda de samba de graça na Praça do Lido, a partir das 16h. Levem cadeira de praia!",
         "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=600", False, -22.9695, -43.1840, 150),
        (fernando, "Botafogo", PostCategory.PETS, "Gato sumido perto do shopping",
         "Nosso gato Mingau fugiu de casa perto do Botafogo Praia Shopping. É cinza com uma mancha branca no peito. Recompensa!",
         "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=600", True, -22.9515, -43.1815, 20),
        (camila, "Urca", PostCategory.RECOMENDACAO, "Trilha do Morro da Urca hoje de manhã",
         "Fui fazer a trilha hoje cedo e a vista estava impecável, céu limpo. Melhor horário é antes das 8h pra fugir do sol forte.",
         "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600", False, -22.9485, -43.1645, 600),
        (rafael, "Ipanema", PostCategory.AVISO, "Obra no calçadão da Vieira Souto",
         "Começou hoje o reparo do calçadão em frente ao posto 9. Um trecho está interditado, atenção quem for correr por lá.",
         None, True, -22.9845, -43.2080, 80),
        (patricia, "Vila Madalena", PostCategory.VENDA, "Bicicleta urbana — R$ 700",
         "Vendo bike urbana, poucos meses de uso, com cesta e farol. Ideal pra andar pela Vila. Aceito propostas.",
         "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600", False, -23.5510, -46.6905, 350),
        (bruno, "Itaim Bibi", PostCategory.GERAL, "Novo ciclofaixa na Av. Faria Lima",
         "Finalmente inauguraram a ciclofaixa protegida na Faria Lima. Já testei de bike hoje, muito mais seguro que antes!",
         None, False, -23.5810, -46.6770, 200),
        (larissa, "Moema", PostCategory.EVENTO, "Feira gastronômica no Parque Ibirapuera",
         "Esse fim de semana tem feira gastronômica no portão 10 do Ibirapuera. Food trucks, música ao vivo e área kids.",
         "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600", False, -23.5920, -46.6580, 30),
        (beatriz, "Leme", PostCategory.AJUDA, "Doação de móveis de bebê",
         "Tenho berço e trocador em ótimo estado pra doar, meu filho já cresceu. Quem tiver interesse, chama no privado.",
         None, False, -22.9642, -43.1666, 700),
    ]

    posts = {}
    for author, neighborhood, cat, title, content, img, important, lat, lon, mins in posts_spec:
        p = Post(
            author_id=author.id, neighborhood=neighborhood, category=cat,
            title=title, content=content,
            media=[{"url": img, "type": "image"}] if img else [],
            important=important, created_at=ago(mins),
            latitude=lat, longitude=lon,
        )
        db.add(p)
        posts[title] = p
    db.flush()

    # (título, autor, conteúdo, min_atrás)
    comments_spec = [
        (MARKER_TITLE, francisco, "Boa iniciativa, vou levar a família!", 40),
        (MARKER_TITLE, ana, "Já quero ir esse sábado 🏐", 35),
        ("Chaveiro perdido na praia", beatriz, "Vou perguntar no quiosque se acharam.", 100),
        ("Hamburgueria nova valeu a pena", roberto, "Vou lá hoje, obrigado pela dica!", 70),
        ("Iluminação apagada na Rua Teodoro Sampaio", beatriz, "Também notei, bom que já foi registrado.", 200),
        ("Gato sumido perto do shopping", julia, "Torcendo pra ele aparecer logo 🙏", 15),
        ("Obra no calçadão da Vieira Souto", patricia, "Valeu pelo aviso, ia correr por lá amanhã.", 60),
    ]
    for post_title, author, content, mins in comments_spec:
        db.add(Comment(post_id=posts[post_title].id, author_id=author.id,
                       content=content, created_at=ago(mins)))

    # (título, [usuários que curtiram])
    likes_spec = [
        (MARKER_TITLE, [francisco, ana, thiago]),
        ("Chaveiro perdido na praia", [mariana, beatriz]),
        ("Reforma da praça está ficando ótima", [ana, mariana, thiago]),
        ("Coleta de recicláveis muda de dia", [francisco, mariana]),
        ("Hamburgueria nova valeu a pena", [roberto]),
        ("Iluminação apagada na Rua Teodoro Sampaio", [beatriz]),
        ("Mesa de jantar 6 lugares — R$ 950", [carlos]),
        ("Roda de samba na Praça do Lido", [fernando, camila]),
        ("Gato sumido perto do shopping", [julia, camila]),
        ("Trilha do Morro da Urca hoje de manhã", [rafael, julia]),
        ("Obra no calçadão da Vieira Souto", [patricia, bruno]),
        ("Bicicleta urbana — R$ 700", [larissa]),
        ("Novo ciclofaixa na Av. Faria Lima", [patricia, larissa]),
        ("Feira gastronômica no Parque Ibirapuera", [bruno]),
    ]
    for post_title, users in likes_spec:
        for u in users:
            db.add(PostLike(post_id=posts[post_title].id, user_id=u.id))

    db.flush()

    # Recalcula contagens derivadas
    for p in db.query(Post).all():
        p.likes_count = db.query(PostLike).filter(PostLike.post_id == p.id).count()
        p.comments_count = db.query(Comment).filter(Comment.post_id == p.id).count()
    for u in db.query(User).all():
        u.posts_count = db.query(Post).filter(Post.author_id == u.id).count()
        u.comments_count = db.query(Comment).filter(Comment.author_id == u.id).count()

    db.commit()

    print(f"✅ {len(posts_spec)} posts extras inseridos.")
    print(f"   Posts totais: {db.query(Post).count()}")
    db.close()


if __name__ == "__main__":
    seed()
