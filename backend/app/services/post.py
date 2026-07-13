from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core import realtime_registry
from app.core.uploads import save_data_url_image
from app.daos import notification as notification_dao
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.audit_log import ACTION_POST_DELETE
from app.models.notification import TYPE_POST_REMOVED
from app.models.post import Post
from app.models.user import User
from app.schemas.post import (
    PollCreate,
    PollOptionOut,
    PollOut,
    PollUpdate,
    PostCreate,
    PostFeed,
    PostOut,
    PostUpdate,
)
from app.services import audit_log as audit_log_service
from app.services import geo


def _aware(dt: datetime) -> datetime:
    """Garante datetime tz-aware (SQLite pode devolver naive)."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _poll_schema(post: Post, viewer: User, db: Session) -> PollOut | None:
    if post.category != "enquete" or post.poll_closes_at is None:
        return None
    my_votes = post_dao.get_user_votes(db, post.id, viewer.id)
    options = [
        PollOptionOut(id=o.id, text=o.text, votes_count=o.votes_count)
        for o in post.poll_options
    ]
    closes_at = _aware(post.poll_closes_at)
    return PollOut(
        multiple=bool(post.poll_multiple),
        closes_at=closes_at,
        closed=datetime.now(timezone.utc) >= closes_at,
        total_votes=sum(o.votes_count for o in options),
        options=options,
        my_votes=my_votes,
    )


def _to_schema(post: Post, viewer: User, db: Session) -> PostOut:
    liked = post_dao.get_like(db, post.id, viewer.id) is not None
    # Morador: o bairro atual do autor ainda é o mesmo em que o post foi publicado
    # (se o autor mudar de bairro depois, o selo some dos posts antigos).
    author_is_resident = bool(post.neighborhood) and post.author.neighborhood == post.neighborhood
    return PostOut(
        id=post.id,
        category=post.category,
        title=post.title,
        content=post.content,
        image_urls=post.image_urls or [],
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
        author_is_resident=author_is_resident,
        liked=liked,
        poll=_poll_schema(post, viewer, db),
    )


def get_feed(
    db: Session,
    user: User,
    category: str | None,
    page: int,
    page_size: int,
    neighborhood: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    include_nearby: bool = False,
) -> PostFeed:
    # Bairro em foco: o cadastrado ("Meu bairro") ou o informado pelo cliente
    # ("Perto de mim", resolvido pelo GPS atual).
    center = neighborhood or user.neighborhood
    neighborhoods = [center]
    if include_nearby:
        # Para as redondezas precisamos de um ponto; usa o informado ou, na
        # falta, a localização cadastrada do usuário.
        lat = latitude if latitude is not None else user.latitude
        lon = longitude if longitude is not None else user.longitude
        if lat is not None and lon is not None:
            nearby = geo.neighborhoods_around(lat, lon)
            # Preserva o bairro em foco no topo e acrescenta os vizinhos (sem duplicar).
            for name in nearby:
                if name and name not in neighborhoods:
                    neighborhoods.append(name)

    offset = (page - 1) * page_size
    posts = post_dao.list_feed(db, neighborhoods, category, offset, page_size)
    total = post_dao.count_feed(db, neighborhoods, category)
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
    if not author:
        return []
    posts = post_dao.list_by_author(db, author_id)
    return [_to_schema(p, viewer, db) for p in posts]


def get_map_posts(db: Session, viewer: User) -> list[PostOut]:
    posts = post_dao.list_map(db, viewer.neighborhood)
    return [_to_schema(p, viewer, db) for p in posts]


def get_post(db: Session, post_id: int, viewer: User) -> PostOut:
    post = post_dao.get_by_id(db, post_id)
    # Qualquer usuário pode abrir qualquer post — o isolamento fica só no feed,
    # que não exibe posts de outros bairros espontaneamente.
    if not post:
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


def _clean_options(options: list[str]) -> list[str]:
    """Normaliza e valida as opções da enquete (≥ 2, não vazias, sem duplicatas)."""
    cleaned: list[str] = []
    seen: set[str] = set()
    for opt in options:
        text = (opt or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(text[:200])
    if len(cleaned) < 2:
        raise HTTPException(status_code=400, detail="A enquete precisa de ao menos 2 opções")
    if len(cleaned) > 10:
        raise HTTPException(status_code=400, detail="A enquete pode ter no máximo 10 opções")
    return cleaned


def _validate_closes_at(closes_at: datetime) -> datetime:
    closes_at = _aware(closes_at)
    if closes_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400, detail="O prazo de encerramento deve estar no futuro"
        )
    return closes_at


def create_post(db: Session, user: User, payload: PostCreate, base_url: str) -> PostOut:
    is_poll = payload.category == "enquete"
    if is_poll and payload.poll is None:
        raise HTTPException(status_code=400, detail="Configure a enquete")

    poll_options = poll_closes_at = poll_multiple = None
    if is_poll:
        poll_options = _clean_options(payload.poll.options)
        poll_closes_at = _validate_closes_at(payload.poll.closes_at)
        poll_multiple = bool(payload.poll.multiple)

    details = None if is_poll else _build_details(payload.category, payload.details)

    if len(payload.images) > 10:
        raise HTTPException(status_code=400, detail="No máximo 10 fotos por post")
    image_urls = [save_data_url_image(base_url, img, prefix="post") for img in payload.images]

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
        image_urls=image_urls,
        details=details,
        important=payload.important,
        neighborhood=user.neighborhood,
        location=location,
        latitude=latitude,
        longitude=longitude,
    )

    if is_poll:
        post.poll_multiple = poll_multiple
        post.poll_closes_at = poll_closes_at
        for i, text in enumerate(poll_options):
            post_dao.add_poll_option(db, post.id, text, i)
        db.commit()
        db.refresh(post)

    user_dao.update(db, user, {"posts_count": post_dao.count_by_author(db, user.id)})
    return _to_schema(post, user, db)


def update_post(db: Session, post_id: int, user: User, payload: PostUpdate) -> PostOut:
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    if payload.title is not None:
        post.title = payload.title.strip() or None
    if payload.content is not None:
        content = payload.content.strip()
        if not content:
            raise HTTPException(status_code=400, detail="A mensagem não pode ficar vazia")
        post.content = content

    if payload.poll is not None:
        if post.category != "enquete":
            raise HTTPException(status_code=400, detail="Este post não é uma enquete")
        _apply_poll_update(db, post, payload.poll)

    db.commit()
    db.refresh(post)
    return _to_schema(post, user, db)


def _apply_poll_update(db: Session, post: Post, poll: PollUpdate) -> None:
    # Prazo sempre para o futuro; múltiplos votos configurável.
    post.poll_closes_at = _validate_closes_at(poll.closes_at)
    post.poll_multiple = bool(poll.multiple)

    # Normaliza opções: mantém as com id (preservando votos), cria novas, remove ausentes.
    existing = {o.id: o for o in post.poll_options}
    kept_ids: set[int] = set()
    normalized: list[tuple[int | None, str]] = []
    seen: set[str] = set()
    for item in poll.options:
        text = (item.text or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append((item.id, text[:200]))
    if len(normalized) < 2:
        raise HTTPException(status_code=400, detail="A enquete precisa de ao menos 2 opções")
    if len(normalized) > 10:
        raise HTTPException(status_code=400, detail="A enquete pode ter no máximo 10 opções")

    for position, (opt_id, text) in enumerate(normalized):
        if opt_id is not None and opt_id in existing:
            opt = existing[opt_id]
            opt.text = text
            opt.position = position
            kept_ids.add(opt_id)
        else:
            post_dao.add_poll_option(db, post.id, text, position)

    # Remove opções que saíram (e seus votos, via cascade).
    for opt in list(post.poll_options):
        if opt.id not in kept_ids and opt.id in existing:
            post_dao.delete_poll_option(db, opt)

    db.flush()
    db.refresh(post)
    post_dao.recount_options(db, post)


def vote_poll(db: Session, post_id: int, user: User, option_ids: list[int]) -> PostOut:
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post.category != "enquete" or post.poll_closes_at is None:
        raise HTTPException(status_code=400, detail="Este post não é uma enquete")
    if datetime.now(timezone.utc) >= _aware(post.poll_closes_at):
        raise HTTPException(status_code=400, detail="Esta enquete já encerrou")

    valid_ids = {o.id for o in post.poll_options}
    chosen = [oid for oid in dict.fromkeys(option_ids) if oid in valid_ids]
    if not chosen:
        raise HTTPException(status_code=400, detail="Selecione uma opção válida")
    if not post.poll_multiple and len(chosen) > 1:
        raise HTTPException(status_code=400, detail="Esta enquete permite apenas um voto")

    # Substitui os votos do usuário pelo novo conjunto e recalcula os totais.
    post_dao.clear_user_votes(db, post.id, user.id)
    for oid in chosen:
        post_dao.add_vote(db, post.id, oid, user.id)
    db.flush()
    post_dao.recount_options(db, post)
    db.commit()
    db.refresh(post)
    return _to_schema(post, user, db)


def unvote_poll(db: Session, post_id: int, user: User) -> PostOut:
    """Remove o(s) voto(s) do usuário na enquete (desvotar)."""
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post.category != "enquete" or post.poll_closes_at is None:
        raise HTTPException(status_code=400, detail="Este post não é uma enquete")
    if datetime.now(timezone.utc) >= _aware(post.poll_closes_at):
        raise HTTPException(status_code=400, detail="Esta enquete já encerrou")

    post_dao.clear_user_votes(db, post.id, user.id)
    db.flush()
    post_dao.recount_options(db, post)
    db.commit()
    db.refresh(post)
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
    user_dao.update(db, user, {"posts_count": post_dao.count_by_author(db, user.id)})


# ── Moderação ─────────────────────────────────────────────────────────
def admin_list_by_author(db: Session, author_id: int, moderator: User) -> list[PostOut]:
    # Moderador enxerga os posts do usuário independente de bairro/bloqueio.
    posts = post_dao.list_by_author(db, author_id)
    return [_to_schema(p, moderator, db) for p in posts]


def admin_delete_post(db: Session, post_id: int, moderator: User) -> None:
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    author_id = post.author_id
    content_preview = post.content[:200]
    snapshot = {
        "category": post.category,
        "title": post.title,
        "content": post.content,
        "image_url": (post.image_urls or [None])[0],
        "location": post.location,
        "created_at": post.created_at.isoformat(),
    }
    author = user_dao.get_by_id(db, author_id)
    post_dao.delete(db, post)
    if author:
        user_dao.update(db, author, {"posts_count": post_dao.count_by_author(db, author.id)})
    notification_dao.create(
        db,
        user_id=author_id,
        type_=TYPE_POST_REMOVED,
        content="Seu post foi removido pela moderação por não seguir as diretrizes da comunidade.",
        target_text=content_preview,
        snapshot=snapshot,
    )
    realtime_registry.wake(author_id)
    audit_log_service.log(db, moderator, ACTION_POST_DELETE, author_id, content_preview)
