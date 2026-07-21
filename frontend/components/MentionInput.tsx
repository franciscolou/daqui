import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TextInputProps, TouchableOpacity, Image, ActivityIndicator,
  StyleSheet, StyleProp, ViewStyle, TextStyle, NativeSyntheticEvent,
  TextInputSelectionChangeEventData, TextInputKeyPressEventData,
} from 'react-native';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { api } from '../lib/api';
import { User } from '../data/mock';

// Campo de texto com menção de usuários (@handle) — mesmo comportamento das
// redes sociais: ao digitar "@" seguido de um nome, aparece um sugeridor
// dinâmico (busca on-type, com debounce) mostrando foto, nome e @username;
// escolher (toque ou Enter) insere "@username " no ponto certo do texto.
// Reaproveitável em qualquer composer (post, comentário, etc.).

// Detecta a menção "ativa": um "@" logo antes do cursor, sem espaço no meio.
// Aceita qualquer caractere que não seja espaço/@ na parte digitada (permite
// buscar por nome com acento, não só pelo username).
function activeMention(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(?:^|\s)@([^\s@]{0,40})$/);
  if (!m) return null;
  return { query: m[1], start: caret - m[1].length - 1 };
}

interface MentionInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> {
  value: string;
  onChangeText: (v: string) => void;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  // Onde abrir o dropdown: 'down' (padrão) ou 'up' (composer no rodapé).
  dropdownDirection?: 'up' | 'down';
  inputRef?: React.Ref<TextInput>;
  // Quando definido, as sugestões saem SÓ desta lista (filtro local por
  // nome/@username) em vez da busca global — usado em conversas de grupo, onde
  // só dá pra mencionar membros. Passe [] pra "nenhum candidato ainda".
  candidates?: User[];
}

