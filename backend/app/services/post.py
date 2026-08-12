import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import (
    FEED_AUTHOR_AFFINITY_BOOST_WEIGHT,
    FEED_AUTHOR_AFFINITY_DM_BONUS,
    FEED_AUTHOR_AFFINITY_GROUP_BONUS,
    FEED_AUTHOR_AFFINITY_WEIGHT_COMMENT,
    FEED_AUTHOR_AFFINITY_WEIGHT_LIKE,
    FEED_AUTHOR_AFFINITY_WEIGHT_SHARE,
    FEED_CATEGORY_AFFINITY_BOOST_WEIGHT,
    FEED_ENGAGEMENT_WEIGHT_COMMENT,
    FEED_ENGAGEMENT_WEIGHT_LIKE,
    FEED_ENGAGEMENT_WEIGHT_SHARE,
    FEED_PERSONALIZATION_LOOKBACK_DAYS,
    FEED_PERSONALIZATION_MAX_BOOST,
    FEED_POPULARITY_BOOST_WEIGHT,
    FEED_RECENCY_HALF_LIFE_HOURS,
    LIKE_MERGE_THRESHOLD,
    MAX_IMPORTANT_POSTS_PER_MONTH,
    MAX_MEDIA_ITEMS,
    SALE_MIN_PHOTOS,
    SALE_PRODUCT_NAME_MAX_LENGTH,
)
from app.core.uploads import MediaType, save_upload_media
from app.daos import comment as comment_dao
from app.daos import group as group_dao
from app.daos import message as message_dao
from app.daos import post as post_dao
from app.daos import user as user_dao
from app.models.audit_log import AuditLogAction
from app.models.notification import NotificationType
from app.models.post import Post, PostCategory
from app.models.user import User
from app.schemas.message import SharedCommentOut, SharedPostOut
from app.schemas.post import (
    ImportantQuota,
    PollOptionOut,
    PollOut,
    PollUpdate,
    PostCreate,
    PostFeed,
    PostMediaItem,
    PostOut,
    PostUpdate,
)
from app.services import audit_log as audit_log_service
from app.services import geo, mentions
from app.services import notification as notification_service


