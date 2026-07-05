import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

type ScrollHandler = () => void;

interface ScrollToTopContextValue {
  /** Registra o handler de "voltar ao topo" da tela `key`. Devolve uma função de limpeza. */
  register: (key: string, handler: ScrollHandler) => () => void;
  /** Dispara o handler registrado para `key`, se houver. */
  trigger: (key: string) => void;
}

const ScrollToTopContext = createContext<ScrollToTopContextValue | null>(null);

/** Permite que a barra de abas (mobile) e a barra lateral (desktop) mandem a
 * tela ativa rolar suavemente até o topo ao tocar de novo na aba em que já se está. */
export function ScrollToTopProvider({ children }: { children: React.ReactNode }) {
  const handlers = useRef(new Map<string, ScrollHandler>());

  const register = useCallback((key: string, handler: ScrollHandler) => {
    handlers.current.set(key, handler);
    return () => {
      if (handlers.current.get(key) === handler) handlers.current.delete(key);
    };
  }, []);

  const trigger = useCallback((key: string) => {
    handlers.current.get(key)?.();
  }, []);

  return (
    <ScrollToTopContext.Provider value={{ register, trigger }}>
      {children}
    </ScrollToTopContext.Provider>
  );
}

export function useScrollToTop() {
  const ctx = useContext(ScrollToTopContext);
  if (!ctx) throw new Error('useScrollToTop deve ser usado dentro de ScrollToTopProvider');
  return ctx;
}

/** Registra `handler` como o "voltar ao topo" da aba `key` enquanto o componente está montado. */
export function useRegisterScrollToTop(key: string, handler: ScrollHandler) {
  const { register } = useScrollToTop();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => register(key, () => handlerRef.current()), [key, register]);
}
