import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { DaquiProviders } from './daqui/DaquiProviders';
import { DialogsProvider } from './ui/dialogs';
import { Login } from './screens/Login';
import { ResetPassword } from './screens/ResetPassword';
import { Shell } from './screens/Shell';

// Três estados possíveis: redefinição de senha (link do e-mail), login, ou o
// painel em si. Não há rotas — o painel é uma tela só, com seções.
function Root() {
  const { me } = useAuth();
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(location.search).get('reset_token') ?? '',
  );

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
