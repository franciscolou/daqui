import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { api, ApiError } from '../lib/api';
import LeafletMap from './LeafletMap';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  // `coords` são as coordenadas do ponto escolhido — opcionais pra manter
  // compatível com quem só usa o endereço (ex.: publish geocodifica no backend).
  onConfirm: (address: string, coords?: { latitude: number; longitude: number }) => void;
  /** Centro inicial do mapa (ex.: coordenadas do bairro do usuário). */
  initialCenter: { latitude: number; longitude: number };
  /** Bairro do usuário — só é possível confirmar um ponto dentro dele. */
  neighborhood: string;
}

type PickStatus = 'idle' | 'resolving' | 'resolved' | 'error';

const norm = (v: string) => (v || '').trim().toLowerCase();

// Seletor de local em tela cheia: o usuário toca (ou arrasta o pin) no mapa
// pra marcar um ponto, a gente faz reverse geocoding (`/geo/resolve`) pra
// achar um endereço legível e confere que o ponto fica dentro do bairro do
// usuário — só assim o botão "Usar este local" habilita. O endereço volta pro
// campo de local já confirmado (`valid`), sem precisar geocodificar de novo.
export default function LocationPickerModal({
  visible,
  onClose,
  onConfirm,
  initialCenter,
  neighborhood,
}: LocationPickerModalProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [status, setStatus] = useState<PickStatus>('idle');
  const [label, setLabel] = useState<string | null>(null);
  const [pickedCoords, setPickedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStatus('idle');
      setLabel(null);
      setPickedCoords(null);
      setError(null);
    }
  }, [visible]);

  const handlePick = async (coords: { latitude: number; longitude: number }) => {
    setStatus('resolving');
    setError(null);
    try {
      const res = await api.resolveNeighborhood(coords.latitude, coords.longitude);
      if (norm(res.neighborhood) !== norm(neighborhood)) {
        setLabel(null);
        setPickedCoords(null);
        setStatus('error');
        setError(`Esse ponto fica em ${res.neighborhood}, fora do seu bairro (${neighborhood}).`);
        return;
      }
      setLabel(res.displayName);
      setPickedCoords(coords);
      setStatus('resolved');
    } catch (e) {
      setLabel(null);
      setPickedCoords(null);
      setStatus('error');
      setError(e instanceof ApiError ? e.message : 'Não foi possível identificar o endereço.');
    }
  };

  const confirm = () => {
    if (!label) return;
    onConfirm(label, pickedCoords ?? undefined);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Selecionar local no mapa</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Toque no mapa pra marcar o local — dá pra arrastar o pin depois</Text>

        <View style={[styles.mapWrap, !isWide && styles.mapWrapMobile]}>
          {visible && (
            <LeafletMap
              center={initialCenter}
              zoom={16}
              markers={[]}
              pickable
              onPick={handlePick}
              style={styles.map}
            />
          )}
        </View>

        <View style={styles.footer}>
          <View style={[styles.footerInner, isWide && styles.footerInnerWide]}>
            <View style={isWide ? styles.footerStatusWide : styles.footerStatus}>
              {status === 'idle' && (
                <Text style={styles.footerHint}>Nenhum ponto selecionado ainda.</Text>
              )}
              {status === 'resolving' && (
                <View style={styles.footerRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.footerHint}>Identificando o endereço…</Text>
                </View>
              )}
              {status === 'resolved' && label && (
                <View style={styles.footerRow}>
                  <Ionicons name="location" size={16} color={Colors.primary} />
                  <Text style={styles.footerAddress} numberOfLines={2}>{label}</Text>
                </View>
              )}
              {status === 'error' && (
                <View style={styles.footerRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.footerError} numberOfLines={2}>{error}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.confirmBtn,
                isWide && styles.confirmBtnWide,
                status !== 'resolved' && styles.confirmBtnDisabled,
              ]}
              onPress={confirm}
              disabled={status !== 'resolved'}
              activeOpacity={0.85}
            >
              <Text style={[styles.confirmBtnText, status !== 'resolved' && styles.confirmBtnTextDisabled]}>
                Usar este local
              </Text>
            </TouchableOpacity>
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
  hint: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  mapWrap: { flex: 1, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  // Mobile: mapa de ponta a ponta, sem margem nem cantos arredondados —
  // maximiza a área de toque num viewport estreito.
  mapWrapMobile: { marginHorizontal: 0, borderRadius: 0 },
  map: { flex: 1, width: '100%', height: '100%' },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  // Mobile: pilha cheia (status em cima, botão largo embaixo) — igual antes.
  footerInner: { gap: 12 },
  // Desktop: uma linha compacta, centralizada e com largura máxima, pra não
  // esticar o status/botão pela tela toda em telas bem largas.
  footerInnerWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  footerStatus: {},
  footerStatusWide: { flex: 1, minWidth: 0 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerHint: { fontSize: 13, color: Colors.textTertiary },
  footerAddress: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  footerError: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '500' },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnWide: { paddingHorizontal: 32, alignSelf: 'center' },
  confirmBtnDisabled: { backgroundColor: Colors.border },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  confirmBtnTextDisabled: { color: Colors.textTertiary },
});
