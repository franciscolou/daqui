import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { DialogsProvider } from './ui/dialogs';
import { Login } from './screens/Login';
import { Shell } from './screens/Shell';

function Root() {
  const { me } = useAuth();
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
