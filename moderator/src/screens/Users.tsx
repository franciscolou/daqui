import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { fmtDate, truncate } from '../lib/format';
import { CATEGORY_LABEL } from '../lib/labels';
import { AdminUser, UserComment, UserPost } from '../lib/types';
import { useDialogs } from '../ui/dialogs';
import { Icon } from '../ui/Icon';
import { AppLink, Avatar } from '../ui/moderation';
import { Badge, EmptyState, Field, LoadingState, Modal, Tabs } from '../ui/primitives';

// Busca um usuário e, na ficha dele, lista posts/comentários para exclusão
// pontual — além de suspender/reativar a conta.

/** Rótulo sempre visível da suspensão (data de expiração, ou "indeterminado"). */
function suspensionLabel(u: AdminUser): string | null {
  if (!u.is_suspended) return null;
  return u.suspended_until
    ? `Suspenso até ${fmtDate(u.suspended_until)}`
    : 'Suspenso por tempo indeterminado';
}

export function Users({ userId }: { userId: number | null }) {
  const dialogs = useDialogs();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AdminUser | null>(null);

  // Abertura vinda de outra seção (clique num @usuário em denúncias,
  // avaliações, chamados ou auditoria).
  const openById = useCallback(
    async (id: number) => {
      try {
        setSelected(await api.get<AdminUser>(`/admin/users/${id}`));
      } catch (e) {
        dialogs.alert(errorMessage(e), 'Erro');
      }
    },
    [dialogs],
  );

  useEffect(() => {
    if (userId != null) openById(userId);
  }, [userId, openById]);

  const search = async () => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      setResults(await api.get<AdminUser[]>(`/admin/users/search?q=${encodeURIComponent(q)}`));
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  if (selected) {
    return (
      <div>
        <button
          type="button"
          className="btn-link"
          style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={() => setSelected(null)}
        >
          <Icon name="arrowLeft" size={14} />
          Voltar à busca
        </button>
        <UserDetail user={selected} onUpdated={setSelected} />
      </div>
    );
  }

  return (
    <div>
      <div className="search-row">
        <input
          placeholder="Buscar por nome ou @usuário..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
          }}
        />
        <button type="button" className="btn primary" onClick={search}>
          Buscar
        </button>
      </div>

      {searching && <LoadingState label="Buscando…" />}
      {!searching && results?.length === 0 && <EmptyState>Nenhum usuário encontrado.</EmptyState>}

      {!searching &&
        (results ?? []).map((u) => (
          <button key={u.id} type="button" className="result-row" onClick={() => setSelected(u)}>
            <Avatar user={u} />
            <div style={{ minWidth: 0 }}>
              <div className="card-title">
                @{u.username} {u.is_suspended && <Badge tone="red">Suspenso</Badge>}
              </div>
              <div className="card-sub">
                {u.neighborhood || ''} · {u.posts_count} posts
              </div>
              {u.is_suspended && <div className="card-sub">{suspensionLabel(u)}</div>}
            </div>
          </button>
        ))}
    </div>
  );
}

