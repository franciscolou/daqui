import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Tema claro/escuro do painel. O `data-theme` no <html> já foi aplicado por um
// script inline no index.html (evita o flash do tema errado no primeiro
// paint); aqui cuidamos do toggle e de persistir a escolha.

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'daqui-ads-admin-theme';

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

function currentMode(): ThemeMode {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(currentMode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* modo privado/storage bloqueado: o tema só não persiste */
    }
  }, [mode]);

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode precisa de um <ThemeProvider>.');
  return ctx;
}
