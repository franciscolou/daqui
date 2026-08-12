import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setApiBase, setToken } from './api';
import { Me } from './types';

// Sessão do painel. Staff no Daqui é só um User com `staff_role` definido —
// quem não tem cargo não entra aqui (o backend também barra com 403).

// Sessão persistida em localStorage pra sobreviver a um refresh (F5) — sem
// isso, token/apiBase/appUrl ficavam só em memória (módulo `api.ts` + estado
// aqui) e qualquer reload da página derrubava a sessão. Guarda o servidor
// escolhido no login junto do token porque restaurar a sessão sem saber
// contra qual backend validá-la não funciona.
const STORAGE_KEY = 'daqui_moderator_session';

interface StoredSession {
  token: string;
  apiBase: string;
  appUrl: string;
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

interface AuthState {
  me: Me | null;
  appUrl: string;
  /** true enquanto tenta restaurar uma sessão salva — evita piscar a tela de login. */
  restoring: boolean;
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
      .get<Me>('/auth/me')
      .then((profile) => {
        if (!profile.staff_role) throw new NotStaffError();
        setAppUrl(stored.appUrl.replace(/\/$/, ''));
        setMe(profile);
      })
      .catch(() => {
        setToken('');
        clearStoredSession();
      })
      .finally(() => setRestoring(false));
  }, []);

  const signIn = useCallback(async (accessToken: string, apiBase: string, app: string) => {
    setApiBase(apiBase);
    setToken(accessToken);
    try {
      const profile = await api.get<Me>('/auth/me');
      if (!profile.staff_role) throw new NotStaffError();
      const cleanAppUrl = app.replace(/\/$/, '');
      setAppUrl(cleanAppUrl);
      setMe(profile);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: accessToken, apiBase, appUrl: cleanAppUrl }),
      );
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
    setMe(await api.get<Me>('/auth/me'));
  }, []);

  const value = useMemo(
    () => ({ me, appUrl, restoring, signIn, signOut, refresh }),
    [me, appUrl, restoring, signIn, signOut, refresh],
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

/** Analytics de uso do Daqui é restrito ao Owner (ver core/deps.get_current_owner
 * no backend — mais restrito que canManageStaff acima). */
export function isOwner(role?: string | null): boolean {
  return role === 'owner';
}
