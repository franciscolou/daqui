import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TwofaSetup } from '../lib/types';
import { useAsync } from '../lib/useAsync';
import { useDialogs } from '../ui/dialogs';
import { Badge, CopyButton, Field, LoadingState } from '../ui/primitives';

// A2F da própria conta de staff. Staff no Daqui é só um User com `staff_role`
// definido, então usa os mesmos endpoints genéricos de A2F de qualquer
// usuário. O QR é gerado no cliente a partir do otpauth:// que o backend
// devolve — o segredo não passa por serviço externo.

function QrCode({ value }: { value: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    return qr.createSvgTag(5);
  }, [value]);
  return <div className="qr-box" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Security() {
  const dialogs = useDialogs();
  const { refresh } = useAuth();
  const me = useAsync<{ two_factor_enabled: boolean }>(() =>
    api.get<{ two_factor_enabled: boolean }>('/auth/me'),
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
      setSetup(await api.post<TwofaSetup>('/auth/2fa/setup'));
      setCode('');
    } catch (e) {
      dialogs.alert(errorMessage(e), 'Erro');
    }
  };

  const enable = async () => {
    setError('');
    try {
      await api.post('/auth/2fa/enable', { code: code.trim() });
      await reload();
      dialogs.alert('Autenticação de dois fatores ativada com sucesso.', 'Sucesso');
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
      await api.post('/auth/2fa/disable', { code: code.trim() });
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (me.loading) return <LoadingState />;
  if (me.error) return <div className="err">{me.error}</div>;

  const enabled = me.data?.two_factor_enabled ?? false;

  return (
    <div className="form-card" style={{ maxWidth: 580 }}>
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
