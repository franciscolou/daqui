import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { fmtDate, truncate } from '../lib/format';
import {
  REPORT_REASON_LABEL,
  REPORT_STATUS_FILTERS,
  REPORT_STATUS_LABEL,
  REPORT_TARGET_LABEL,
  REPORT_TYPE_FILTERS,
  statusTone,
} from '../lib/labels';
import { CountStats, Report } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { AppLink, Attachments, Avatar, UserLink } from '../ui/moderation';
import { Badge, EmptyState, LoadingState, Stat, Tabs } from '../ui/primitives';

export function Reports() {
  const dialogs = useDialogs();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');

  const stats = useAsync<CountStats>(() => api.get<CountStats>('/admin/reports/stats'));
  const list = useAsync<Report[]>(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('target_type', type);
    const qs = params.toString();
    return api.get<Report[]>(`/admin/reports${qs ? `?${qs}` : ''}`);
  }, [status, type]);

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
      await Promise.all([list.reload(), stats.reload()]);
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  const remove = async (r: Report) => {
    const ok = await dialogs.confirm('Excluir esta denúncia? Esta ação não pode ser desfeita.', {
      title: 'Excluir denúncia',
      confirmLabel: 'Excluir',
    });
    if (ok) await act(() => api.del(`/admin/reports/${r.id}`));
  };

  return (
    <div>
      <div className="stats">
        <Stat value={stats.data?.total ?? '—'} label="denúncias" />
        <Stat value={stats.data?.pending ?? '—'} label="pendentes" />
      </div>

      <Tabs value={status} options={REPORT_STATUS_FILTERS} onChange={setStatus} />
      <Tabs value={type} options={REPORT_TYPE_FILTERS} onChange={setType} />

      {list.loading && <LoadingState />}
      {!list.loading && list.error && <EmptyState>{list.error}</EmptyState>}
      {!list.loading && !list.error && (list.data ?? []).length === 0 && (
        <EmptyState>Nenhuma denúncia encontrada.</EmptyState>
      )}

      {!list.loading &&
        (list.data ?? []).map((r) => (
          <div key={r.id} className="card hoverable">
            <div className="card-head">
              <Avatar user={r.reporter} />
              <div className="grow">
                <div className="card-title">
                  <UserLink user={r.reporter} />{' '}
                  <span className="card-sub" style={{ display: 'inline' }}>
                    denunciou
                  </span>
                </div>
                <div className="card-sub">
                  {REPORT_TARGET_LABEL[r.target_type] || r.target_type}
                </div>
              </div>
              <div className="card-when">{fmtDate(r.created_at)}</div>
            </div>

            <div className="tag-row">
              <span className="reason-tag">{REPORT_REASON_LABEL[r.reason] || r.reason}</span>
              <Badge tone={statusTone(r.status)}>
                {REPORT_STATUS_LABEL[r.status] || r.status}
              </Badge>
            </div>

            <ReportTarget report={r} />

            {r.comment ? (
              <div className="card-text">{r.comment}</div>
            ) : (
              <div className="card-text empty">— sem comentário adicional —</div>
            )}

            <Attachments items={r.attachments} />

            <div className="actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => act(() => api.patch(`/admin/reports/${r.id}`, { status: 'reviewed' }))}
              >
                Marcar como revisada
              </button>
              <button
                type="button"
                className="btn warn"
                onClick={() =>
                  act(() => api.patch(`/admin/reports/${r.id}`, { status: 'dismissed' }))
                }
              >
                Descartar
              </button>
              <button
                type="button"
                className="btn danger"
                style={{ marginLeft: 'auto' }}
                onClick={() => remove(r)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

/** O conteúdo denunciado em si, com link pra vê-lo no app. */
function ReportTarget({ report: r }: { report: Report }) {
  if (r.target_type === 'post') {
    if (!r.post) {
      return (
        <div className="target-box empty">Publicação não encontrada (pode ter sido excluída).</div>
      );
    }
    return (
      <div className="target-box">
        <div className="label">
          Publicação de <UserLink user={r.post.author} />
        </div>
        <div className="content">
          {r.post.title ? `${r.post.title} — ` : ''}
          {truncate(r.post.content, 280)}
        </div>
        <div style={{ marginTop: 10 }}>
          <AppLink path={`/post/${r.post.id}`} label="Ver publicação no app" />
        </div>
      </div>
    );
  }

  if (r.target_type === 'comment') {
    if (!r.comment_target) {
      return (
        <div className="target-box empty">Comentário não encontrado (pode ter sido excluído).</div>
      );
    }
    return (
      <div className="target-box">
        <div className="label">
          Comentário de <UserLink user={r.comment_target.author} />
        </div>
        <div className="content">{truncate(r.comment_target.content, 280)}</div>
        <div style={{ marginTop: 10 }}>
          <AppLink
            path={`/post/${r.comment_target.post_id}`}
            label="Ver publicação do comentário"
          />
        </div>
      </div>
    );
  }

  if (r.target_type === 'user') {
    if (!r.reported_user) return <div className="target-box empty">Perfil não encontrado.</div>;
    return (
      <div className="target-box">
        <div className="label">Perfil denunciado</div>
        <div className="content">
          <UserLink user={r.reported_user} /> · {r.reported_user.neighborhood || ''}
        </div>
        <div style={{ marginTop: 10 }}>
          <AppLink path={`/user/${r.reported_user.id}`} label="Ver perfil no app" />
        </div>
      </div>
    );
  }

  return null;
}
