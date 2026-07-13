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

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

  // Tom do hover/pressed no web (globalStyles.web.ts lê essas custom
  // properties): a própria cor de texto do tema, em baixa opacidade — assim
  // escurece no claro e clareia no escuro automaticamente, sempre com o tom
  // certo da paleta em vez de um cinza neutro fixo que destoa do fundo
  // (ficava visivelmente "errado"/feio no escuro, por exemplo).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--hover-tint', hexToRgba(colors.text, mode === 'dark' ? 0.07 : 0.05));
    root.style.setProperty('--hover-tint-active', hexToRgba(colors.text, mode === 'dark' ? 0.13 : 0.09));
  }, [colors, mode]);

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
