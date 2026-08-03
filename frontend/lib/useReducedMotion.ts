import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Na web, `react-native-web` espelha isso em `prefers-reduced-motion` via
// matchMedia; no nativo é a preferência de acessibilidade do sistema.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);

  return reduced;
}
