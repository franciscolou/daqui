import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import { darkColors, lightColors, Palette } from '../constants/Colors';
import { getItem, setItem } from './storage';

type Mode = 'light' | 'dark';

interface ThemeState {
  mode: Mode;
  colors: Palette;
  toggle: () => void;
  setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const THEME_KEY = 'daqui.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );

  // Restaura a preferência salva
  useEffect(() => {
    getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark') setModeState(v);
    });
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    setItem(THEME_KEY, m).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      setItem(THEME_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const colors = mode === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeState>(
    () => ({ mode, colors, toggle, setMode }),
    [mode, colors, toggle, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Paleta ativa. Fora do provider, cai para o tema claro. */
export function useTheme(): Palette {
  const ctx = useContext(ThemeContext);
  return ctx ? ctx.colors : lightColors;
}

/** Modo atual + controles (toggle/setMode). */
export function useThemeMode(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode deve ser usado dentro de ThemeProvider');
  return ctx;
}

/** Cria estilos a partir da paleta ativa, memoizando por tema. */
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
