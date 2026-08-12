import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { DaquiProviders } from './daqui/DaquiProviders';
import { DialogsProvider } from './ui/dialogs';
import { AcceptInvite } from './screens/AcceptInvite';
import { Login } from './screens/Login';
import { ResetPassword } from './screens/ResetPassword';
import { Shell } from './screens/Shell';
import { LoadingState } from './ui/primitives';

// Quatro estados possíveis: aceitar convite de conta (link do e-mail),
// redefinição de senha (idem), login, ou o painel em si. Não há rotas — o
// painel é uma tela só, com seções.
function Root() {
  const { me, restoring } = useAuth();
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(location.search).get('reset_token') ?? '',
  );
  const [inviteToken, setInviteToken] = useState(
    () => new URLSearchParams(location.search).get('invite_token') ?? '',
  );

  if (inviteToken) {
    return (
      <AcceptInvite
        token={inviteToken}
        onDone={() => {
          history.replaceState(null, '', location.pathname);
          setInviteToken('');
        }}
      />
    );
  }

  if (resetToken) {
    return (
      <ResetPassword
        token={resetToken}
        onDone={() => {
          history.replaceState(null, '', location.pathname);
          setResetToken('');
        }}
      />
    );
  }

  if (restoring) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <LoadingState label="Restaurando sessão…" />
      </div>
    );
  }

  return me ? <Shell /> : <Login />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DaquiProviders>
          <DialogsProvider>
            <Root />
          </DialogsProvider>
        </DaquiProviders>
      </AuthProvider>
    </ThemeProvider>
  );
}
