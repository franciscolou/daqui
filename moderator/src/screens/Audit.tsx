import { useState } from 'react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import {
  AUDIT_ACTION_FILTERS,
  AUDIT_ACTION_LABEL,
  AUDIT_ACTION_VERB,
  AUDIT_ACTION_VERB_NO_TARGET,
} from '../lib/labels';
import { AuditLog } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { UserLink } from '../ui/moderation';
import { EmptyState, LoadingState, Tabs } from '../ui/primitives';

// Registro de toda ação da moderação: exclusões, denúncias resolvidas/
// descartadas e suspensões. Pesquisável por moderador, usuário afetado e
// tipo de ação.

export function Audit() {
  const [action, setAction] = useState('');
  const [draft, setDraft] = useState({ moderator: '', targetUser: '' });
  const [applied, setApplied] = useState(draft);

  const { data, loading, error } = useAsync<AuditLog[]>(() => {
    const params = new URLSearchParams();
    if (applied.moderator) params.set('moderator', applied.moderator);
    if (applied.targetUser) params.set('target_user', applied.targetUser);
    if (action) params.set('action', action);
    const qs = params.toString();
    return api.get<AuditLog[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  }, [applied, action]);

  const submitSearch = () => setApplied({ ...draft });

  return (
    <div>
      <div className="search-row">
        <input
          placeholder="Moderador (nome ou @usuário)"
          value={draft.moderator}
          onChange={(e) => setDraft({ ...draft, moderator: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitSearch();
          }}
        />
        <input
          placeholder="Usuário afetado (nome ou @usuário)"
          value={draft.targetUser}
          onChange={(e) => setDraft({ ...draft, targetUser: e.target.value })}
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
                <UserLink user={l.moderator} />{' '}
                {l.target_user ? (
                  <>
                    {AUDIT_ACTION_VERB[l.action] || AUDIT_ACTION_LABEL[l.action] || l.action}{' '}
                    <UserLink user={l.target_user} />
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
