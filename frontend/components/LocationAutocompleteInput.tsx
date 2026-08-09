import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { MIN_QUERY_LENGTH, SEARCH_DEBOUNCE_MS } from '../constants/config';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';
import { GeoSearchResult, useGeo } from '../lib/geoProvider';
import MapPickButton from './MapPickButton';

interface LocationAutocompleteInputProps {
  value: string;
  onChangeText: (v: string) => void;
  onSelect: (address: string) => void;
  // Opcional: recebe a sugestão inteira (com lat/lng), pra quem precisa das
  // coordenadas além do rótulo (ex.: pin do anúncio no mapa).
  onSelectResult?: (result: GeoSearchResult) => void;
  onPickOnMap: () => void;
  status: 'idle' | 'valid';
  placeholder?: string;
  // Textos de status. O padrão fala em "seu bairro" porque no app Daqui a
  // busca é mesmo restrita ao bairro do usuário; no ads-admin, onde o admin
  // busca em todo o Brasil, quem monta passa mensagens sem essa restrição.
  emptyHint?: string;
  validHint?: string;
}

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
  placeholder,
  emptyHint,
  validHint,
}: LocationAutocompleteInputProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const resolvedPlaceholder = placeholder ?? t('location.autocomplete.placeholder');
  const resolvedEmptyHint = emptyHint ?? t('location.autocomplete.emptyHint');
  const resolvedValidHint = validHint ?? t('location.autocomplete.validHint');
  const { searchAddress } = useGeo();
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
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
      searchAddress(term)
        .then((results) => { if (id === seq.current) setSuggestions(results); })
        .catch(() => { if (id === seq.current) setSuggestions([]); })
        .finally(() => {
          if (id === seq.current) { setLoading(false); setSearched(true); }
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, status, searchAddress]);

  const showEmpty = status !== 'valid' && searched && !loading && suggestions.length === 0;
  const showSuggestions = status !== 'valid' && !loading && suggestions.length > 0;

  return (
    <View>
      <View style={styles.inputRow}>
        <Ionicons name="location-outline" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.input}
          placeholder={resolvedPlaceholder}
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
          <Text style={styles.statusHint}>{t('location.autocomplete.searching')}</Text>
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
          <Text style={[styles.statusHint, { color: Colors.error }]}>{resolvedEmptyHint}</Text>
        </View>
      )}

      {status === 'valid' && (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
          <Text style={[styles.statusHint, { color: Colors.primary }]}>{resolvedValidHint}</Text>
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
