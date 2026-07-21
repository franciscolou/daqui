import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { api, GeocodeResult } from '../lib/api';
import MapPickButton from './MapPickButton';

interface LocationAutocompleteInputProps {
  value: string;
  onChangeText: (v: string) => void;
  onSelect: (address: string) => void;
  // Opcional: recebe a sugestão inteira (com lat/lng), pra quem precisa das
  // coordenadas além do rótulo (ex.: pin do anúncio no mapa).
  onSelectResult?: (result: GeocodeResult) => void;
  onPickOnMap: () => void;
  status: 'idle' | 'valid';
  placeholder?: string;
}

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

// Campo de local com autocomplete (tipo iFood/Uber): busca sugestões de
// endereço conforme o usuário digita (debounced, já filtradas pro bairro dele
// via `/geo/search`) em vez de aceitar texto livre — escolher uma sugestão (ou
// marcar no mapa, via `onPickOnMap`) é a ÚNICA forma do local virar `valid`.
// Digitar algo vago como "Rua" mostra as ruas candidatas em vez de aceitar o
// texto como está.
export default function LocationAutocompleteInput({
  value,
  onChangeText,
  onSelect,
  onSelectResult,
  onPickOnMap,
  status,
  placeholder = 'Ex.: Rua das Flores 123, Praça...',
}: LocationAutocompleteInputProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (status === 'valid') {
      setSuggestions([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    const term = value.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    setSearched(false);
    const id = ++seq.current;
    timer.current = setTimeout(() => {
      setLoading(true);
      api
        .searchAddress(term)
        .then((results) => { if (id === seq.current) setSuggestions(results); })
        .catch(() => { if (id === seq.current) setSuggestions([]); })
        .finally(() => {
          if (id === seq.current) { setLoading(false); setSearched(true); }
        });
    }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, status]);

  const showEmpty = status !== 'valid' && searched && !loading && suggestions.length === 0;
  const showSuggestions = status !== 'valid' && !loading && suggestions.length > 0;

  return (
    <View>
      <View style={styles.inputRow}>
        <Ionicons name="location-outline" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          maxLength={120}
        />
        <MapPickButton onPress={onPickOnMap} />
      </View>

      {status !== 'valid' && loading && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.statusHint}>Buscando endereços…</Text>
        </View>
      )}

      {showSuggestions && (
        <View style={styles.suggestions}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.latitude}-${s.longitude}-${i}`}
              style={styles.suggestionRow}
              activeOpacity={0.7}
              onPress={() => { onSelect(s.label); onSelectResult?.(s); }}
            >
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.suggestionText} numberOfLines={2}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showEmpty && (
        <View style={styles.statusRow}>
          <Ionicons name="alert-circle" size={14} color={Colors.error} />
          <Text style={[styles.statusHint, { color: Colors.error }]}>
            Nenhum endereço encontrado no seu bairro.
          </Text>
        </View>
      )}

      {status === 'valid' && (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
          <Text style={[styles.statusHint, { color: Colors.primary }]}>
            Endereço confirmado no seu bairro
          </Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusHint: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  suggestions: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  suggestionText: { flex: 1, fontSize: 13, color: Colors.text, fontWeight: '500' },
});
