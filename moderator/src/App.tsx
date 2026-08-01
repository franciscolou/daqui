import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { DialogsProvider } from './ui/dialogs';
import { AcceptInvite } from './screens/AcceptInvite';
import { Login } from './screens/Login';
import { Shell } from './screens/Shell';

// Dois estados possíveis além do painel em si: aceitar convite de conta
// (link do e-mail) ou login. Não há rotas — o painel é uma tela só, com seções.
function Root() {
  const { me } = useAuth();
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

  return me ? <Shell /> : <Login />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DialogsProvider>
          <Root />
        </DialogsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
