import { useEffect, useState } from 'react';
import { Availability } from './api';

export type AvailabilityStatus = 'idle' | 'checking' | 'ok' | 'error';
export type AvailabilityState = { status: AvailabilityStatus; error: string | null };

/**
 * Checa disponibilidade de um campo (username/e-mail) contra o backend, com
 * debounce. Só dispara quando `ready(value)` (evita checar valores obviamente
 * incompletos). Falha de rede não bloqueia: volta a 'idle'.
 */
export function useAvailability(
  value: string,
  check: (v: string) => Promise<Availability>,
  opts: { ready?: (v: string) => boolean; debounceMs?: number } = {},
): AvailabilityState {
  const { ready = (v) => v.trim().length > 0, debounceMs = 450 } = opts;
  const [state, setState] = useState<AvailabilityState>({ status: 'idle', error: null });

  useEffect(() => {
    const v = value.trim();
    if (!ready(v)) {
      setState({ status: 'idle', error: null });
      return;
    }
    let cancelled = false;
    setState({ status: 'checking', error: null });
    const timer = setTimeout(async () => {
      try {
        const r = await check(v);
        if (cancelled) return;
        setState(
          r.available
            ? { status: 'ok', error: null }
            : { status: 'error', error: r.error },
        );
      } catch {
        if (!cancelled) setState({ status: 'idle', error: null });
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return state;
}
