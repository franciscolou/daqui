import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useLocales } from 'expo-localization';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import ptBR from '../locales/pt-BR.json';
import en from '../locales/en.json';
import { getItem, setItem } from './storage';

/**
 * Idiomas suportados hoje. Adicionar um novo idioma = 1 arquivo em
 * locales/<code>.json (mesmas chaves de pt-BR.json) + 1 entrada aqui.
 */
export const SUPPORTED_LANGUAGES = ['pt', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** pt-BR é o padrão: é o mercado de origem do Daqui (bairros de SP). */
const DEFAULT_LANGUAGE: SupportedLanguage = 'pt';

/** 'auto' = segue o idioma do dispositivo (padrão); os demais são override manual. */
export type LanguagePreference = 'auto' | SupportedLanguage;

const LANGUAGE_KEY = 'daqui.language';

i18next.use(initReactI18next).init({
  resources: {
    pt: { translation: ptBR },
    en: { translation: en },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // sem HTML para escapar (React Native, não DOM)
});

/** Primeiro locale do dispositivo que batemos com um idioma suportado (ignora região: `en-US` -> `en`). */
function pickSupportedLanguage(deviceLocales: { languageCode: string | null }[]): SupportedLanguage {
  for (const locale of deviceLocales) {
    const code = locale.languageCode?.toLowerCase();
    if (code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as SupportedLanguage;
    }
  }
  return DEFAULT_LANGUAGE;
}

interface LanguageState {
  /** Idioma efetivamente ativo (já resolvido a partir da preferência + dispositivo). */
  language: SupportedLanguage;
  /** Preferência salva: 'auto' (padrão) ou um idioma fixado manualmente. */
  preference: LanguagePreference;
  setPreference: (pref: LanguagePreference) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // useLocales() (não getLocales()) porque é reativo: se o usuário muda o
  // idioma do SO com o app aberto, o app acompanha automaticamente enquanto
  // a preferência estiver em 'auto' — mesmo em web (troca de idioma do
  // navegador) quanto em nativo (Ajustes do iOS/Android).
  const deviceLocales = useLocales();
  const [preference, setPreferenceState] = useState<LanguagePreference>('auto');

  // Restaura a preferência salva (mesmo padrão do ThemeProvider).
  useEffect(() => {
    getItem(LANGUAGE_KEY).then((v) => {
      if (v === 'auto' || (SUPPORTED_LANGUAGES as readonly string[]).includes(v ?? '')) {
        setPreferenceState(v as LanguagePreference);
      }
    });
  }, []);

  const language = useMemo<SupportedLanguage>(
    () => (preference === 'auto' ? pickSupportedLanguage(deviceLocales) : preference),
    [preference, deviceLocales],
  );

  useEffect(() => {
    if (i18next.language !== language) i18next.changeLanguage(language);
  }, [language]);

  // `lang` no <html> é o sinal que leitores de tela e SEO usam pra saber o
  // idioma da página — só existe na web, não tem equivalente nativo.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = language;
  }, [language]);

  const setPreference = (pref: LanguagePreference) => {
    setPreferenceState(pref);
    setItem(LANGUAGE_KEY, pref).catch(() => {});
  };

  const value = useMemo<LanguageState>(
    () => ({ language, preference, setPreference }),
    [language, preference],
  );

  return (
    <I18nextProvider i18n={i18next}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  );
}

/** Idioma ativo + preferência (auto/pt/en) + setter, para a UI de configurações. */
export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage deve ser usado dentro de I18nProvider');
  return ctx;
}

/** Função de tradução — `const { t } = useT();` em qualquer componente sob I18nProvider. */
export const useT = useTranslation;
