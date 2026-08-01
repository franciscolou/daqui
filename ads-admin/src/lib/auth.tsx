import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, setApiBase, setToken } from './api';

// Sessão do painel: quem está logado (e-mail + cargo) e o que isso libera.
// O servidor é a autoridade (403 em qualquer ação fora de rank); aqui só
// decidimos o que mostrar.

export interface Me {
  email: string;
  role: string;
  two_factor_enabled: boolean;
}

interface AuthState {
  me: Me | null;
  signIn: (accessToken: string, apiBase: string) => Promise<Me>;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);

  const signIn = useCallback(async (accessToken: string, apiBase: string) => {
    setApiBase(apiBase);
    setToken(accessToken);
    try {
      const profile = await api.get<Me>('/auth/me');
      setMe(profile);
      return profile;
    } catch (e) {
      setToken('');
      throw e;
    }
  }, []);

  const signOut = useCallback(() => {
    setToken('');
    setMe(null);
  }, []);

  const refresh = useCallback(async () => {
    setMe(await api.get<Me>('/auth/me'));
  }, []);

  const value = useMemo(() => ({ me, signIn, signOut, refresh }), [me, signIn, signOut, refresh]);
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
