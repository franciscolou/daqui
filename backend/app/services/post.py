from datetime import date

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.uploads import save_data_url_image
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostFeed, PostOut
from app.services import geo


def _to_schema(post: Post, viewer: User, db: Session) -> PostOut:
    liked = post_dao.get_like(db, post.id, viewer.id) is not None
    return PostOut(
        id=post.id,
        category=post.category,
        title=post.title,
        content=post.content,
        image_url=post.image_url,
        details=post.details,
        neighborhood=post.neighborhood,
        location=post.location,
        latitude=post.latitude,
        longitude=post.longitude,
        likes_count=post.likes_count,
        comments_count=post.comments_count,
        shares_count=post.shares_count,
        important=post.important,
        pinned=post.pinned,
        created_at=post.created_at,
        author=post.author,
        liked=liked,
    )


def get_feed(
    db: Session,
    user: User,
    category: str | None,
    page: int,
    page_size: int,
) -> PostFeed:
    offset = (page - 1) * page_size
    posts = post_dao.list_feed(db, user.neighborhood, category, offset, page_size)
    total = post_dao.count_feed(db, user.neighborhood, category)
    return PostFeed(
        items=[_to_schema(p, user, db) for p in posts],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_top_important(db: Session, viewer: User) -> PostOut | None:
    post = post_dao.top_important(db, viewer.neighborhood)
    if not post:
        return None
    return _to_schema(post, viewer, db)


def list_by_author(db: Session, author_id: int, viewer: User) -> list[PostOut]:
    author = user_dao.get_by_id(db, author_id)
    # Perfis de outro bairro são bloqueados: não expõem os posts.
    if not author or author.neighborhood != viewer.neighborhood:
        return []
    posts = post_dao.list_by_author(db, author_id)
    return [_to_schema(p, viewer, db) for p in posts]


def get_map_posts(db: Session, viewer: User) -> list[PostOut]:
    posts = post_dao.list_map(db, viewer.neighborhood)
    return [_to_schema(p, viewer, db) for p in posts]


def get_post(db: Session, post_id: int, viewer: User) -> PostOut:
    post = post_dao.get_by_id(db, post_id)
    # Isolamento: só é possível ver posts do próprio bairro (404 não vaza a existência).
    if not post or post.neighborhood != viewer.neighborhood:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return _to_schema(post, viewer, db)


def _clean_str(value) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _build_details(category: str, raw: dict | None) -> dict | None:
    """Valida e normaliza os campos específicos da categoria.

    Mantém apenas as chaves relevantes; levanta HTTPException 400 quando faltam
    campos obrigatórios (preço em vendas, datas em eventos).
    """
    raw = raw or {}

    if category == "evento":
        dates = raw.get("event_dates")
        if not isinstance(dates, list) or not dates:
            raise HTTPException(status_code=400, detail="Selecione ao menos uma data para o evento")
        today = date.today().isoformat()
        clean_dates: list[str] = []
        for d in dates:
            if not isinstance(d, str):
                raise HTTPException(status_code=400, detail="Data inválida")
            try:
                date.fromisoformat(d)
            except ValueError:
                raise HTTPException(status_code=400, detail="Data inválida") from None
            if d < today:
                raise HTTPException(status_code=400, detail="As datas devem ser a partir de hoje")
            clean_dates.append(d)
        all_day = bool(raw.get("all_day"))
        event_time = None if all_day else _clean_str(raw.get("event_time"))
        return {
            "event_dates": sorted(clean_dates),
            "all_day": all_day,
            "event_time": event_time,
            "location": _clean_str(raw.get("location")),
        }

    if category == "recomendacao":
        return {
            "place_name": _clean_str(raw.get("place_name")),
            "location": _clean_str(raw.get("location")),
        }

    if category == "venda":
        negotiable = bool(raw.get("price_negotiable"))
        price = raw.get("price")
        if not negotiable:
            if price is None or not isinstance(price, (int, float)) or price < 0:
                raise HTTPException(
                    status_code=400,
                    detail='Informe um preço válido ou marque "Negociável"',
                )
        return {
            "price": None if negotiable else float(price),
            "price_negotiable": negotiable,
            "location": _clean_str(raw.get("location")),
        }

    if category == "perdidos":
        return {"location": _clean_str(raw.get("location"))}

    return None


def create_post(db: Session, user: User, payload: PostCreate, base_url: str) -> PostOut:
    details = _build_details(payload.category, payload.details)

    image_url = payload.image_url
    if payload.image:
        image_url = save_data_url_image(base_url, payload.image, prefix="post")

    # Local: quando informado, precisa ser um endereço válido dentro do bairro.
    location = (details or {}).get("location") if details else None
    latitude = longitude = None
    if location:
        geo_result = geo.geocode_within(location, user.neighborhood)
        latitude = geo_result["latitude"]
        longitude = geo_result["longitude"]

    post = post_dao.create(
        db,
        author_id=user.id,
        category=payload.category,
        title=payload.title,
        content=payload.content,
        image_url=image_url,
        details=details,
        important=payload.important,
        neighborhood=user.neighborhood,
        location=location,
        latitude=latitude,
        longitude=longitude,
    )
    user_dao.update(db, user, {"posts_count": user.posts_count + 1})
    return _to_schema(post, user, db)


def toggle_like(db: Session, post_id: int, user: User) -> PostOut:
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    existing = post_dao.get_like(db, post_id, user.id)
    if existing:
        post_dao.remove_like(db, existing)
        post.likes_count = max(0, post.likes_count - 1)
    else:
        post_dao.add_like(db, post_id, user.id)
        post.likes_count += 1

    db.commit()
    db.refresh(post)
    return _to_schema(post, user, db)


def delete_post(db: Session, post_id: int, user: User) -> None:
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    post_dao.delete(db, post)
    user_dao.update(db, user, {"posts_count": max(0, user.posts_count - 1)})
