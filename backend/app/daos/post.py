import math
from datetime import datetime

from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from app.models.post import (
    PollOption,
    PollVote,
    Post,
    PostCategory,
    PostLike,
    PostRepost,
)
from app.models.user import User


def get_by_id(db: Session, post_id: int) -> Post | None:
    return db.query(Post).filter(Post.id == post_id, Post.moderation_deleted_at.is_(None)).first()


def get_by_id_including_deleted(db: Session, post_id: int) -> Post | None:
    return db.get(Post, post_id)


def get_by_public_id(db: Session, public_id: str) -> Post | None:
    return db.query(Post).filter(Post.public_id == public_id, Post.moderation_deleted_at.is_(None)).first()


def list_feed(
    db: Session,
    neighborhoods: list[str],
    category: PostCategory | None,
    offset: int,
    limit: int,
) -> list[Post]:
    q = db.query(Post).filter(Post.neighborhood.in_(neighborhoods), Post.moderation_deleted_at.is_(None))
    if category:
        q = q.filter(Post.category == category)
    return (
        q.order_by(desc(Post.pinned), desc(Post.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )


def list_feed_all(db: Session, neighborhoods: list[str], category: PostCategory | None) -> list[Post]:
    """Mesma query de `list_feed`, sem paginação — usada por `get_feed` pra
    mesclar com reposts em Python antes de paginar (ver `list_reposts_for_feed`)."""
    q = db.query(Post).filter(Post.neighborhood.in_(neighborhoods), Post.moderation_deleted_at.is_(None))
    if category:
        q = q.filter(Post.category == category)
    return q.order_by(desc(Post.pinned), desc(Post.created_at)).all()


def list_reposts_for_feed(
    db: Session, neighborhoods: list[str], category: PostCategory | None
) -> list[tuple[Post, User, datetime]]:
    """Reposts simples (sem citação) entregues ao feed de bairro de quem
    repostou — mesmo critério de um post normal (bairro + categoria), mas
    usando o bairro de quem DEU O REPOST, não o bairro original do post: é
    o repostador quem está publicando de novo pros vizinhos dele, estilo
    retweet do Twitter. Exclui repost do próprio post (já aparece via
    `list_feed_all`, duplicaria)."""
    q = (
        db.query(Post, User, PostRepost.created_at)
        .join(PostRepost, PostRepost.post_id == Post.id)
        .join(User, User.id == PostRepost.user_id)
        .filter(User.neighborhood.in_(neighborhoods), Post.author_id != PostRepost.user_id)
        .filter(Post.moderation_deleted_at.is_(None))
    )
    if category:
        q = q.filter(Post.category == category)
    return [(post, reposter, reposted_at) for post, reposter, reposted_at in q.all()]


def top_important(db: Session, neighborhood: str) -> Post | None:
    return (
        db.query(Post)
        .filter(Post.neighborhood == neighborhood, Post.important.is_(True), Post.moderation_deleted_at.is_(None))
        .order_by(
            desc(Post.likes_count + Post.comments_count + Post.shares_count),
            desc(Post.created_at),
        )
        .first()
    )


def search(db: Session, neighborhood: str, query: str, limit: int = 30) -> list[Post]:
    like = f"%{query}%"
    return (
        db.query(Post)
        .join(User, Post.author_id == User.id)
        .filter(
            Post.neighborhood == neighborhood,
            Post.moderation_deleted_at.is_(None),
            User.searchable.is_(True),
            or_(
                Post.title.ilike(like),
                Post.content.ilike(like),
                User.name.ilike(like),
            ),
        )
        .order_by(
            desc(Post.likes_count + Post.comments_count + Post.shares_count),
            desc(Post.created_at),
        )
        .limit(limit)
        .all()
    )


def list_map(
    db: Session,
    min_lat: float,
    max_lat: float,
    min_lng: float,
    max_lng: float,
    limit: int = 300,
) -> list[Post]:
    # Posts com coordenadas dentro do recorte visível do mapa — sem filtro de
    # bairro (o mapa mostra tudo que está na área que o usuário está vendo,
    # ver services/post.py::get_map_posts). Sem suporte a bbox cruzando o
    # antimeridiano (irrelevante pro Brasil).
    return (
        db.query(Post)
        .filter(
            Post.latitude.isnot(None),
            Post.moderation_deleted_at.is_(None),
            Post.latitude.between(min_lat, max_lat),
            Post.longitude.between(min_lng, max_lng),
        )
        .order_by(desc(Post.created_at))
        .limit(limit)
        .all()
    )


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    # Mesmo cálculo de `daos/ad.py::_haversine_km` — duplicado de propósito
    # (não há um módulo compartilhado de matemática geo no projeto ainda).
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def list_venda_public_radius(
    db: Session,
    center_lat: float,
    center_lng: float,
    radius_km: float,
    exclude_ids: set[int],
) -> list[Post]:
    """Posts de Vendas com `details.visibility == "public"` dentro de
    `radius_km` de `center_lat`/`center_lng` — usados por `get_feed` pra
    estender o alcance de Vendas além do bairro (ver services/post.py::get_feed).
    Pré-filtro por bounding box (mesmo espírito de `list_map`), raio exato
    resolvido em Python via haversine (SQLite não tem trig nativa performática
    — mesma resolução "em Python" do resto deste arquivo)."""
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * max(math.cos(math.radians(center_lat)), 0.01))
    candidates = (
        db.query(Post)
        .filter(
            Post.category == PostCategory.VENDA,
            Post.moderation_deleted_at.is_(None),
            Post.latitude.isnot(None),
            Post.longitude.isnot(None),
            Post.latitude.between(center_lat - lat_delta, center_lat + lat_delta),
            Post.longitude.between(center_lng - lng_delta, center_lng + lng_delta),
        )
        .all()
    )
    result = []
    for post in candidates:
        if post.id in exclude_ids:
            continue
        if (post.details or {}).get("visibility") != "public":
            continue
        if _haversine_km(center_lat, center_lng, post.latitude, post.longitude) <= radius_km:
            result.append(post)
    return result


def list_by_author(db: Session, author_id: int) -> list[Post]:
    return (
        db.query(Post)
        .filter(Post.author_id == author_id, Post.moderation_deleted_at.is_(None))
        .order_by(desc(Post.created_at))
        .all()
    )


def count_by_author(db: Session, author_id: int) -> int:
    return db.query(Post).filter(Post.author_id == author_id, Post.moderation_deleted_at.is_(None)).count()


def list_reposted_by_author(db: Session, author_id: int) -> list[tuple[Post, datetime]]:
    """Posts de OUTROS autores que `author_id` deu repost simples (sem
    citação) — usados pra compor a timeline do perfil estilo "fulano
    repostou" (ver services/post.py::list_by_author). Exclui repost do
    próprio post (já apareceria via list_by_author, seria duplicado)."""
    rows = (
        db.query(Post, PostRepost.created_at)
        .join(PostRepost, PostRepost.post_id == Post.id)
        .filter(PostRepost.user_id == author_id, Post.author_id != author_id, Post.moderation_deleted_at.is_(None))
        .order_by(desc(PostRepost.created_at))
        .all()
    )
    return [(post, reposted_at) for post, reposted_at in rows]


def count_important_since(db: Session, author_id: int, since: datetime) -> int:
    """Quantos posts marcados como importantes o autor já publicou a partir de
    `since` (usado pra limitar posts importantes por mês, ver services/post.py)."""
    return (
        db.query(Post)
        .filter(
            Post.author_id == author_id,
            Post.important.is_(True),
            Post.created_at >= since,
            Post.moderation_deleted_at.is_(None),
        )
        .count()
    )


def count_feed(db: Session, neighborhoods: list[str], category: PostCategory | None) -> int:
    q = db.query(Post).filter(Post.neighborhood.in_(neighborhoods), Post.moderation_deleted_at.is_(None))
    if category:
        q = q.filter(Post.category == category)
    return q.count()


def create(
    db: Session,
    *,
    author_id: int,
    category: PostCategory,
    title: str | None,
    product_name: str | None = None,
    content: str,
    media: list[dict],
    details: dict | None,
    important: bool,
    neighborhood: str,
    location: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    quoted_post_id: int | None = None,
    quoted_comment_id: int | None = None,
    quoted_ad_id: int | None = None,
) -> Post:
    post = Post(
        author_id=author_id,
        category=category,
        title=title,
        product_name=product_name,
        content=content,
        media=media,
        details=details,
        important=important,
        neighborhood=neighborhood,
        location=location,
        latitude=latitude,
        longitude=longitude,
        quoted_post_id=quoted_post_id,
        quoted_comment_id=quoted_comment_id,
        quoted_ad_id=quoted_ad_id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


def delete(db: Session, post: Post) -> None:
    db.delete(post)
    db.commit()


def get_like(db: Session, post_id: int, user_id: int) -> PostLike | None:
    return (
        db.query(PostLike)
        .filter(PostLike.post_id == post_id, PostLike.user_id == user_id)
        .first()
    )


def add_like(db: Session, post_id: int, user_id: int) -> None:
    db.add(PostLike(post_id=post_id, user_id=user_id))


def remove_like(db: Session, like: PostLike) -> None:
    db.delete(like)


def count_likers(db: Session, post_id: int, exclude_user_id: int | None = None) -> int:
    q = db.query(func.count(PostLike.id)).filter(PostLike.post_id == post_id)
    if exclude_user_id is not None:
        q = q.filter(PostLike.user_id != exclude_user_id)
    return q.scalar() or 0


def list_likers(db: Session, post_id: int) -> list[User]:
    """Quem curtiu o post, curtida mais recente primeiro — usado no modal
    "Curtidas" da tela de detalhe do post."""
    return (
        db.query(User)
        .join(PostLike, PostLike.user_id == User.id)
        .filter(PostLike.post_id == post_id)
        .order_by(desc(PostLike.created_at))
        .all()
    )


# ── Repost simples (sem citação) ─────────────────────────────────────
def get_repost(db: Session, post_id: int, user_id: int) -> PostRepost | None:
    return (
        db.query(PostRepost)
        .filter(PostRepost.post_id == post_id, PostRepost.user_id == user_id)
        .first()
    )


def add_repost(db: Session, post_id: int, user_id: int) -> None:
    db.add(PostRepost(post_id=post_id, user_id=user_id))


def remove_repost(db: Session, repost: PostRepost) -> None:
    db.delete(repost)


def count_quotes_by_author(db: Session, post_id: int, author_id: int) -> int:
    """Quantas vezes o usuário já citou este post (posts próprios com
    quoted_post_id apontando pra ele) — usado só pra decidir o estado do botão."""
    return (
        db.query(Post)
        .filter(Post.quoted_post_id == post_id, Post.author_id == author_id)
        .count()
    )


# ── Enquete ───────────────────────────────────────────────────────────
def add_poll_option(db: Session, post_id: int, text: str, position: int) -> PollOption:
    option = PollOption(post_id=post_id, text=text, position=position, votes_count=0)
    db.add(option)
    return option


def get_option(db: Session, option_id: int) -> PollOption | None:
    return db.get(PollOption, option_id)


def delete_poll_option(db: Session, option: PollOption) -> None:
    # Remove também os votos ligados a essa opção (cascade da relação).
    db.delete(option)


def get_user_votes(db: Session, post_id: int, user_id: int) -> list[int]:
    rows = (
        db.query(PollVote.option_id)
        .filter(PollVote.post_id == post_id, PollVote.user_id == user_id)
        .all()
    )
    return [r[0] for r in rows]


def clear_user_votes(db: Session, post_id: int, user_id: int) -> None:
    db.query(PollVote).filter(
        PollVote.post_id == post_id, PollVote.user_id == user_id
    ).delete()


def add_vote(db: Session, post_id: int, option_id: int, user_id: int) -> None:
    db.add(PollVote(post_id=post_id, option_id=option_id, user_id=user_id))


def recount_options(db: Session, post: Post) -> None:
    """Recalcula votes_count de cada opção a partir da tabela de votos."""
    counts = dict(
        db.query(PollVote.option_id, func.count(PollVote.id))
        .filter(PollVote.post_id == post.id)
        .group_by(PollVote.option_id)
        .all()
    )
    for opt in post.poll_options:
        opt.votes_count = counts.get(opt.id, 0)
