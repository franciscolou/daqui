import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, setApiBase, setToken } from './api';
import { Me } from './types';

// Sessão do painel. Staff no Daqui é só um User com `staff_role` definido —
// quem não tem cargo não entra aqui (o backend também barra com 403).

interface AuthState {
  me: Me | null;
  appUrl: string;
  signIn: (accessToken: string, apiBase: string, appUrl: string) => Promise<Me>;
  signOut: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export class NotStaffError extends Error {
  constructor() {
    super('Esta conta não é moderadora.');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [appUrl, setAppUrl] = useState('');

  const signIn = useCallback(async (accessToken: string, apiBase: string, app: string) => {
    setApiBase(apiBase);
    setToken(accessToken);
    try {
      const profile = await api.get<Me>('/auth/me');
      if (!profile.staff_role) throw new NotStaffError();
      setAppUrl(app.replace(/\/$/, ''));
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

  const value = useMemo(
    () => ({ me, appUrl, signIn, signOut, refresh }),
    [me, appUrl, signIn, signOut, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa de um <AuthProvider>.');
  return ctx;
}

/** Só Administrador/Owner gerenciam contas de staff. */
export function canManageStaff(role?: string | null): boolean {
  return role === 'administrador' || role === 'owner';
}
