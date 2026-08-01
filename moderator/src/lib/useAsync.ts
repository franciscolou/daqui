import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  /** Atualiza os dados em memória, sem ida ao servidor. */
  setData: (updater: (prev: T) => T) => void;
}

/**
 * Carrega dados na montagem (e quando `deps` mudam), com o de sempre em
 * volta: loading, erro em texto e um `reload` pra chamar depois de uma ação.
 * Respostas fora de ordem são descartadas pelo contador de sequência.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const result = await fn();
      if (id !== seq.current || !alive.current) return;
      setDataState(result);
    } catch (e) {
      if (id !== seq.current || !alive.current) return;
      setError(errorMessage(e));
    } finally {
      if (id === seq.current && alive.current) setLoading(false);
    }
    // `fn` é recriada a cada render de quem chama; as deps declaradas é que
    // definem quando recarregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  const setData = useCallback((updater: (prev: T) => T) => {
    setDataState((prev) => (prev == null ? prev : updater(prev)));
  }, []);

  return { data, loading, error, reload: run, setData };
}
