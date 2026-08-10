import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import GoogleGIcon from './GoogleGIcon';
import { useT } from '../lib/i18n';

// Versão web — a lib nativa (@react-native-google-signin/google-signin) não
// tem suporte a web no plano gratuito (ver node_modules, GoogleSignin.web.ts
// só loga "not implemented"). Aqui falamos direto com o Google Identity
// Services (GIS), carregado sob demanda via <script>.
//
// O botão OFICIAL do GIS (renderButton) só aceita algumas opções pré-
// definidas (tema/formato/texto) — não dá pra ter fundo translúcido igual ao
// resto do formulário nem texto só "Google". Pra ter a cara do app mesmo
// assim, desenhamos nosso próprio botão (idêntico ao nativo, mesmo
// GoogleGIcon) e sobrepomos o botão real do GIS por cima, com opacidade 0 —
// o clique continua acontecendo no elemento genuíno do Google (só ele pode
// abrir o popup de login, é assim que o GIS valida gesto do usuário), mas
// visualmente quem aparece é o nosso.
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
  textStyle,
  onIdToken,
  onError,
}: {
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
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
        // 'large' é o mais alto que o GIS oferece (~40px) — ainda assim mais
        // baixo que o nosso botão custom, então sobra uma faixa fina sem
        // clique real nas bordas verticais (ver comentário no topo do
        // arquivo). Sem opção de fixar altura exata no GIS.
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          size: 'large',
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
    // `style` (socialBtn) já define flexDirection:'row'/gap/alignItems — o
    // ícone e o texto abaixo são filhos diretos pra ficar lado a lado como no
    // nativo. O <div> do GIS fica fora do fluxo (position:absolute), então
    // não interfere nesse layout — só cobre a área por cima, invisível.
    <View
      style={[style, { position: 'relative', overflow: 'hidden' }]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <GoogleGIcon size={18} />
      <Text style={textStyle}>Google</Text>
      {/* Botão real do GIS, invisível, cobrindo toda a área — é ele quem
          recebe o clique de verdade. */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, opacity: 0 }}
      />
    </View>
  );
}