function UserDetail({
  user,
  onUpdated,
}: {
  user: AdminUser;
  onUpdated: (next: AdminUser) => void;
}) {
  const dialogs = useDialogs();
  const [suspendOpen, setSuspendOpen] = useState(false);

  const unsuspend = async () => {
    const ok = await dialogs.confirm('Reativar esta conta?', {
      title: 'Reativar conta',
      confirmLabel: 'Reativar',
      danger: false,
    });
    if (!ok) return;
    try {
      const updated = await api.del<Partial<AdminUser>>(`/admin/users/${user.id}/suspend`);
      onUpdated({ ...user, ...updated });
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-head">
          <Avatar user={user} />
          <div className="grow">
            <div className="card-title">
              @{user.username} {user.is_suspended && <Badge tone="red">Suspenso</Badge>}
            </div>
            <div className="card-sub">{user.neighborhood || ''}</div>
            <div className="card-sub">Membro desde {fmtDate(user.created_at)}</div>
          </div>
          <div className="card-when">
            {user.posts_count} posts · {user.interactions_count} interações
          </div>
        </div>

        {user.is_suspended && <div className="card-text">{suspensionLabel(user)}</div>}
        {user.is_suspended && user.suspension_reason && (
          <div className="card-text">Motivo: {user.suspension_reason}</div>
        )}

        <div className="actions" style={{ marginTop: 14 }}>
          {user.is_suspended ? (
            <button type="button" className="btn warn" onClick={unsuspend}>
              Reativar conta
            </button>
          ) : (
            <button type="button" className="btn warn" onClick={() => setSuspendOpen(true)}>
              Suspender conta
            </button>
          )}
        </div>
      </div>

      <UserContent userId={user.id} />

      {suspendOpen && (
        <SuspendModal
          user={user}
          onClose={() => setSuspendOpen(false)}
          onSuspended={(updated) => {
            setSuspendOpen(false);
            onUpdated({ ...user, ...updated });
          }}
        />
      )}
    </>
  );
}

function SuspendModal({
  user,
  onClose,
  onSuspended,
}: {
  user: AdminUser;
  onClose: () => void;
  onSuspended: (updated: Partial<AdminUser>) => void;
}) {
  const dialogs = useDialogs();
  const [duration, setDuration] = useState('7');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const until =
        duration === 'indef'
          ? null
          : new Date(Date.now() + parseInt(duration, 10) * 86400000).toISOString();
      onSuspended(
        await api.post<Partial<AdminUser>>(`/admin/users/${user.id}/suspend`, {
          until,
          reason: reason.trim(),
        }),
      );
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Suspender conta de @${user.username}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={submit}>
            Confirmar
          </button>
        </>
      }
    >
      <Field label="Duração">
        <select value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="1">1 dia</option>
          <option value="3">3 dias</option>
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">3 meses</option>
          <option value="180">6 meses</option>
          <option value="indef">Tempo indeterminado</option>
        </select>
      </Field>
      <Field label="Motivo (opcional)">
        <input
          placeholder="Motivo da suspensão"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
    </Modal>
  );
}

function UserContent({ userId }: { userId: number }) {
  const dialogs = useDialogs();
  const [tab, setTab] = useState<'posts' | 'comments'>('posts');
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [comments, setComments] = useState<UserComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.get<UserPost[]>(`/admin/users/${userId}/posts`),
      api.get<UserComment[]>(`/admin/users/${userId}/comments`),
    ])
      .then(([p, c]) => {
        if (!alive) return;
        setPosts(p);
        setComments(c);
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const deletePost = async (id: number) => {
    const ok = await dialogs.confirm('Excluir este post? Esta ação não pode ser desfeita.', {
      title: 'Excluir post',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await api.del(`/admin/posts/${id}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  const deleteComment = async (id: number) => {
    const ok = await dialogs.confirm('Excluir este comentário? Esta ação não pode ser desfeita.', {
      title: 'Excluir comentário',
      confirmLabel: 'Excluir',
    });
    if (!ok) return;
    try {
      await api.del(`/admin/comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <Tabs
        value={tab}
        options={[
          { key: 'posts' as const, label: 'Posts' },
          { key: 'comments' as const, label: 'Comentários' },
        ]}
        onChange={setTab}
      />

      {loading && <LoadingState />}
      {!loading && error && <EmptyState>{error}</EmptyState>}

      {!loading && !error && tab === 'posts' && (
        posts.length === 0 ? (
          <EmptyState>Nenhum post encontrado.</EmptyState>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="card">
              <div className="card-head">
                <div className="grow">
                  <div className="card-title">{CATEGORY_LABEL[p.category] || p.category}</div>
                </div>
                <div className="card-when">{fmtDate(p.created_at)}</div>
              </div>
              <div className="card-text">
                {p.title ? `${p.title} — ` : ''}
                {truncate(p.content, 300)}
              </div>
              <div className="meta-row">
                {p.likes_count} curtidas · {p.comments_count} comentários
              </div>
              <div className="actions" style={{ marginTop: 12 }}>
                <AppLink path={`/post/${p.id}`} label="Ver no app" />
                <button
                  type="button"
                  className="btn danger"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => deletePost(p.id)}
                >
                  Excluir post
                </button>
              </div>
            </div>
          ))
        )
      )}

      {!loading && !error && tab === 'comments' && (
        comments.length === 0 ? (
          <EmptyState>Nenhum comentário encontrado.</EmptyState>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="card">
              <div className="card-head">
                <div className="grow">
                  <div className="card-title">Comentário</div>
                </div>
                <div className="card-when">{fmtDate(c.created_at)}</div>
              </div>
              <div className="card-text">{c.content}</div>
              <div className="actions" style={{ marginTop: 12 }}>
                <AppLink path={`/post/${c.post_id}`} label="Ver publicação no app" />
                <button
                  type="button"
                  className="btn danger"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => deleteComment(c.id)}
                >
                  Excluir comentário
                </button>
              </div>
            </div>
          ))
        )
      )}
    </div>
  );
}
