import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { useT } from '../lib/i18n';
import { SALE_RADIUS_MIN_KM, SALE_RADIUS_MAX_KM, SALE_DEFAULT_RADIUS_KM } from '../constants/config';

interface SaleRadiusModalProps {
  visible: boolean;
  onClose: () => void;
  // "Meu bairro" ou "Perto de mim", já traduzido — o raio sempre parte do
  // ponto de referência da visualização ativa do feed (ver app/(tabs)/index.tsx).
  referenceLabel: string;
  radiusKm: number | null;
  // `null` = limpar (volta ao padrão: só o bairro, sem alcance extra).
  onApply: (radiusKm: number | null) => void;
}

export default function SaleRadiusModal({
  visible,
  onClose,
  referenceLabel,
  radiusKm,
  onApply,
}: SaleRadiusModalProps) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [selected, setSelected] = useState(radiusKm ?? SALE_DEFAULT_RADIUS_KM);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* O card fica FORA do Pressable de fundo (irmão, não filho) — um
          Pressable ancestral do Slider quebra o gesto de arraste dele (a
          negociação de "responder" do RN conflita com o PanResponder interno
          do @react-native-community/slider). O Pressable de fundo cobre a
          tela toda por baixo (absoluteFill) só pra fechar ao tocar
          fora; o card por cima intercepta o toque normalmente por já estar
          no topo da pilha visual, sem precisar ser ele mesmo um Pressable. */}
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} tabIndex={-1} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Ionicons name="navigate-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.title}>{t('feed.saleRadius.title')}</Text>
          </View>
          <Text style={styles.subtitle}>{t('feed.saleRadius.description', { reference: referenceLabel })}</Text>

          {/* Estado atual já aplicado (não o valor sendo arrastado no slider
              abaixo) — deixa claro se o feed hoje mostra só o bairro ou já
              tem um raio extra ativo. */}
          <View style={styles.currentRow}>
            <Ionicons
              name={radiusKm ? 'navigate-circle' : 'home'}
              size={13}
              color={radiusKm ? Colors.primary : Colors.textSecondary}
            />
            <Text style={styles.currentText}>
              {radiusKm
                ? t('feed.saleRadius.currentRadius', { km: radiusKm })
                : t('feed.saleRadius.currentNeighborhood')}
            </Text>
          </View>

          <View style={styles.sliderSection}>
            <View style={styles.sliderValueRow}>
              <Text style={styles.sliderValue}>{t('feed.saleRadius.km', { count: selected })}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={SALE_RADIUS_MIN_KM}
              maximumValue={SALE_RADIUS_MAX_KM}
              step={1}
              value={selected}
              onValueChange={setSelected}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.primary}
            />
            <View style={styles.sliderBoundsRow}>
              <Text style={styles.sliderBoundText}>{t('feed.saleRadius.km', { count: SALE_RADIUS_MIN_KM })}</Text>
              <Text style={styles.sliderBoundText}>{t('feed.saleRadius.km', { count: SALE_RADIUS_MAX_KM })}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.clearBtn} activeOpacity={0.7} onPress={() => onApply(null)}>
              <Text style={styles.clearText}>{t('feed.saleRadius.clear')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={() => onApply(selected)}>
              <Text style={styles.applyText}>{t('feed.saleRadius.apply')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: Colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
      ...Colors.shadow.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      paddingTop: 18,
    },
    title: { fontSize: 15, fontWeight: '800', color: Colors.text, flexShrink: 1 },
    subtitle: {
      fontSize: 12,
      color: Colors.textTertiary,
      paddingHorizontal: 18,
      paddingTop: 6,
      paddingBottom: 4,
      lineHeight: 17,
    },
    currentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 18,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: Colors.background,
    },
    currentText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
    sliderSection: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
    sliderValueRow: { alignItems: 'center', marginBottom: 2 },
    sliderValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },
    slider: { width: '100%', height: 32 },
    sliderBoundsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    sliderBoundText: { fontSize: 11, color: Colors.textTertiary },
    footer: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    clearBtn: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: Colors.border,
    },
    clearText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
    applyBtn: { flex: 1, paddingVertical: 16, alignItems: 'center' },
    applyText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  });
