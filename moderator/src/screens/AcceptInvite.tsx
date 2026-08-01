import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { DEFAULT_API_URL } from '../lib/config';
import { STAFF_ROLE_LABEL } from '../lib/labels';
import { useAsync } from '../lib/useAsync';
import { Badge, Field, LoadingState } from '../ui/primitives';
import { ThemeToggle } from '../ui/ThemeToggle';

// Tela aberta pelo link do e-mail de convite (?invite_token=...). Fica fora
// do fluxo de login: a conta ainda não existe, só o convite (ver
// services/staff.py::admin_invite_staff no backend).

interface InviteInfo {
  email: string;
  role: string;
}

export function AcceptInvite({ token, onDone }: { token: string; onDone: () => void }) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const base = () => apiUrl.trim().replace(/\/$/, '');

  const invite = useAsync<InviteInfo>(
    () => api.publicGet<InviteInfo>(`/admin/staff/invite?token=${encodeURIComponent(token)}`, base()),
    [apiUrl],
  );

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      await api.public(
        '/admin/staff/accept-invite',
        { token, username: username.trim(), password },
        base(),
      );
      setDone(true);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível criar a conta.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-toggle">
        <ThemeToggle />
      </div>

      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-dot">d</div>
          <h1>Convite para a equipe</h1>
        </div>

        {done ? (
          <div style={{ marginTop: 22 }}>
            <div className="insights">
              <strong>Conta criada com sucesso!</strong>
            </div>
            <button type="button" className="btn primary lg block" onClick={onDone}>
              Ir para o login
            </button>
          </div>
        ) : invite.loading ? (
          <LoadingState />
        ) : invite.error || !invite.data ? (
          <>
            <p className="muted">{invite.error || 'Convite inválido ou expirado.'}</p>
            <div className="auth-fields" style={{ marginTop: 16 }}>
              <Field label="Servidor da API">
                <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
              </Field>
            </div>
            <button
              type="button"
              className="btn lg block"
              style={{ marginTop: 16 }}
              onClick={() => invite.reload()}
            >
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Convite para <b>{invite.data.email}</b>, como{' '}
              <Badge>{STAFF_ROLE_LABEL[invite.data.role] || invite.data.role}</Badge>. Escolha seu
              nome de usuário e senha para criar a conta.
            </p>
            <div className="auth-fields" style={{ marginTop: 16 }}>
              <Field label="Nome de usuário">
                <input
                  placeholder="nome.usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </Field>
              <Field label="Senha">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Confirmar senha">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                />
              </Field>
            </div>
            <button
              type="button"
              className="btn primary lg block"
              style={{ marginTop: 20 }}
              disabled={busy || !username.trim()}
              onClick={submit}
            >
              Criar conta
            </button>
          </>
        )}

        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
