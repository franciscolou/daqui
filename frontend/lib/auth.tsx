import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { router } from 'expo-router';
import InfoModal from '../components/InfoModal';
import { api, loadToken, setForceLogoutHandler, setToken, LoginResult } from './api';
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
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [sessionEndedMessage, setSessionEndedMessage] = useState<string | null>(null);
  const forceLoggingOut = useRef(false);

  const showPendingNotice = useCallback((u: User) => {
    if (u.pendingNotice) setNoticeMessage(u.pendingNotice);
  }, []);

  // Sessão suspensa: o backend responde 423 em qualquer chamada autenticada.
  // Encerra a sessão na hora, com aviso, e volta para a mesma tela de welcome
  // de quem nunca entrou (não a tela de login).
  useEffect(() => {
    setForceLogoutHandler((message) => {
      if (forceLoggingOut.current) return;
      forceLoggingOut.current = true;
      setToken(null);
      setUser(null);
      setSessionEndedMessage(message);
      router.replace('/(auth)/welcome');
      setTimeout(() => {
        forceLoggingOut.current = false;
      }, 2000);
    });
    return () => setForceLogoutHandler(null);
  }, []);

  // Restaura sessão a partir do token salvo
  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const u = await api.me();
          setUser(u);
          showPendingNotice(u);
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
  }, [showPendingNotice]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    if (result.status === 'ok') {
      await setToken(result.token);
      const u = await api.me();
      setUser(u);
      showPendingNotice(u);
    }
    return result;
  }, [showPendingNotice]);

  const verifyLogin2fa = useCallback(async (ticket: string, code: string) => {
    const token = await api.loginVerify2fa(ticket, code);
    await setToken(token);
    const u = await api.me();
    setUser(u);
    showPendingNotice(u);
  }, [showPendingNotice]);

  const signup = useCallback(
    async (payload: {
      name: string;
      username: string;
      email: string;
      password: string;
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

  return (
    <AuthContext.Provider value={value}>
      {children}
      <InfoModal
        visible={!!noticeMessage}
        variant="info"
        title="Aviso da moderação"
        message={noticeMessage ?? ''}
        onClose={() => setNoticeMessage(null)}
      />
      <InfoModal
        visible={!!sessionEndedMessage}
        variant="danger"
        title="Sessão encerrada"
        message={sessionEndedMessage ?? ''}
        onClose={() => setSessionEndedMessage(null)}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
