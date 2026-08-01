import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DEFAULT_API_URL } from '../lib/config';
import { Field } from '../ui/primitives';
import { ThemeToggle } from '../ui/ThemeToggle';

// Card de login com 3 passos possíveis: credenciais → (se A2F ativa) código →
// entra; ou credenciais → "esqueci minha senha" → confirmação.

type Step = 'creds' | '2fa' | 'forgot';

interface LoginResponse {
  access_token?: string;
  requires_2fa?: boolean;
  ticket?: string;
}

export function Login() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>('creds');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const base = () => apiUrl.trim().replace(/\/$/, '');

  const submitCredentials = async () => {
    setError('');
    setBusy(true);
    try {
      const data = await api.public<LoginResponse>(
        '/auth/login',
        { email: email.trim(), password },
        base(),
      );
      if (data.requires_2fa) {
        setTicket(data.ticket ?? '');
        setCode('');
        setStep('2fa');
        return;
      }
      await signIn(data.access_token ?? '', base());
    } catch (e) {
      setError(errorMessage(e, 'Falha no login'));
    } finally {
      setBusy(false);
    }
  };

  const submitTwofa = async () => {
    setError('');
    setBusy(true);
    try {
      const data = await api.public<LoginResponse>(
        '/auth/login/2fa',
        { ticket, code: code.trim() },
        base(),
      );
      await signIn(data.access_token ?? '', base());
    } catch (e) {
      setError(errorMessage(e, 'Código inválido'));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    setError('');
    setForgotMsg('');
    const value = forgotEmail.trim();
    if (!value) {
      setError('Informe um e-mail.');
      return;
    }
    setBusy(true);
    try {
      await api.public('/auth/forgot-password', { email: value }, base());
      setForgotMsg(
        'Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
      );
    } catch (e) {
      setError(errorMessage(e, 'Não foi possível enviar o e-mail.'));
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
          <h1>Anúncios Daqui</h1>
        </div>
        <p className="muted">Painel do time de anúncios. Login separado do app Daqui.</p>

        {step === 'creds' && (
          <>
            <div className="auth-fields">
              <Field label="Servidor do ads-backend">
                <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="ads@daqui.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Senha">
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitCredentials();
                  }}
                />
              </Field>
            </div>
            <button
              type="button"
              className="btn primary lg block"
              style={{ marginTop: 20 }}
              disabled={busy}
              onClick={submitCredentials}
            >
              Entrar
            </button>
            <button
              type="button"
              className="btn-link"
              style={{ marginTop: 16 }}
              onClick={() => {
                setForgotEmail(email.trim());
                setForgotMsg('');
                setError('');
                setStep('forgot');
              }}
            >
              Esqueci minha senha
            </button>
          </>
        )}

        {step === '2fa' && (
          <>
            <div className="auth-fields">
              <p className="muted">Digite o código de 6 dígitos do seu app autenticador.</p>
              <Field label="Código">
                <input
                  className="code-input"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitTwofa();
                  }}
                />
              </Field>
            </div>
            <button
              type="button"
              className="btn primary lg block"
              style={{ marginTop: 20 }}
              disabled={busy}
              onClick={submitTwofa}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="btn-link"
              style={{ marginTop: 16 }}
              onClick={() => {
                setError('');
                setStep('creds');
              }}
            >
              Voltar
            </button>
          </>
        )}

        {step === 'forgot' && (
          <>
            <div className="auth-fields">
              <p className="muted">
                Informe seu e-mail. Se existir uma conta, enviaremos um link para redefinir a senha.
              </p>
              <Field label="E-mail">
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="ads@daqui.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitForgot();
                  }}
                />
              </Field>
            </div>
            <button
              type="button"
              className="btn primary lg block"
              style={{ marginTop: 20 }}
              disabled={busy}
              onClick={submitForgot}
            >
              Enviar link
            </button>
            <button
              type="button"
              className="btn-link"
              style={{ marginTop: 16 }}
              onClick={() => {
                setError('');
                setStep('creds');
              }}
            >
              Voltar
            </button>
            {forgotMsg && <div className="ok-text">{forgotMsg}</div>}
          </>
        )}

        {error && <div className="err">{error}</div>}
      </div>
    </div>
  );
}
