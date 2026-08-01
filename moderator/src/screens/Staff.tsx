import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtDate } from '../lib/format';
import { STAFF_RANK, STAFF_ROLE_LABEL } from '../lib/labels';
import { StaffAccount } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { Avatar, Badge, EmptyState, Field, LoadingState, Modal } from '../ui/primitives';

// Gestão de contas de staff. Administrador gerencia Moderador; Owner gerencia
// Moderador e Administrador. O servidor é a autoridade (403 fora de rank) —
// aqui só decidimos o que mostrar/habilitar.

const DELETED_REASON = 'Conta de equipe excluída';

// Trocar o username reescreve as menções antigas (@handle é texto literal no
// conteúdo) — quem faz isso é o backend, ver services/staff.py.
const RENAME_HINT =
  'De 3 a 18 caracteres: letras minúsculas, números, ponto ou sublinhado. As menções antigas a este usuário são atualizadas.';

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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [renaming, setRenaming] = useState<StaffAccount | null>(null);

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
        <button type="button" className="btn primary" onClick={() => setInviteOpen(true)}>
          Convidar
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
                <Avatar url={s.avatar_url} fallback={s.username} size={44} radius={14} />
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
                  <button type="button" className="btn" onClick={() => setRenaming(s)}>
                    Alterar usuário
                  </button>
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

      {renaming && (
        <RenameStaffModal
          account={renaming}
          onClose={() => setRenaming(null)}
          onRenamed={async () => {
            setRenaming(null);
            await reload();
          }}
        />
      )}

      {inviteOpen && (
        <InviteStaffModal
          ownerMode={me?.staff_role === 'owner'}
          onClose={() => setInviteOpen(false)}
          onInvited={async (email) => {
            setInviteOpen(false);
            await dialogs.alert(`Convite enviado para ${email}.`, 'Convite enviado');
          }}
        />
      )}
    </div>
  );
}

function InviteStaffModal({
  ownerMode,
  onClose,
  onInvited,
}: {
  ownerMode: boolean;
  onClose: () => void;
  onInvited: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('moderador');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post('/admin/staff/invite', { email: email.trim(), role });
      await onInvited(email.trim());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Convidar para a equipe"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={submit}>
            Enviar convite
          </button>
        </>
      }
    >
      <p className="muted">
        Um e-mail com o link do convite é enviado pro endereço abaixo — a pessoa escolhe o
        próprio nome de usuário e senha ao aceitar.
      </p>
      <Field label="E-mail">
        <input
          type="email"
          placeholder="pessoa@daqui.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      {ownerMode && (
        <Field label="Cargo">
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="moderador">Moderador</option>
            <option value="administrador">Administrador</option>
          </select>
        </Field>
      )}
      {error && <div className="err">{error}</div>}
    </Modal>
  );
}

function RenameStaffModal({
  account,
  onClose,
  onRenamed,
}: {
  account: StaffAccount;
  onClose: () => void;
  onRenamed: () => Promise<void>;
}) {
  const [username, setUsername] = useState(account.username);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.patch(`/admin/staff/${account.id}/username`, { username: username.trim() });
      await onRenamed();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Alterar nome de usuário"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={submit}>
            Salvar
          </button>
        </>
      }
    >
      <p className="muted">
        Conta de <b>{account.email}</b>, hoje <b>@{account.username}</b>.
      </p>
      <Field label="Novo nome de usuário" hint={RENAME_HINT}>
        <input
          placeholder="nome.usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      {error && <div className="err">{error}</div>}
    </Modal>
  );
}
