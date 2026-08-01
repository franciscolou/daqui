import { api, errorMessage } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Review, ReviewStats } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { Stars, UserChip } from '../ui/moderation';
import { EmptyState, LoadingState, Stat } from '../ui/primitives';

// Avaliação é a opinião do usuário: a moderação não aprova/rejeita, só pode
// excluir avaliações abusivas/spam (fica registrado na auditoria).

export function Reviews() {
  const dialogs = useDialogs();
  const stats = useAsync<ReviewStats>(() => api.get<ReviewStats>('/admin/reviews/stats'));
  const list = useAsync<Review[]>(() => api.get<Review[]>('/admin/reviews'));

  const remove = async (r: Review) => {
    const ok = await dialogs.confirm(
      `Excluir a avaliação de @${r.author.username}? Esta ação não pode ser desfeita.`,
      { title: 'Excluir avaliação', confirmLabel: 'Excluir' },
    );
    if (!ok) return;
    try {
      await api.del(`/admin/reviews/${r.id}`);
      await Promise.all([list.reload(), stats.reload()]);
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  return (
    <div>
      <div className="stats">
        <Stat value={stats.data?.total ?? '—'} label="avaliações" />
        <Stat
          value={
            stats.data?.average != null
              ? `${stats.data.average.toFixed(2).replace('.', ',')} ★`
              : '—'
          }
          label="nota média"
        />
      </div>

      {list.loading && <LoadingState />}
      {!list.loading && list.error && <EmptyState>{list.error}</EmptyState>}
      {!list.loading && !list.error && (list.data ?? []).length === 0 && (
        <EmptyState>Nenhuma avaliação ainda.</EmptyState>
      )}

      {!list.loading &&
        (list.data ?? []).map((r) => (
          <div key={r.id} className="card hoverable">
            <div className="card-head">
              <div className="grow">
                <UserChip user={r.author} />
              </div>
              <div className="card-when">{fmtDate(r.updated_at)}</div>
            </div>

            <div className="rating-row">
              <Stars rating={r.rating} />
              <span className="rating-num">{String(r.rating).replace('.', ',')}</span>
            </div>

            {r.comment ? (
              <div className="card-text">{r.comment}</div>
            ) : (
              <div className="card-text empty">— sem comentário —</div>
            )}

            <div className="actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn danger" onClick={() => remove(r)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
