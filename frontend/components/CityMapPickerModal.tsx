import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';
import { CitySuggestion, reverseCity } from '../lib/geocode';
import LeafletMap from './LeafletMap';

interface CityMapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  /** Cidades já escolhidas (mesma lista do chip-picker que abriu este modal). */
  value: string[];
  onChange: (next: string[]) => void;
  /** Centro inicial do mapa. Padrão: São Paulo, um meio-termo nacional. */
  initialCenter?: { latitude: number; longitude: number };
  /** Limite de cidades (1 pra "cidade toda", `max_cities` do plano pra "várias cidades"). */
  max?: number | null;
}

type PickStatus = 'idle' | 'resolving' | 'resolved' | 'notfound' | 'outsidebr' | 'error';

const DEFAULT_CENTER = { latitude: -23.5505, longitude: -46.6333 };
const norm = (v: string) => v.trim().toLowerCase();

// Seleção de cidades no mapa — mesmo padrão POR ETAPAS do
// NeighborhoodMapPickerModal (toca → identifica → confirma), só que num zoom
// mais aberto e resolvendo a cidade (não o bairro) do ponto tocado via
// `reverseCity`. Companheiro do autocomplete de texto do CityPicker.
export default function CityMapPickerModal({
  visible,
  onClose,
  value,
  onChange,
  initialCenter = DEFAULT_CENTER,
  max,
}: CityMapPickerModalProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [status, setStatus] = useState<PickStatus>('idle');
  const [pending, setPending] = useState<CitySuggestion | null>(null);

  useEffect(() => {
    if (visible) {
      setStatus('idle');
      setPending(null);
    }
  }, [visible]);

  const atMax = max != null && value.length >= max;
  const alreadyAdded = !!pending && value.some((v) => norm(v) === norm(pending.name));

  const handlePick = async (coords: { latitude: number; longitude: number }) => {
    setStatus('resolving');
    setPending(null);
    try {
      const found = await reverseCity(coords.latitude, coords.longitude);
      if (!found) {
        setStatus('notfound');
        return;
      }
      if (found.countryCode !== 'br') {
        // O Daqui só atua no Brasil — mostra onde caiu o ponto, mas não deixa
        // confirmar (mesmo espírito da restrição de bairro no "Novo post").
        setPending(found);
        setStatus('outsidebr');
        return;
      }
      setPending(found);
      setStatus('resolved');
    } catch {
      setStatus('error');
    }
  };

  const confirmPending = () => {
    if (!pending || alreadyAdded || atMax) return;
    onChange(max === 1 ? [pending.name] : [...value, pending.name]);
    // Volta pro início: o próximo toque no mapa começa a etapa seguinte.
    setPending(null);
    setStatus('idle');
  };

  const removeChip = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('location.cityMapPicker.headerTitle')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {t('location.cityMapPicker.hint')}
          {max !== 1 ? t('location.cityMapPicker.hintRepeat') : ''}
        </Text>

        {value.length > 0 && (
          <View style={styles.chipList}>
            {value.map((name, idx) => (
              <View key={`${name}-${idx}`} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>{name}</Text>
                <TouchableOpacity style={styles.chipRemoveBtn} onPress={() => removeChip(idx)} hitSlop={8}>
                  <Ionicons name="close" size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.mapWrap, !isWide && styles.mapWrapMobile]}>
          {visible && (
            <LeafletMap
              center={initialCenter}
              zoom={10}
              markers={[]}
              pickable
              onPick={handlePick}
              style={styles.map}
            />
          )}
        </View>

        <View style={styles.footer}>
          <View style={[styles.footerInner, isWide && styles.footerInnerWide]}>
            <View style={isWide ? styles.footerStatusWide : undefined}>
              {status === 'idle' && (
                <Text style={styles.footerHint}>
                  {atMax
                    ? t(
                        max === 1
                          ? 'location.cityMapPicker.limitReached'
                          : 'location.cityMapPicker.limitReachedPlural',
                        { count: max },
                      )
                    : t('location.mapPicker.noPointSelected')}
                </Text>
              )}
              {status === 'resolving' && (
                <View style={styles.footerRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.footerHint}>{t('location.cityMapPicker.resolving')}</Text>
                </View>
              )}
              {status === 'resolved' && pending && (
                <View style={styles.footerRow}>
                  <Ionicons name="location" size={16} color={Colors.primary} />
                  <View style={styles.footerTextCol}>
                    <Text style={styles.footerName} numberOfLines={1}>{pending.name}</Text>
                    {!!pending.state && (
                      <Text style={styles.footerMeta} numberOfLines={1}>
                        {[pending.state, pending.country].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    {alreadyAdded && (
                      <Text style={styles.footerWarn}>{t('location.cityMapPicker.alreadyAdded')}</Text>
                    )}
                  </View>
                </View>
              )}
              {status === 'notfound' && (
                <View style={styles.footerRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.footerError} numberOfLines={2}>
                    {t('location.cityMapPicker.notFound')}
                  </Text>
                </View>
              )}
              {status === 'outsidebr' && pending && (
                <View style={styles.footerRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.footerError} numberOfLines={2}>
                    {t('location.cityMapPicker.outsideBr', {
                      country: pending.country || t('location.cityMapPicker.outsideBrFallbackCountry'),
                    })}
                  </Text>
                </View>
              )}
              {status === 'error' && (
                <View style={styles.footerRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.footerError} numberOfLines={2}>
                    {t('location.mapPicker.genericError')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.footerButtons}>
              <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
                <Text style={styles.doneBtnText}>{t('common.done')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (status !== 'resolved' || alreadyAdded || atMax) && styles.confirmBtnDisabled,
                ]}
                onPress={confirmPending}
                disabled={status !== 'resolved' || alreadyAdded || atMax}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.confirmBtnText,
                    (status !== 'resolved' || alreadyAdded || atMax) && styles.confirmBtnTextDisabled,
                  ]}
                >
                  {t('location.cityMapPicker.confirmButton')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 13, color: Colors.textSecondary, paddingHorizontal: 16, paddingBottom: 12 },

  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chipRemoveBtn: { borderRadius: 999 },
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

  mapWrap: { flex: 1, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  mapWrapMobile: { marginHorizontal: 0, borderRadius: 0 },
  map: { flex: 1, width: '100%', height: '100%' },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  footerInner: { gap: 12 },
  footerInnerWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  footerStatusWide: { flex: 1, minWidth: 0 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerTextCol: { flex: 1, minWidth: 0 },
  footerHint: { fontSize: 13, color: Colors.textTertiary },
  footerName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  footerMeta: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  footerWarn: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginTop: 2 },
  footerError: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '500' },

  footerButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  confirmBtnTextDisabled: { color: Colors.textTertiary },
});
