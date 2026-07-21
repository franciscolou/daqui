import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { searchNeighborhoods, NeighborhoodSuggestion } from '../lib/geocode';
import { Coords, getDeviceCoords } from '../lib/location';

// Seletor de bairros com autocomplete (typeahead) — substitui o antigo campo
// "bairros separados por vírgula". Enquanto o anunciante digita, sugestões vão
// aparecendo (nome · cidade · país), ordenadas por proximidade de onde ele
// está. "Enter" confirma a primeira sugestão; um texto que não bate com
// nenhuma sugestão ainda pode ser adicionado (chip "não verificado").
// Mesmo espírito do chip-picker do ads-admin, agora no app.

interface NeighborhoodPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  // Limite opcional (ex.: `max_neighborhoods` do plano). Ao atingir, o campo
  // de digitação some e mostramos o aviso de limite.
  max?: number | null;
}

export default function NeighborhoodPicker({ value, onChange, placeholder, max }: NeighborhoodPickerProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NeighborhoodSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  // Coordenadas do dispositivo (best-effort, silencioso) só pra ordenar as
  // sugestões por proximidade — se o usuário negar, seguimos sem ordenação.
  useEffect(() => {
    getDeviceCoords().then(setCoords).catch(() => {});
  }, []);

  const atMax = max != null && value.length >= max;

  const addChip = (name: string) => {
    const norm = name.trim();
    if (!norm) return;
    if (value.some((v) => v.toLowerCase() === norm.toLowerCase())) return;
    if (max != null && value.length >= max) return;
    onChange([...value, norm]);
    setQuery('');
    setSuggestions([]);
  };

  const removeChip = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const runSearch = (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    searchNeighborhoods(q, coords)
      .then((r) => { if (id === seq.current) setSuggestions(r); })
      .catch(() => { if (id === seq.current) setSuggestions([]); })
      .finally(() => { if (id === seq.current) setLoading(false); });
  };

  const onChangeQuery = (v: string) => {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v), 300);
  };

  // Enter confirma a primeira sugestão (se houver); senão adiciona o texto
  // digitado como bairro "não verificado". Vírgula tem o mesmo efeito.
  const onSubmit = () => {
    if (suggestions.length > 0) addChip(suggestions[0].name);
    else if (query.trim()) addChip(query);
  };

  return (
    <View style={styles.wrap}>
      {value.length > 0 && (
        <View style={styles.chipList}>
          {value.map((name, idx) => (
            <View key={`${name}-${idx}`} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>{name}</Text>
              <TouchableOpacity onPress={() => removeChip(idx)} hitSlop={8}>
                <Ionicons name="close" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {atMax ? (
        <Text style={styles.limitText}>Limite de {max} bairro{max === 1 ? '' : 's'} do plano atingido.</Text>
      ) : (
        <View style={styles.inputRow}>
          <Ionicons name="search" size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={onChangeQuery}
            onSubmitEditing={onSubmit}
            onKeyPress={(e) => {
              if (e.nativeEvent.key === ',') { e.preventDefault?.(); onSubmit(); }
            }}
            placeholder={placeholder || 'Digite o nome de um bairro...'}
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
          />
          {loading && <ActivityIndicator size="small" color={Colors.primary} />}
        </View>
      )}

      {!atMax && suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.label}-${i}`}
              style={[styles.suggestionRow, i === 0 && styles.suggestionRowFirst]}
              activeOpacity={0.7}
              onPress={() => addChip(s.name)}
            >
              <Ionicons name="location-outline" size={15} color={Colors.textTertiary} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.suggestionName} numberOfLines={1}>{s.name}</Text>
                {!!(s.city || s.country) && (
                  <Text style={styles.suggestionMeta} numberOfLines={1}>
                    {[s.city, s.country].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  wrap: { gap: 8 },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: Colors.primary, flexShrink: 1 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.text,
    outlineStyle: 'none',
  } as any,

  limitText: { fontSize: 12, fontWeight: '600', color: Colors.textTertiary },

  suggestions: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  suggestionRowFirst: { borderTopWidth: 0 },
  suggestionName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  suggestionMeta: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
});
