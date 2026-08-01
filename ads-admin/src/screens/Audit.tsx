import { useState } from 'react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import {
  AUDIT_ACTION_FILTERS,
  AUDIT_ACTION_LABEL,
  AUDIT_ACTION_VERB,
  AUDIT_ACTION_VERB_NO_TARGET,
} from '../lib/labels';
import { AdAuditLog, StaffAccount } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { Avatar, EmptyState, LoadingState, Tabs } from '../ui/primitives';

// Registro de toda ação do painel de anúncios: campanhas pausadas/reativadas,
// planos e propostas manuais criados, e movimentações de conta de staff.
// Pesquisável por autor (usuário ou e-mail) e tipo de ação.

/** @usuário do ator/alvo de um log — sem link (diferente do UserLink da
 *  moderação, não há perfil de app pra abrir aqui). */
function ActorTag({ account }: { account: StaffAccount }) {
  return (
    <span className="audit-actor">
      <Avatar url={account.avatar_url} fallback={account.username} size={18} />
      <b>@{account.username}</b>
    </span>
  );
}

export function Audit() {
  const [action, setAction] = useState('');
  const [draft, setDraft] = useState('');
  const [applied, setApplied] = useState('');

  const { data, loading, error } = useAsync<AdAuditLog[]>(() => {
    const params = new URLSearchParams();
    if (applied) params.set('actor', applied);
    if (action) params.set('action', action);
    const qs = params.toString();
    return api.get<AdAuditLog[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  }, [applied, action]);

  const submitSearch = () => setApplied(draft);

  return (
    <div>
      <div className="search-row">
        <input
          placeholder="Autor da ação (usuário ou e-mail)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitSearch();
          }}
        />
        <button type="button" className="btn primary" onClick={submitSearch}>
          Buscar
        </button>
      </div>

      <Tabs value={action} options={AUDIT_ACTION_FILTERS} onChange={setAction} />

      {loading && <LoadingState />}
      {!loading && error && <EmptyState>{error}</EmptyState>}
      {!loading && !error && (data ?? []).length === 0 && (
        <EmptyState>Nenhum registro encontrado.</EmptyState>
      )}

      {!loading &&
        (data ?? []).map((l) => (
          <div key={l.id} className="card">
            <div className="card-head">
              <div className="grow audit-sentence">
                <ActorTag account={l.actor} />{' '}
                {l.target ? (
                  <>
                    {AUDIT_ACTION_VERB[l.action] || AUDIT_ACTION_LABEL[l.action] || l.action}{' '}
                    <ActorTag account={l.target} />
                  </>
                ) : (
                  AUDIT_ACTION_VERB_NO_TARGET[l.action] || AUDIT_ACTION_LABEL[l.action] || l.action
                )}
              </div>
              <div className="card-when">{fmtDate(l.created_at)}</div>
            </div>
            {l.detail && <div className="card-text">{l.detail}</div>}
          </div>
        ))}
    </div>
  );
}
