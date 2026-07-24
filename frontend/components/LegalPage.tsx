import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Palette } from '../constants/Colors';
import {
  LEGAL_UPDATED_AT, LegalSection,
  PRIVACY_INTRO, PRIVACY_SECTIONS,
  TERMS_INTRO, TERMS_SECTIONS,
} from '../constants/legal';
import { goBack } from '../lib/navigation';
import { useTheme, useThemedStyles } from '../lib/theme';

export type LegalDoc = 'termos' | 'privacidade';

const DOCS: { key: LegalDoc; label: string }[] = [
  { key: 'termos', label: 'Termos de Uso' },
  { key: 'privacidade', label: 'Política de Privacidade' },
];

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const intro = doc === 'termos' ? TERMS_INTRO : PRIVACY_INTRO;
  const sections = doc === 'termos' ? TERMS_SECTIONS : PRIVACY_SECTIONS;
  const title = doc === 'termos' ? 'Termos de Uso' : 'Política de Privacidade';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/')}>
          <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Documentos legais</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.switcher}>
        {DOCS.map((d, i) => {
          const active = d.key === doc;
          return (
            <View key={d.key} style={styles.switcherItemRow}>
              <TouchableOpacity focusable={false} onPress={() => !active && router.replace(`/legal/${d.key}` as any)}>
                <Text style={[styles.switcherText, active && styles.switcherTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
              {i < DOCS.length - 1 && <Text style={styles.switcherSep}>·</Text>}
            </View>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, isWide && styles.pageWide]}>
          <Text style={styles.kicker}>DAQUI — REDE SOCIAL DE BAIRRO</Text>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.updatedAt}>Última atualização em {LEGAL_UPDATED_AT}</Text>

          <View style={styles.hr} />

          <Text style={styles.intro}>{intro}</Text>

          {sections.map((section: LegalSection) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.blocks.map((block, i) =>
                block.type === 'p' ? (
                  <Text key={i} style={styles.paragraph}>{block.text}</Text>
                ) : (
                  <View key={i} style={styles.bulletList}>
                    {block.items.map((item, j) => (
                      <View key={j} style={styles.bulletRow}>
                        <Text style={styles.bulletDash}>–</Text>
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ),
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.borderLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textTertiary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  switcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  switcherItemRow: { flexDirection: 'row', alignItems: 'center' },
  switcherText: { fontSize: 13, fontWeight: '600', color: Colors.textTertiary, paddingHorizontal: 10 },
  switcherTextActive: { color: Colors.text, textDecorationLine: 'underline' },
  switcherSep: { fontSize: 13, color: Colors.textTertiary },

  scrollBody: { paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center' },

  page: {
    width: '100%',
    maxWidth: 720,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 3,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  pageWide: { paddingVertical: 56, paddingHorizontal: 64 },

  kicker: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  docTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  updatedAt: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.textTertiary,
  },
  hr: { height: 1, backgroundColor: Colors.border, marginTop: 24, marginBottom: 24 },

  intro: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 8,
  },

  section: { marginTop: 28 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14.5,
    color: Colors.textSecondary,
    lineHeight: 23,
    marginBottom: 10,
  },

  bulletList: { marginBottom: 10, marginTop: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bulletDash: { fontSize: 14.5, color: Colors.textTertiary, lineHeight: 23 },
  bulletText: { flex: 1, fontSize: 14.5, color: Colors.textSecondary, lineHeight: 23 },
});
