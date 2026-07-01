import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, loadToken, setToken, LoginResult } from './api';
import { User } from '../data/mock';

interface AuthState {
  user: User | null;
  loading: boolean;
  signedIn: boolean;
  // Retorna { status: 'ok' } quando a sessão foi criada, ou { status: '2fa' }
  // quando ainda falta o código do segundo fator (completar com verifyLogin2fa).
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyLogin2fa: (ticket: string, code: string) => Promise<void>;
  signup: (payload: {
    name: string;
    email: string;
    password: string;
    neighborhood: string;
    city: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restaura sessão a partir do token salvo
  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          setUser(await api.me());
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    if (result.status === 'ok') {
      await setToken(result.token);
      setUser(await api.me());
    }
    return result;
  }, []);

  const verifyLogin2fa = useCallback(async (ticket: string, code: string) => {
    const token = await api.loginVerify2fa(ticket, code);
    await setToken(token);
    setUser(await api.me());
  }, []);

  const signup = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      neighborhood: string;
      city: string;
    }) => {
      const token = await api.signup(payload);
      await setToken(token);
      setUser(await api.me());
    },
    [],
  );

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    setUser(await api.me());
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signedIn: !!user,
      login,
      verifyLogin2fa,
      signup,
      logout,
      refresh,
    }),
    [user, loading, login, verifyLogin2fa, signup, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
