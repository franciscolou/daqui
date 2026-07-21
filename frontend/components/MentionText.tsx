import { Text, StyleProp, TextStyle } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';

// Renderiza um texto transformando cada "@usuario" em link para o perfil —
// mesma ideia das redes sociais. O texto continua sendo guardado como string
// pura (com o @handle literal); a resolução handle → id acontece só ao tocar.

// Mesmo conjunto de caracteres do handle no backend (models/notification.py /
// services/mentions.py). Exige uma borda antes do @ pra não linkar e-mails.
const MENTION_RE = /@([a-zA-Z0-9_.]{2,30})/g;

interface Part { text: string; handle?: string }

function splitMentions(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    const at = m.index;
    const prev = at > 0 ? text[at - 1] : '';
    // Só é menção se o caractere anterior for uma borda (evita e-mails/handles
    // colados a outra palavra). Senão, deixa como texto normal.
    if (prev && /[\w@]/.test(prev)) continue;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ text: m[0], handle: m[1] });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

async function openMention(handle: string) {
  try {
    const u = await api.getUserByUsername(handle);
    router.push(`/user/${u.id}` as any);
  } catch {
    // handle sem conta correspondente — não faz nada.
  }
}

interface MentionTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export default function MentionText({ children, style, linkStyle, numberOfLines }: MentionTextProps) {
  const Colors = useTheme();
  const text = children ?? '';

  // Caminho rápido: sem "@", nada a fazer.
  if (!text.includes('@')) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  const parts = splitMentions(text);
  const linkColor = { color: Colors.primary, fontWeight: '600' as const };

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.handle ? (
          <Text
            key={i}
            style={[linkColor, linkStyle]}
            onPress={(e) => { (e as unknown as { stopPropagation?: () => void }).stopPropagation?.(); openMention(p.handle!); }}
            suppressHighlighting
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}
