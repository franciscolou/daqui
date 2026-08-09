import { api, errorMessage } from '../lib/api';
import { fmtDate, truncate } from '../lib/format';
import { TrashItem } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { UserChip } from '../ui/moderation';
import { Badge, EmptyState, LoadingState } from '../ui/primitives';

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

export function Trash() {
  const dialogs = useDialogs();
  const list = useAsync<TrashItem[]>(() => api.get<TrashItem[]>('/admin/trash/'));

  const restore = async (item: TrashItem) => {
    const kind = item.type === 'post' ? 'post' : 'comentário';
    const ok = await dialogs.confirm(`Restaurar este ${kind}? Ele voltará a aparecer no Daqui.`, {
      title: `Restaurar ${kind}`,
      confirmLabel: 'Restaurar',
      danger: false,
    });
    if (!ok) return;
    try {
      await api.post(`/admin/trash/${item.type}/${item.id}/restore`);
      await list.reload();
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  return (
    <div>
      <div className="card-text" style={{ marginBottom: 18 }}>
        Itens removidos pela moderação são apagados definitivamente após 60 dias.
      </div>

      {list.loading && <LoadingState />}
      {!list.loading && list.error && <EmptyState>{list.error}</EmptyState>}
      {!list.loading && !list.error && (list.data ?? []).length === 0 && (
        <EmptyState>A lixeira está vazia.</EmptyState>
      )}

      {!list.loading &&
        (list.data ?? []).map((item) => (
          <div key={`${item.type}-${item.id}`} className="card">
            <div className="card-head">
              <div className="grow">
                <div className="card-title">
                  {item.type === 'post' ? 'Post' : 'Comentário'}{' '}
                  <Badge tone="red">{daysLeft(item.expires_at)} dias restantes</Badge>
                </div>
                <div className="card-sub">
                  Removido em {fmtDate(item.deleted_at)} por @{item.deleted_by.username}
                </div>
              </div>
              <UserChip user={item.author} />
            </div>
            <div className="card-text">
              {item.title ? `${item.title} — ` : ''}
              {truncate(item.content, 400)}
            </div>
            <div className="actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn primary" onClick={() => restore(item)}>
                Restaurar
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

