import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setApiBase, setToken } from './api';

// Sessão do painel: quem está logado (e-mail + cargo) e o que isso libera.
// O servidor é a autoridade (403 em qualquer ação fora de rank); aqui só
// decidimos o que mostrar.

// Sessão persistida em localStorage pra sobreviver a um refresh (F5) — sem
// isso, token/apiBase ficavam só em memória (módulo `api.ts` + estado aqui)
// e qualquer reload da página derrubava a sessão. Guarda o servidor escolhido
// no login junto do token porque restaurar a sessão sem saber contra qual
// backend validá-la não funciona.
const STORAGE_KEY = 'daqui_ads_admin_session';

interface StoredSession {
  token: string;
  apiBase: string;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export interface Me {
  email: string;
  username: string;
  avatar_url?: string | null;
  role: string;
  two_factor_enabled: boolean;
}

interface AuthState {
  me: Me | null;
  /** true enquanto tenta restaurar uma sessão salva — evita piscar a tela de login. */
  restoring: boolean;
  signIn: (accessToken: string, apiBase: string) => Promise<Me>;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const stored = readStoredSession();
    if (!stored?.token || !stored.apiBase) {
      setRestoring(false);
      return;
    }
    setApiBase(stored.apiBase);
    setToken(stored.token);
    api
      .get<Me>('/ads-admin/auth/me')
      .then((profile) => setMe(profile))
      .catch(() => {
        setToken('');
        clearStoredSession();
      })
      .finally(() => setRestoring(false));
  }, []);

  const signIn = useCallback(async (accessToken: string, apiBase: string) => {
    setApiBase(apiBase);
    setToken(accessToken);
    try {
      const profile = await api.get<Me>('/ads-admin/auth/me');
      setMe(profile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: accessToken, apiBase }));
      return profile;
    } catch (e) {
      setToken('');
      throw e;
    }
  }, []);

  const signOut = useCallback(() => {
    setToken('');
    setMe(null);
    clearStoredSession();
  }, []);

  const refresh = useCallback(async () => {
    setMe(await api.get<Me>('/ads-admin/auth/me'));
  }, []);

  const value = useMemo(
    () => ({ me, restoring, signIn, signOut, refresh }),
    [me, restoring, signIn, signOut, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa de um <AuthProvider>.');
  return ctx;
}

/** Só Administrador/Owner gerenciam contas de staff. */
export function canManageStaff(role?: string): boolean {
  return role === 'administrador' || role === 'owner';
}
