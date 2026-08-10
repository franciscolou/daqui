import { useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TwofaSetup } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { Avatar, Badge, CopyButton, Field, LoadingState } from '../ui/primitives';

// Seção "Minha conta": tudo que o admin mexe na própria conta sem sair do
// painel — trocar a senha (sem passar pelo "esqueci minha senha") e a A2F.
// O QR é gerado no cliente a partir do otpauth:// que o backend devolve — o
// segredo não passa por serviço externo.

function QrCode({ value }: { value: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    return qr.createSvgTag(5);
  }, [value]);
  return <div className="qr-box" dangerouslySetInnerHTML={{ __html: svg }} />;
}

const MAX_AVATAR_BYTES = 6 * 1024 * 1024;

function AvatarCard() {
  const dialogs = useDialogs();
  const { me, refresh } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Escolha um arquivo de imagem.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('A imagem deve ter no máximo 6 MB.');
      return;
    }
    setBusy(true);
    try {
      await api.uploadFile('/ads-admin/auth/me/avatar', file);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await dialogs.confirm('Remover sua foto de perfil?', {
      title: 'Remover foto',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    setError('');
    setBusy(true);
    try {
      await api.del('/ads-admin/auth/me/avatar');
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-card">
      <header>
        <h2>Foto de perfil</h2>
        <span className="muted">
          Aparece no rodapé do painel e ao lado do seu nome na equipe.
        </span>
      </header>

      <div className="avatar-row">
        <Avatar url={me?.avatar_url} fallback={me?.username || me?.email} size={72} />
        <div className="stack grow">
          <div className="actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {me?.avatar_url ? 'Trocar foto' : 'Escolher foto'}
            </button>
            {me?.avatar_url && (
              <button type="button" className="btn danger" disabled={busy} onClick={remove}>
                Remover
              </button>
            )}
          </div>
          <span className="muted">JPG, PNG, WEBP ou GIF, até 6 MB.</span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) upload(file);
        }}
      />
      {error && <div className="err">{error}</div>}
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setDone(false);
    if (next.length < 6) {
      setError('A nova senha deve ter ao menos 6 caracteres.');
      return;
    }
    if (next !== confirm) {
      setError('A confirmação não bate com a nova senha.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/ads-admin/auth/change-password', { current_password: current, new_password: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-card">
      <header>
        <h2>Senha</h2>
        <span className="muted">
          Troque a senha sem sair do painel — a sessão atual continua ativa.
        </span>
      </header>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) submit();
        }}
      >
        <Field label="Senha atual">
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="Nova senha" hint="Ao menos 6 caracteres.">
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field label="Confirmar nova senha">
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <button
          type="submit"
          className="btn primary lg block"
          disabled={busy || !current || !next || !confirm}
        >
          {busy ? 'Salvando…' : 'Alterar senha'}
        </button>
        {error && <div className="err">{error}</div>}
        {done && <div className="ok-text">Senha alterada.</div>}
      </form>
    </div>
  );
}

function TwoFactorCard() {
  const dialogs = useDialogs();
  const { refresh } = useAuth();
  const me = useAsync<{ two_factor_enabled: boolean }>(() =>
    api.get<{ two_factor_enabled: boolean }>('/ads-admin/auth/me'),
  );

  const [setup, setSetup] = useState<TwofaSetup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const reload = async () => {
    setSetup(null);
    setCode('');
    setError('');
    await me.reload();
    await refresh().catch(() => {
      /* o card já reflete o estado; o perfil global atualiza no próximo /auth/me */
    });
  };

  const startSetup = async () => {
    setError('');
    try {
      setSetup(await api.post<TwofaSetup>('/ads-admin/auth/2fa/setup'));
      setCode('');
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  const enable = async () => {
    setError('');
    try {
      await api.post('/ads-admin/auth/2fa/enable', { code: code.trim() });
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const disable = async () => {
    const ok = await dialogs.confirm('Desativar a autenticação de dois fatores?', {
      title: 'Desativar A2F',
      confirmLabel: 'Desativar',
    });
    if (!ok) return;
    setError('');
    try {
      await api.post('/ads-admin/auth/2fa/disable', { code: code.trim() });
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (me.loading) return <LoadingState />;
  if (me.error) return <div className="err">{me.error}</div>;

  const enabled = me.data?.two_factor_enabled ?? false;

  return (
    <div className="form-card">
      <div className="card-head">
        <div className="grow">
          <h2>Autenticação de dois fatores</h2>
        </div>
        <Badge tone={enabled ? 'green' : 'red'}>{enabled ? 'Ativa' : 'Inativa'}</Badge>
      </div>

      {enabled ? (
        <div className="stack" style={{ marginTop: 16 }}>
          <p className="muted">Sua conta exige um código do app autenticador a cada login.</p>
          <Field label="Código para desativar">
            <input
              className="code-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <button type="button" className="btn danger lg block" onClick={disable}>
            Desativar A2F
          </button>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 16 }}>
          <p className="muted">
            Adicione uma camada extra de segurança exigindo um código do Google Authenticator, Authy
            ou similar a cada login.
          </p>

          {!setup && (
            <button type="button" className="btn primary lg block" onClick={startSetup}>
              Ativar A2F
            </button>
          )}

          {setup && (
            <>
              <div className="step">
                <b>1.</b> Escaneie o QR code com seu app autenticador (Google Authenticator,
                Authy...).
              </div>
              <QrCode value={setup.otpauth_url} />

              <div className="step">Não consegue escanear? Use a chave manual:</div>
              <div className="secret-row">
                <span className="secret-text">
                  {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
                </span>
                <CopyButton text={setup.secret} label="Copiar" className="btn ghost" icon />
              </div>

              <div className="step">
                <b>2.</b> Digite o código de 6 dígitos que o app mostrar para confirmar.
              </div>
              <Field label="Código de verificação">
                <input
                  className="code-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>

              <div className="actions">
                <button type="button" className="btn" onClick={() => setSetup(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn primary"
                  style={{ flex: 1 }}
                  onClick={enable}
                >
                  Confirmar e ativar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <div className="err">{error}</div>}
    </div>
  );
}

export function Account() {
  return (
    <div style={{ maxWidth: 580 }}>
      <AvatarCard />
      <PasswordCard />
      <TwoFactorCard />
    </div>
  );
}