export default function MentionInput({
  value, onChangeText, style, containerStyle, dropdownDirection = 'down', inputRef,
  candidates, onSelectionChange, onKeyPress, onLayout, multiline, ...rest
}: MentionInputProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [caret, setCaret] = useState(0);
  const [forceSelection, setForceSelection] = useState<{ start: number; end: number } | null>(null);
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputHeight, setInputHeight] = useState<number | null>(null);
  const [caretLineBottom, setCaretLineBottom] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const active = activeMention(value, caret);
  const query = active?.query ?? null;

  // Busca on-type sempre que a menção ativa muda. Com `candidates`, filtra
  // localmente (grupo → só membros); senão, busca global com debounce.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query == null || query.length < 1) { setResults([]); setLoading(false); return; }
    if (candidates) {
      const q = query.toLowerCase();
      setLoading(false);
      setResults(
        candidates
          .filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
          .slice(0, 6),
      );
      return;
    }
    setLoading(true);
    const id = ++seq.current;
    timer.current = setTimeout(() => {
      api.search(query, 'users')
        .then((r) => { if (id === seq.current) setResults(r.users.slice(0, 6)); })
        .catch(() => { if (id === seq.current) setResults([]); })
        .finally(() => { if (id === seq.current) setLoading(false); });
    }, 180);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, candidates]);

  const open = query != null && query.length >= 1 && (loading || results.length > 0);

  // Em caixas multilinha (o composer de post, alto e majoritariamente vazio),
  // ancorar o dropdown embaixo da linha atual (perto do "@" digitado) em vez
  // de embaixo da caixa inteira. Pra saber onde a linha atual termina de
  // verdade — inclusive quando ela quebrou por largura (wrap), não só por
  // "\n" explícito — usamos um <Text> espelho invisível, com a mesma fonte e
  // largura do campo, contendo o texto até o cursor; a ALTURA que esse
  // espelho ocupa (medida via onLayout, mesmo motor de quebra de linha do
  // TextInput real) é exatamente o offset onde a linha do cursor acaba.
  const needsMirror = !!multiline && dropdownDirection === 'down';
  const flatStyle = StyleSheet.flatten(style) as TextStyle;
  const { minHeight: _minHeight, maxHeight: _maxHeight, height: _height, ...mirrorBaseStyle } = flatStyle ?? {};
  const mirrorStyle: TextStyle = {
    ...mirrorBaseStyle,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingBottom: 0,
    opacity: 0,
  };
  const anchorTop = needsMirror && caretLineBottom != null
    ? Math.min(caretLineBottom, inputHeight ?? caretLineBottom)
    : null;

  const handleLayout: TextInputProps['onLayout'] = (e) => {
    setInputHeight(e.nativeEvent.layout.height);
    onLayout?.(e);
  };

  const pick = (u: User) => {
    if (!active) return;
    const insert = `@${u.username} `;
    const next = value.slice(0, active.start) + insert + value.slice(caret);
    const newCaret = active.start + insert.length;
    onChangeText(next);
    setCaret(newCaret);
    setForceSelection({ start: newCaret, end: newCaret });
    setResults([]);
    seq.current++; // cancela buscas em voo
  };

  const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setCaret(e.nativeEvent.selection.start);
    if (forceSelection) setForceSelection(null);
    onSelectionChange?.(e);
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = e.nativeEvent.key;
    if (open && results.length > 0) {
      // Enter/Tab confirmam a primeira sugestão; Escape fecha — sem submeter.
      if (key === 'Enter' || key === 'Tab') {
        (e as unknown as { preventDefault?: () => void }).preventDefault?.();
        pick(results[0]);
        return;
      }
      if (key === 'Escape') { setResults([]); return; }
    }
    onKeyPress?.(e);
  };

  return (
    <View style={[styles.container, containerStyle, open && styles.containerOpen]}>
      <TextInput
        ref={inputRef}
        style={style}
        value={value}
        onChangeText={onChangeText}
        selection={forceSelection ?? undefined}
        onSelectionChange={handleSelectionChange}
        onKeyPress={handleKeyPress}
        onLayout={handleLayout}
        multiline={multiline}
        {...rest}
      />
      {needsMirror && (
        <Text
          style={mirrorStyle}
          pointerEvents="none"
          onLayout={(e) => setCaretLineBottom(e.nativeEvent.layout.height)}
        >
          {value.slice(0, caret) + '​'}
        </Text>
      )}
      {open && (
        <View
          style={[
            styles.dropdown,
            dropdownDirection === 'up'
              ? styles.dropdownUp
              : anchorTop != null ? { top: anchorTop, marginTop: 4 } : styles.dropdownDown,
          ]}
        >
          {loading && results.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Buscando…</Text>
            </View>
          ) : (
            results.map((u) => (
              <TouchableOpacity key={u.id} style={styles.row} activeOpacity={0.7} onPress={() => pick(u)}>
                <Image source={{ uri: u.avatar }} style={styles.avatar} />
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
                  <Text style={styles.username} numberOfLines={1}>@{u.username}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { position: 'relative' },
  // No web, cada View vira sua própria stacking context (RN Web aplica
  // position:relative + z-index:0 por padrão), então o z-index alto do
  // dropdown fica "preso" dentro deste container e não basta sozinho pra
  // vencer irmãos depois dele na árvore (ex.: o contador de caracteres, ou —
  // combinado com o zIndex do wrapper do campo na tela — o botão de
  // publicar). Elevar o container também, só enquanto o dropdown está
  // aberto, resolve isso.
  containerOpen: { zIndex: 1000 },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 4,
    zIndex: 1000,
    // sombra p/ destacar sobre o conteúdo
    ...(Colors.shadow?.md ?? {}),
    elevation: 8,
    maxHeight: 240,
    overflow: 'hidden',
  },
  dropdownDown: { top: '100%', marginTop: 4 },
  dropdownUp: { bottom: '100%', marginBottom: 4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  loadingText: { fontSize: 13, color: Colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.borderLight },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.text },
  username: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
});
