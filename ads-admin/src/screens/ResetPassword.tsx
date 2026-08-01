import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { DEFAULT_API_URL } from '../lib/config';
import { Field } from '../ui/primitives';
import { ThemeToggle } from '../ui/ThemeToggle';

// Tela aberta pelo link do e-mail (?reset_token=...). Fica fora do fluxo de
// login: não há sessão ainda, só o token do e-mail.

export function ResetPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
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
        '/auth/reset-password',
        { token, new_password: password },
        apiUrl.trim().replace(/\/$/, ''),
      );
      setDone(true);
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível redefinir a senha.'));
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
          <h1>Nova senha</h1>
        </div>
        <p className="muted">Escolha uma nova senha para sua conta do painel de anúncios.</p>

        {done ? (
          <div style={{ marginTop: 22 }}>
            <div className="insights">
              <strong>Senha alterada com sucesso!</strong>
            </div>
            <button type="button" className="btn primary lg block" onClick={onDone}>
              Ir para o login
            </button>
          </div>
        ) : (
          <>
            <div className="auth-fields">
              <Field label="Servidor do ads-backend">
                <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
              </Field>
              <Field label="Nova senha">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Confirmar nova senha">
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
              disabled={busy}
              onClick={submit}
            >
              Salvar nova senha
            </button>
          </>
        )}

        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