def _aware(dt: datetime) -> datetime:
    """Garante datetime tz-aware (SQLite pode devolver naive)."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _poll_schema(post: Post, viewer: User, db: Session) -> PollOut | None:
    if post.category != PostCategory.ENQUETE or post.poll_closes_at is None:
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


def _to_schema(
    post: Post,
    viewer: User,
    db: Session,
    *,
    reposted_by: User | None = None,
    reposted_at: datetime | None = None,
) -> PostOut:
    liked = post_dao.get_like(db, post.id, viewer.id) is not None
    # "Repostado" cobre tanto o repost simples quanto já ter citado este post
    # (estilo Twitter: o ícone acende nos dois casos).
    reposted = post_dao.get_repost(db, post.id, viewer.id) is not None or (
        post_dao.count_quotes_by_author(db, post.id, viewer.id) > 0
    )
    # Morador: o bairro atual do autor ainda é o mesmo em que o post foi publicado
    # (se o autor mudar de bairro depois, o selo some dos posts antigos). Autor
    # pode desativar o selo por completo em "Ocultar selo de morador".
    author_is_resident = (
        not post.author.hide_resident_badge
        and bool(post.neighborhood)
        and post.author.neighborhood == post.neighborhood
    )
    return PostOut(
        id=post.id,
        public_id=post.public_id,
        category=post.category,
        title=post.title,
        product_name=post.product_name,
        content=post.content,
        media=post.media or [],
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
        created_at=post.created_at,
        author=post.author,
        author_is_resident=author_is_resident,
        liked=liked,
        reposted=reposted,
        quoted_post=SharedPostOut.model_validate(post.quoted_post) if post.quoted_post else None,
        quoted_comment=(
            SharedCommentOut.model_validate(post.quoted_comment) if post.quoted_comment else None
        ),
        quoted_ad_id=post.quoted_ad_id,
        poll=_poll_schema(post, viewer, db),
        reposted_by=reposted_by,
        reposted_at=reposted_at,
    )


def _build_personalization_signals(
    db: Session, user: User
) -> tuple[dict[int, float], dict[str, float]]:
    """Sinal de afinidade do usuário logado por autor e por categoria, a
    partir do que ele mesmo já curtiu/comentou/repostou, com quem já trocou
    DM e com quem compartilha grupo — usado por `_score_post` pra dar um
    empurrão de personalização no feed (ver get_feed). Sem conceito de
    "seguir" no app, então esses são os sinais sociais disponíveis."""
    since = datetime.now(timezone.utc) - timedelta(days=FEED_PERSONALIZATION_LOOKBACK_DAYS)
    likes, comments, reposts = post_dao.engagement_history(db, user.id, since)

    author_affinity: dict[int, float] = defaultdict(float)
    category_affinity: dict[str, float] = defaultdict(float)
    for rows, weight in (
        (likes, FEED_AUTHOR_AFFINITY_WEIGHT_LIKE),
        (comments, FEED_AUTHOR_AFFINITY_WEIGHT_COMMENT),
        (reposts, FEED_AUTHOR_AFFINITY_WEIGHT_SHARE),
    ):
        for author_id, category, count in rows:
            author_affinity[author_id] += count * weight
            category_affinity[category] += count * weight

    dm_contacts = {
        m.receiver_id if m.sender_id == user.id else m.sender_id
        for m in message_dao.get_last_per_conversation(db, user.id)
    }
    for author_id in dm_contacts:
        author_affinity[author_id] += FEED_AUTHOR_AFFINITY_DM_BONUS
    for author_id in group_dao.list_co_member_ids(db, user.id):
        author_affinity[author_id] += FEED_AUTHOR_AFFINITY_GROUP_BONUS

    return author_affinity, category_affinity


def _score_post(
    post: Post,
    effective_date: datetime,
    author_affinity: dict[int, float],
    category_affinity: dict[str, float],
    now: datetime,
) -> float:
    """Ranking do feed: recência (decaimento exponencial) × popularidade ×
    (1 + boost de personalização do usuário logado). Recência e popularidade
    continuam os fatores fortes — a personalização é um teto (ver
    FEED_PERSONALIZATION_MAX_BOOST), não substitui os outros dois."""
    age_hours = max((now - _aware(effective_date)).total_seconds() / 3600.0, 0.0)
    recency = 0.5 ** (age_hours / FEED_RECENCY_HALF_LIFE_HOURS)

    engagement = (
        post.likes_count * FEED_ENGAGEMENT_WEIGHT_LIKE
        + post.comments_count * FEED_ENGAGEMENT_WEIGHT_COMMENT
        + post.shares_count * FEED_ENGAGEMENT_WEIGHT_SHARE
    )
    popularity_boost = math.log1p(engagement) * FEED_POPULARITY_BOOST_WEIGHT

    personalization_boost = min(
        math.log1p(author_affinity.get(post.author_id, 0.0)) * FEED_AUTHOR_AFFINITY_BOOST_WEIGHT
        + math.log1p(category_affinity.get(post.category, 0.0)) * FEED_CATEGORY_AFFINITY_BOOST_WEIGHT,
        FEED_PERSONALIZATION_MAX_BOOST,
    )

    return recency * (1 + popularity_boost) * (1 + personalization_boost)


def get_feed(
    db: Session,
    user: User,
    category: PostCategory | None,
    page: int,
    page_size: int,
    neighborhood: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    include_nearby: bool = False,
    sale_radius_km: float | None = None,
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
            nearby = geo.neighborhoods_around(lat, lon, db)
            # Preserva o bairro em foco no topo e acrescenta os vizinhos (sem duplicar).
            for name in nearby:
                if name and name not in neighborhoods:
                    neighborhoods.append(name)

    # Reposts simples (sem citação) entram no feed igual um post normal, no
    # momento em que o vizinho reposta — ver post_dao.list_reposts_for_feed
    # (entregue pelo bairro de quem repostou, não o bairro original do post).
    # Sem paginação em SQL pros dois lados: mescla tudo em Python por data
    # efetiva (publicação ou repost) e só então corta a página pedida —
    # mesmo espírito de "resolver em Python" já usado noutras queries do
    # projeto por limitação do SQLite.
    own_posts = post_dao.list_feed_all(db, neighborhoods, category)
    reposts = post_dao.list_reposts_for_feed(db, neighborhoods, category)

    # Vendas com raio: estende o alcance além do bairro só pra quem já
    # explicitamente escolheu um raio na tela (ver SaleRadiusModal no front) —
    # sem isso, "Vendas" continua 100% neighborhood-scoped por padrão, igual
    # qualquer outra categoria. Só entram posts com `details.visibility ==
    # "public"` (ver _build_details) e fora do que a query de bairro já trouxe.
    if category == PostCategory.VENDA and sale_radius_km and latitude is not None and longitude is not None:
        exclude_ids = {p.id for p in own_posts}
        own_posts = own_posts + post_dao.list_venda_public_radius(
            db, latitude, longitude, sale_radius_km, exclude_ids
        )

    # Ranking personalizado: recência × popularidade × afinidade do usuário
    # logado com o autor/categoria (ver _score_post) — calculado uma vez por
    # request e aplicado a posts próprios e reposts da mesma forma, já que o
    # que importa pro interesse do usuário é o conteúdo original, não quem
    # repostou.
    now = datetime.now(timezone.utc)
    author_affinity, category_affinity = _build_personalization_signals(db, user)

    items = [
        (_to_schema(p, user, db), _score_post(p, p.created_at, author_affinity, category_affinity, now))
        for p in own_posts
    ] + [
        (
            _to_schema(p, user, db, reposted_by=reposter, reposted_at=reposted_at),
            _score_post(p, reposted_at, author_affinity, category_affinity, now),
        )
        for p, reposter, reposted_at in reposts
    ]
    items.sort(key=lambda item: item[1], reverse=True)
    total = len(items)
    offset = (page - 1) * page_size
    page_items = [schema for schema, _ in items[offset : offset + page_size]]
    return PostFeed(
        items=page_items,
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
    """Timeline do perfil: os posts do próprio autor (inclui citações, que já
    são posts de verdade) + posts de outros autores que ele repostou sem
    citar (estilo "fulano repostou" do Twitter — invisível de outra forma,
    já que um repost simples não cria uma linha em `posts`). Mesclados e
    ordenados pela data "efetiva" de cada item (publicação ou repost)."""
    author = user_dao.get_by_id(db, author_id)
    if not author:
        return []
    own_posts = post_dao.list_by_author(db, author_id)
    reposts = post_dao.list_reposted_by_author(db, author_id)
    items = [(_to_schema(p, viewer, db), p.created_at) for p in own_posts]
    items += [
        (_to_schema(p, viewer, db, reposted_by=author, reposted_at=reposted_at), reposted_at)
        for p, reposted_at in reposts
    ]
    items.sort(key=lambda item: item[1], reverse=True)
    return [schema for schema, _ in items]


def get_map_posts(
    db: Session, viewer: User, min_lat: float, max_lat: float, min_lng: float, max_lng: float
) -> list[PostOut]:
    posts = post_dao.list_map(db, min_lat, max_lat, min_lng, max_lng)
    return [_to_schema(p, viewer, db) for p in posts]


def get_post(db: Session, post_id: int, viewer: User) -> PostOut:
    post = post_dao.get_by_id(db, post_id)
    # Qualquer usuário pode abrir qualquer post — o isolamento fica só no feed,
    # que não exibe posts de outros bairros espontaneamente.
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return _to_schema(post, viewer, db)


def get_post_by_public_id(db: Session, public_id: str, viewer: User) -> PostOut:
    """Resolve a URL pública `/post/{username}/status/{public_id}` — o
    `username` no path é só decorativo (estilo Twitter), a busca é só pelo
    `public_id`, que já identifica o post de forma única."""
    post = post_dao.get_by_public_id(db, public_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return _to_schema(post, viewer, db)


def _clean_str(value) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _build_details(category: PostCategory, raw: dict | None) -> dict | None:
    """Valida e normaliza os campos específicos da categoria.

    Mantém apenas as chaves relevantes; levanta HTTPException 400 quando faltam
    campos obrigatórios (preço em vendas, datas em eventos).
    """
    raw = raw or {}

    if category == PostCategory.EVENTO:
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

    if category == PostCategory.RECOMENDACAO:
        return {
            "place_name": _clean_str(raw.get("place_name")),
            "location": _clean_str(raw.get("location")),
        }

    if category == PostCategory.VENDA:
        negotiable = bool(raw.get("price_negotiable"))
        price = raw.get("price")
        if not negotiable:
            if price is None or not isinstance(price, (int, float)) or price < 0:
                raise HTTPException(
                    status_code=400,
                    detail='Informe um preço válido ou marque "Negociável"',
                )
        # "Visível para qualquer pessoa" (público, dentro do raio escolhido por
        # quem navega) vs. "Apenas no bairro" (default — mesma regra de
        # visibilidade do resto do feed). Qualquer valor desconhecido/ausente
        # cai no default, cobrindo posts antigos e clientes desatualizados.
        visibility = raw.get("visibility") if raw.get("visibility") in ("neighborhood", "public") else "neighborhood"
        return {
            "price": None if negotiable else float(price),
            "price_negotiable": negotiable,
            "visibility": visibility,
            "location": _clean_str(raw.get("location")),
        }

    if category == PostCategory.PERDIDOS:
        return {"location": _clean_str(raw.get("location"))}

    if category == PostCategory.SEGURANCA:
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


def upload_media(user: User, base_url: str, file: UploadFile) -> PostMediaItem:
    url, media_type = save_upload_media(base_url, file, prefix=f"post_{user.id}")
    return PostMediaItem(url=url, type=media_type)


def _current_month_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    """(início do mês corrente, início do próximo mês), ambos em UTC."""
    now = now or datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_start = (
        start.replace(year=start.year + 1, month=1)
        if start.month == 12
        else start.replace(month=start.month + 1)
    )
    return start, next_start


def get_important_quota(db: Session, user: User) -> ImportantQuota:
    """Cota mensal de posts importantes do usuário — consultada pelo app antes
    de publicar, pra desabilitar o toggle sem precisar tentar e falhar."""
    start, next_start = _current_month_bounds()
    used = post_dao.count_important_since(db, user.id, start)
    return ImportantQuota(
        used=used,
        limit=MAX_IMPORTANT_POSTS_PER_MONTH,
        remaining=max(0, MAX_IMPORTANT_POSTS_PER_MONTH - used),
        resets_at=next_start,
    )


def create_post(db: Session, user: User, payload: PostCreate, base_url: str) -> PostOut:
    is_poll = payload.category == PostCategory.ENQUETE
    if is_poll and payload.poll is None:
        raise HTTPException(status_code=400, detail="Configure a enquete")

    # Vendas: título, nome do produto e ao menos uma foto são obrigatórios —
    # diferente das outras categorias, onde só a mensagem costuma ser exigida
    # (ver front, publish.tsx). `product_name` é coluna própria (não entra em
    # `details`), no mesmo nível de `title`.
    product_name = None
    if payload.category == PostCategory.VENDA:
        if not (payload.title or "").strip():
            raise HTTPException(status_code=400, detail="Informe um título para o anúncio")
        product_name = (payload.product_name or "").strip()
        if not product_name:
            raise HTTPException(status_code=400, detail="Informe o nome do produto")
        product_name = product_name[:SALE_PRODUCT_NAME_MAX_LENGTH]
        photo_count = sum(1 for m in payload.media if m.type == MediaType.IMAGE)
        if photo_count < SALE_MIN_PHOTOS:
            raise HTTPException(status_code=400, detail="Adicione ao menos uma foto do produto")

    if payload.important:
        month_start, _ = _current_month_bounds()
        used = post_dao.count_important_since(db, user.id, month_start)
        if used >= MAX_IMPORTANT_POSTS_PER_MONTH:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Você já usou os {MAX_IMPORTANT_POSTS_PER_MONTH} posts importantes "
                    "deste mês. Tente novamente no mês que vem."
                ),
            )

    # Repost com citação: no máximo um dos três, e o alvo (post/comentário)
    # precisa existir. `quoted_ad_id` não é validado — o anúncio vive no
    # ads-backend, serviço separado sem cliente HTTP entre os dois (mesmo
    # tratamento de confiança que Message.shared_ad_id já recebe).
    quoted_targets = [payload.quoted_post_id, payload.quoted_comment_id, payload.quoted_ad_id]
    if sum(1 for t in quoted_targets if t is not None) > 1:
        raise HTTPException(
            status_code=400, detail="Cite um post, um comentário ou um anúncio, não mais de um"
        )
    quoted_post = quoted_comment = None
    if payload.quoted_post_id is not None:
        quoted_post = post_dao.get_by_id(db, payload.quoted_post_id)
        if not quoted_post:
            raise HTTPException(status_code=404, detail="Post citado não encontrado")
    if payload.quoted_comment_id is not None:
        quoted_comment = comment_dao.get_by_id(db, payload.quoted_comment_id)
        if not quoted_comment:
            raise HTTPException(status_code=404, detail="Comentário citado não encontrado")

    poll_options = poll_closes_at = poll_multiple = None
    if is_poll:
        poll_options = _clean_options(payload.poll.options)
        poll_closes_at = _validate_closes_at(payload.poll.closes_at)
        poll_multiple = bool(payload.poll.multiple)

    details = None if is_poll else _build_details(payload.category, payload.details)

    if len(payload.media) > MAX_MEDIA_ITEMS:
        raise HTTPException(
            status_code=400, detail=f"No máximo {MAX_MEDIA_ITEMS} itens de mídia por post"
        )
    media = [m.model_dump() for m in payload.media]

    # Local: quando informado, precisa ser um endereço válido dentro do bairro.
    location = (details or {}).get("location") if details else None
    latitude = longitude = None
    if location:
        if payload.latitude is not None and payload.longitude is not None:
            # Cliente já geocodificou (autocomplete ou pin no mapa, ambos já
            # filtrados pro bairro do usuário na origem) — reaproveita em vez
            # de regeocodificar do zero, o que perderia a precisão do HERE
            # (se foi o provedor da busca original) e pagaria a chamada à toa.
            latitude, longitude = payload.latitude, payload.longitude
        else:
            geo_result = geo.geocode_within(location, user.neighborhood, db)
            latitude = geo_result["latitude"]
            longitude = geo_result["longitude"]

    post = post_dao.create(
        db,
        author_id=user.id,
        category=payload.category,
        title=payload.title,
        product_name=product_name,
        content=payload.content,
        media=media,
        details=details,
        important=payload.important,
        neighborhood=user.neighborhood,
        location=location,
        latitude=latitude,
        longitude=longitude,
        quoted_post_id=quoted_post.id if quoted_post else None,
        quoted_comment_id=quoted_comment.id if quoted_comment else None,
        quoted_ad_id=payload.quoted_ad_id,
    )

    # Citar conta como repost pro alvo (mesmo contador do repost simples).
    # Commitado mais abaixo, junto do recount de posts_count do autor.
    if quoted_post:
        quoted_post.shares_count += 1
    if quoted_comment:
        quoted_comment.reposts_count += 1

    if is_poll:
        post.poll_multiple = poll_multiple
        post.poll_closes_at = poll_closes_at
        for i, text in enumerate(poll_options):
            post_dao.add_poll_option(db, post.id, text, i)
        db.commit()
        db.refresh(post)

    user_dao.update(db, user, {"posts_count": post_dao.count_by_author(db, user.id)})

    # Notifica @menções no corpo (e no título) do post.
    mentions.notify_mentions(
        db, user, f"{post.title or ''} {post.content or ''}", post.id, post.content or post.title or ""
    )

    # Aviso do bairro: só post marcado como importante notifica todos os
    # vizinhos do bairro — e também os moradores das redondezas que ligaram
    # "Incluir redondezas". Categoria (aviso/segurança) não entra mais nisso:
    # sem o flag, o post se comporta como qualquer outro.
    if post.important:
        preview = (post.content or post.title or "")[:200]
        recipients = {
            n.id: n
            for n in user_dao.get_neighbors(db, user.neighborhood, exclude_id=user.id, limit=10_000)
        }
        # Bairros vizinhos: usa a localização do post (endereço marcado) e, na
        # falta, a do autor — mesmo fallback usado no feed (get_feed acima).
        lat = post.latitude if post.latitude is not None else user.latitude
        lon = post.longitude if post.longitude is not None else user.longitude
        if lat is not None and lon is not None:
            nearby_names = [
                name
                for name in geo.neighborhoods_around(lat, lon, db)
                if name and name != user.neighborhood
            ]
            if nearby_names:
                for n in user_dao.get_nearby_alert_subscribers(db, nearby_names, exclude_id=user.id):
                    recipients.setdefault(n.id, n)
        for neighbor in recipients.values():
            notification_service.notify(
                db,
                user_id=neighbor.id,
                type_=NotificationType.NEIGHBORHOOD_ALERT,
                content=f"novo aviso em {user.neighborhood}",
                target_text=preview,
                post_id=post.id,
                actor_id=user.id,
                push_title=f"Aviso em {user.neighborhood}",
                push_body=preview or "Novo aviso no seu bairro",
            )

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
        if post.category != PostCategory.ENQUETE:
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
    if post.category != PostCategory.ENQUETE or post.poll_closes_at is None:
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
    if post.category != PostCategory.ENQUETE or post.poll_closes_at is None:
        raise HTTPException(status_code=400, detail="Este post não é uma enquete")
    if datetime.now(timezone.utc) >= _aware(post.poll_closes_at):
        raise HTTPException(status_code=400, detail="Esta enquete já encerrou")

    post_dao.clear_user_votes(db, post.id, user.id)
    db.flush()
    post_dao.recount_options(db, post)
    db.commit()
    db.refresh(post)
    return _to_schema(post, user, db)


def _like_notification_text(actor_name: str, extra_actor_name: str | None, total: int) -> str:
    if not extra_actor_name:
        others = total - 1
        who = actor_name
    else:
        others = total - 2
        who = f"{actor_name}, {extra_actor_name}"
    if others <= 0:
        return f"{who} curtiram seu post"
    pessoas = "outra pessoa" if others == 1 else f"outras {others} pessoas"
    return f"{who} e {pessoas} curtiram seu post"


def _notify_like(db: Session, post: Post, actor: User) -> None:
    if post.author_id == actor.id:
        return
    total = post_dao.count_likers(db, post.id, exclude_user_id=post.author_id)
    if total > LIKE_MERGE_THRESHOLD:
        existing_rows = notification_service.list_like_notifications(db, post.author_id, post.id)
        extra_actor_id = existing_rows[0].actor_id if existing_rows else None
        for row in existing_rows:
            notification_service.delete_notification(db, row)
        extra_actor = db.get(User, extra_actor_id) if extra_actor_id else None
        content = _like_notification_text(
            actor.name, extra_actor.name if extra_actor else None, total
        )
        notification_service.notify(
            db,
            user_id=post.author_id,
            type_=NotificationType.LIKE_POST,
            content=content,
            target_text=(post.content or post.title or "")[:200],
            post_id=post.id,
            actor_id=actor.id,
            extra_actor_id=extra_actor_id,
            group_count=total,
            push_title="Novas curtidas no seu post",
            push_body=content,
        )
    else:
        notification_service.notify(
            db,
            user_id=post.author_id,
            type_=NotificationType.LIKE_POST,
            content="curtiu seu post",
            target_text=(post.content or post.title or "")[:200],
            post_id=post.id,
            actor_id=actor.id,
            push_title=f"{actor.name} curtiu seu post",
            push_body=(post.content or post.title or "")[:200] or "curtiu seu post",
        )


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
        db.flush()  # count_likers precisa enxergar a curtida recém-adicionada
        _notify_like(db, post, user)

    db.commit()
    db.refresh(post)
    return _to_schema(post, user, db)


def list_likers(db: Session, post_id: int) -> list[User]:
    """Quem curtiu o post — usado pelo dono no modal "Curtidas" da tela de detalhe."""
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    return post_dao.list_likers(db, post_id)


def toggle_repost(db: Session, post_id: int, user: User) -> PostOut:
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")

    existing = post_dao.get_repost(db, post_id, user.id)
    if existing:
        post_dao.remove_repost(db, existing)
        post.shares_count = max(0, post.shares_count - 1)
    else:
        post_dao.add_repost(db, post_id, user.id)
        post.shares_count += 1

    db.commit()
    db.refresh(post)
    return _to_schema(post, user, db)


_RESOLVABLE_STATUS_BY_CATEGORY = {
    PostCategory.VENDA: "sold",
    PostCategory.PERDIDOS: "found",
}


def resolve_post(db: Session, post_id: int, user: User) -> PostOut:
    """Autor marca uma Venda como "vendida" ou um Perdidos como "encontrado" —
    alternativa a excluir o post: ele continua visível, só ganha um aviso por
    cima do conteúdo (ver getPostStatus/PostStatusBanner no front)."""
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    status = _RESOLVABLE_STATUS_BY_CATEGORY.get(post.category)
    if status is None:
        raise HTTPException(status_code=400, detail="Esta categoria não pode ser marcada como concluída")

    details = dict(post.details or {})
    if details.get("resolved_status"):
        raise HTTPException(status_code=400, detail="Este post já foi marcado como concluído")

    details["resolved_status"] = status
    details["resolved_at"] = datetime.now(timezone.utc).isoformat()
    post.details = details

    db.commit()
    db.refresh(post)
    return _to_schema(post, user, db)


def delete_post(db: Session, post_id: int, user: User) -> None:
    post = post_dao.get_by_id(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post não encontrado")
    if post.author_id != user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    # Se este post era uma citação, desfaz a contagem de repost no alvo.
    if post.quoted_post_id is not None:
        target = post_dao.get_by_id(db, post.quoted_post_id)
        if target:
            target.shares_count = max(0, target.shares_count - 1)
    if post.quoted_comment_id is not None:
        target_comment = comment_dao.get_by_id(db, post.quoted_comment_id)
        if target_comment:
            target_comment.reposts_count = max(0, target_comment.reposts_count - 1)

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
    post.moderation_deleted_at = datetime.now(timezone.utc)
    post.moderation_deleted_by_id = moderator.id
    db.flush()
    if author:
        author.posts_count = post_dao.count_by_author(db, author.id)
    # Comentários do post também ficam invisíveis enquanto ele está na lixeira.
    # Atualiza os contadores públicos de todos os autores afetados.
    for comment_author_id in {comment.author_id for comment in post.comments}:
        comment_author = user_dao.get_by_id(db, comment_author_id)
        if comment_author:
            comment_author.comments_count = comment_dao.count_by_author(db, comment_author_id)
    db.commit()
    notification_service.notify(
        db,
        user_id=author_id,
        type_=NotificationType.POST_REMOVED,
        content="Seu post foi removido pela moderação por não seguir as diretrizes da comunidade.",
        target_text=content_preview,
        snapshot=snapshot,
        push_title="Aviso da moderação",
        push_body="Seu post foi removido por não seguir as diretrizes da comunidade.",
    )
    audit_log_service.log(db, moderator, AuditLogAction.POST_DELETE, author_id, content_preview)
