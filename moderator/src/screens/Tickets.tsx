import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { fmtDate } from '../lib/format';
import { TICKET_STATUS_FILTERS, TICKET_STATUS_LABEL, statusTone } from '../lib/labels';
import { CountStats, Ticket } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { Attachments, UserChip } from '../ui/moderation';
import { Badge, EmptyState, LoadingState, Stat, Tabs } from '../ui/primitives';

// Chamado é aberto pelo usuário quando "Como usar"/FAQ não resolveram a
// dúvida. A moderação responde por aqui; a resposta aparece para o usuário em
// "Meus chamados" no app Daqui.

export function Tickets() {
  const [status, setStatus] = useState('');
  const stats = useAsync<CountStats>(() => api.get<CountStats>('/admin/support-tickets/stats'));
  const list = useAsync<Ticket[]>(
    () => api.get<Ticket[]>(`/admin/support-tickets${status ? `?status=${status}` : ''}`),
    [status],
  );

  const reload = async () => {
    await Promise.all([list.reload(), stats.reload()]);
  };

  return (
    <div>
      <div className="stats">
        <Stat value={stats.data?.total ?? '—'} label="chamados" />
        <Stat value={stats.data?.pending ?? '—'} label="pendentes" />
      </div>

      <Tabs value={status} options={TICKET_STATUS_FILTERS} onChange={setStatus} />

      {list.loading && <LoadingState />}
      {!list.loading && list.error && <EmptyState>{list.error}</EmptyState>}
      {!list.loading && !list.error && (list.data ?? []).length === 0 && (
        <EmptyState>Nenhum chamado encontrado.</EmptyState>
      )}

      {!list.loading &&
        (list.data ?? []).map((t) => <TicketCard key={t.id} ticket={t} onReplied={reload} />)}
    </div>
  );
}

function TicketCard({ ticket: t, onReplied }: { ticket: Ticket; onReplied: () => Promise<void> }) {
  const dialogs = useDialogs();
  const [response, setResponse] = useState(t.response ?? '');
  const [busy, setBusy] = useState(false);

  const reply = async () => {
    if (!response.trim()) {
      dialogs.alert('Escreva uma resposta antes de enviar.', 'Aviso');
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/admin/support-tickets/${t.id}/reply`, { response: response.trim() });
      await onReplied();
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card hoverable">
      <div className="card-head">
        <div className="grow">
          <UserChip user={t.user} />
        </div>
        <div className="card-when">{fmtDate(t.created_at)}</div>
      </div>

      <div className="tag-row">
        <span className="reason-tag">{t.subject}</span>
        <Badge tone={statusTone(t.status)}>{TICKET_STATUS_LABEL[t.status] || t.status}</Badge>
      </div>

      <div className="card-text">{t.message}</div>

      <Attachments items={t.attachments} />

      {t.status === 'answered' && t.response && (
        <div className="reply-box">
          <div className="label">Resposta enviada em {fmtDate(t.responded_at)}</div>
          <div className="content">{t.response}</div>
        </div>
      )}

      <textarea
        className="reply-input"
        placeholder="Escreva uma resposta para o usuário..."
        value={response}
        onChange={(e) => setResponse(e.target.value)}
      />

      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn primary" disabled={busy} onClick={reply}>
          {t.status === 'answered' ? 'Atualizar resposta' : 'Responder'}
        </button>
      </div>
    </div>
  );
}
