import { useEffect, useState } from 'react';

export interface WebLocale {
  languageCode: string | null;
}

function browserLocales(): WebLocale[] {
  const tags =
    typeof navigator === 'undefined'
      ? ['pt-BR']
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language || 'pt-BR'];

  return tags.map((tag) => ({ languageCode: tag.split('-')[0]?.toLowerCase() || null }));
}

/** Equivalente web da parte de expo-localization usada pelo i18n compartilhado. */
export function useLocales(): WebLocale[] {
  const [locales, setLocales] = useState<WebLocale[]>(browserLocales);

  useEffect(() => {
    const update = () => setLocales(browserLocales());
    window.addEventListener('languagechange', update);
    return () => window.removeEventListener('languagechange', update);
  }, []);

  return locales;
}
