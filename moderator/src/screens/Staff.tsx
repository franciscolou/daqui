import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDate } from '../lib/format';
import { STAFF_RANK, STAFF_ROLE_LABEL } from '../lib/labels';
import { StaffAccount } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { Badge, EmptyState, Field, LoadingState, Modal } from '../ui/primitives';

// Gestão de contas de staff. Administrador gerencia Moderador; Owner gerencia
// Moderador e Administrador. O servidor é a autoridade (403 fora de rank) —
// aqui só decidimos o que mostrar/habilitar.

const DELETED_REASON = 'Conta de equipe excluída';

function roleTone(role: string): 'green' | 'amber' | 'neutral' {
  if (role === 'owner') return 'green';
  if (role === 'administrador') return 'amber';
  return 'neutral';
}

export function Staff() {
  const dialogs = useDialogs();
  const { me } = useAuth();
  const { data, loading, error, reload } = useAsync<StaffAccount[]>(() =>
    api.get<StaffAccount[]>('/admin/staff'),
  );
  const [createOpen, setCreateOpen] = useState(false);

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
      await reload();
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  const suspend = async (s: StaffAccount) => {
    const ok = await dialogs.confirm(`Suspender a conta de @${s.username}?`, {
      title: 'Suspender conta',
      confirmLabel: 'Suspender',
    });
    if (ok) await act(() => api.post(`/admin/staff/${s.id}/suspend`));
  };

  const unsuspend = async (s: StaffAccount) => {
    const ok = await dialogs.confirm(`Reativar a conta de @${s.username}?`, {
      title: 'Reativar conta',
      confirmLabel: 'Reativar',
      danger: false,
    });
    if (ok) await act(() => api.del(`/admin/staff/${s.id}/suspend`));
  };

  const remove = async (s: StaffAccount) => {
    const ok = await dialogs.confirm(
      `Excluir a conta de @${s.username}? Esta ação não pode ser desfeita.`,
      { title: 'Excluir conta', confirmLabel: 'Excluir' },
    );
    if (ok) await act(() => api.del(`/admin/staff/${s.id}`));
  };

  return (
    <div>
      <div className="actions end" style={{ marginBottom: 16 }}>
        <button type="button" className="btn primary" onClick={() => setCreateOpen(true)}>
          Nova conta
        </button>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <EmptyState>{error}</EmptyState>}
      {!loading && !error && (data ?? []).length === 0 && (
        <EmptyState>Nenhuma conta de staff.</EmptyState>
      )}

      {!loading &&
        (data ?? []).map((s) => {
          const canManage =
            s.email !== me?.email &&
            (STAFF_RANK[me?.staff_role ?? ''] ?? 0) > (STAFF_RANK[s.staff_role] ?? 0);
          const isDeleted = s.suspension_reason === DELETED_REASON;
          return (
            <div key={s.id} className="card">
              <div className="card-head">
                <div className="who-avatar" style={{ width: 44, height: 44, borderRadius: 14 }}>
                  {(s.username[0] || '?').toUpperCase()}
                </div>
                <div className="grow">
                  <div className="card-title">{s.username}</div>
                  <div className="card-sub">{s.email}</div>
                  <div className="tag-row" style={{ marginTop: 6 }}>
                    <Badge tone={roleTone(s.staff_role)}>
                      {STAFF_ROLE_LABEL[s.staff_role] || s.staff_role}
                    </Badge>
                    {s.is_suspended && (
                      <Badge tone="red">{isDeleted ? 'Excluída' : 'Suspensa'}</Badge>
                    )}
                  </div>
                </div>
                <div className="card-when">desde {fmtDate(s.created_at)}</div>
              </div>

              {canManage && (
                <div className="actions" style={{ marginTop: 14 }}>
                  {s.is_suspended ? (
                    <button type="button" className="btn warn" onClick={() => unsuspend(s)}>
                      Reativar
                    </button>
                  ) : (
                    <button type="button" className="btn warn" onClick={() => suspend(s)}>
                      Suspender
                    </button>
                  )}
                  <button type="button" className="btn danger" onClick={() => remove(s)}>
                    Excluir
                  </button>
                </div>
              )}
            </div>
          );
        })}

      {createOpen && (
        <CreateStaffModal
          ownerMode={me?.staff_role === 'owner'}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function CreateStaffModal({
  ownerMode,
  onClose,
  onCreated,
}: {
  ownerMode: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('moderador');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post('/admin/staff', {
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      });
      await onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Nova conta de staff"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={submit}>
            Criar
          </button>
        </>
      }
    >
      <Field label="Usuário">
        <input
          placeholder="nome.usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <Field label="E-mail">
        <input
          type="email"
          placeholder="pessoa@daqui.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Senha">
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label="Cargo">
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="moderador">Moderador</option>
          {ownerMode && <option value="administrador">Administrador</option>}
        </select>
      </Field>
      {error && <div className="err">{error}</div>}
    </Modal>
  );
}
