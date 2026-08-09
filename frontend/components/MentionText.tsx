import { useState } from 'react';
import { Linking, Text, StyleProp, TextStyle } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import ExternalLinkModal, { shouldSkipExternalLinkWarning } from './ExternalLinkModal';

// Renderiza um texto transformando cada "@usuario" em link para o perfil —
// mesma ideia das redes sociais. O texto continua sendo guardado como string
// pura (com o @handle literal); a resolução handle → id acontece só ao tocar.

// Mesmo conjunto de caracteres do handle no backend (models/notification.py /
// services/mentions.py). Exige uma borda antes do @ pra não linkar e-mails.
const TOKEN_RE = /(?:https?:\/\/|www\.)[^\s<>]+|@([a-zA-Z0-9_.]{2,30})/gi;
const TRAILING_URL_PUNCTUATION_RE = /[.,;:!?\]\}]+$/;

interface Part { text: string; handle?: string; url?: string }

function splitInteractiveText(text: string, mentionsEnabled: boolean): Part[] {
  const parts: Part[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const at = m.index;
    const token = m[0];
    const isUrl = /^(?:https?:\/\/|www\.)/i.test(token);
    if (isUrl) {
      let urlText = token.replace(TRAILING_URL_PUNCTUATION_RE, '');
      while (urlText.endsWith(')') && (urlText.match(/\(/g)?.length ?? 0) < (urlText.match(/\)/g)?.length ?? 0)) {
        urlText = urlText.slice(0, -1);
      }
      if (at > last) parts.push({ text: text.slice(last, at) });
      parts.push({ text: urlText, url: urlText.startsWith('www.') ? `https://${urlText}` : urlText });
      last = at + urlText.length;
      continue;
    }
    if (!mentionsEnabled) continue;
    const prev = at > 0 ? text[at - 1] : '';
    // Só é menção se o caractere anterior for uma borda (evita e-mails/handles
    // colados a outra palavra). Senão, deixa como texto normal.
    if (prev && /[\w@]/.test(prev)) continue;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ text: token, handle: m[1] });
    last = at + token.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

async function openMention(handle: string) {
  try {
    // Confirma que a conta existe antes de navegar; usa o username canônico
    // devolvido pelo backend (normalizado), não o texto digitado na menção.
    const u = await api.getUserByUsername(handle);
    router.push(`/user/${u.username}` as any);
  } catch {
    // handle sem conta correspondente — não faz nada.
  }
}

interface MentionTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  mentionsEnabled?: boolean;
}

export default function MentionText({ children, style, linkStyle, numberOfLines, mentionsEnabled = true }: MentionTextProps) {
  const Colors = useTheme();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const text = children ?? '';

  const parts = splitInteractiveText(text, mentionsEnabled);
  const linkColor = { color: Colors.primary, fontWeight: '600' as const };

  const openExternalLink = async (url: string) => {
    if (await shouldSkipExternalLinkWarning()) {
      await Linking.openURL(url).catch(() => {});
      return;
    }
    setPendingUrl(url);
  };

  return (
    <>
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.handle || p.url ? (
          <Text
            key={i}
            style={[linkColor, p.url && { textDecorationLine: 'underline' }, linkStyle]}
            onPress={(e) => {
              (e as unknown as { stopPropagation?: () => void }).stopPropagation?.();
              if (p.url) openExternalLink(p.url);
              else openMention(p.handle!);
            }}
            suppressHighlighting
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
    <ExternalLinkModal url={pendingUrl} onClose={() => setPendingUrl(null)} />
    </>
  );
}
