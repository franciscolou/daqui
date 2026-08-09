import { Dispatch, SetStateAction, useState } from 'react';

// Memória volátil de navegação: sobrevive a desmontagens de rotas, mas é
// descartada quando o app/reload da página termina. É o comportamento esperado
// para rascunhos, filtros e posição dentro de uma seção durante a sessão.
const values = new Map<string, unknown>();

export function useScreenMemory<T>(key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (values.has(key)) return values.get(key) as T;
    const initial = initialValue instanceof Function ? initialValue() : initialValue;
    values.set(key, initial);
    return initial;
  });

  const setRememberedValue: Dispatch<SetStateAction<T>> = (next) => {
    setValue((current) => {
      const resolved = next instanceof Function ? next(current) : next;
      values.set(key, resolved);
      return resolved;
    });
  };

  return [value, setRememberedValue];
}

export function getScreenMemory<T>(key: string, fallback: T): T {
  return values.has(key) ? values.get(key) as T : fallback;
}

export function setScreenMemory<T>(key: string, value: T) {
  values.set(key, value);
}
