import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, View, ViewStyle } from 'react-native';
import { useT } from '../lib/i18n';

// Versão web — a lib nativa (@react-native-google-signin/google-signin) não
// tem suporte a web no plano gratuito (ver node_modules, GoogleSignin.web.ts
// só loga "not implemented"). Aqui falamos direto com o Google Identity
// Services (GIS), carregado sob demanda via <script>, e renderizamos o botão
// OFICIAL do Google — GIS não permite customizar o botão, então o visual
// difere do resto do formulário; é o preço de usar o fluxo suportado
// (clique precisa ser no elemento deles).

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<void> | null = null;
function loadGsiScript(): Promise<void> {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar o script do Google'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export default function GoogleSignInButton({
  style,
  onIdToken,
  onError,
}: {
  style?: StyleProp<ViewStyle>;
  // Ignorados na web (o botão é o oficial do Google, sem texto/cor customizável).
  textStyle?: unknown;
  onIdToken: (idToken: string) => void;
  onError?: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedWidth = useRef(0);
  const [width, setWidth] = useState(0);
  const { t } = useT();

  useEffect(() => {
    if (!CLIENT_ID || !width || !containerRef.current) return;
    // Evita re-renderizar o botão do Google por variações mínimas de layout
    // (ex.: scrollbar aparecendo) — só reage a mudanças de verdade.
    if (Math.abs(width - renderedWidth.current) < 8) return;
    renderedWidth.current = width;

    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            if (response.credential) onIdToken(response.credential);
            else onError?.(t('auth.login.googleError'));
          },
        });
        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: Math.round(Math.min(width, 400)),
        });
      })
      .catch(() => onError?.(t('auth.login.googleLoadError')));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, t]);

  if (!CLIENT_ID) return null;

  return (
    <View style={style} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <div ref={containerRef} />
    </View>
  );
}
