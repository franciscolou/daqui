import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Palette } from '../../constants/Colors';
import { goBack } from '../../lib/navigation';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useRateForm } from '../../lib/useRateForm';
import FeedLayout from '../../components/FeedLayout';
import RateForm from '../../components/RateForm';

/** Tela cheia só usada no mobile — no desktop, "Avaliar o Daqui" abre como modal (ver RateModal). */
export default function RateScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const form = useRateForm();
  const { load } = form;

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/')}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avaliar o Daqui</Text>
        <View style={styles.iconBtn} />
      </View>

      <RateForm form={form} />
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text },
});
