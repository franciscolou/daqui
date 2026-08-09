import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Palette } from '../constants/Colors';
import { DESKTOP_BREAKPOINT } from '../constants/config';
import { useTheme, useThemedStyles } from '../lib/theme';
import FeedLayout from '../components/FeedLayout';
import NotFoundArt from '../components/NotFoundArt';
import { useT } from '../lib/i18n';

const ART_MAX_WIDTH = 340;

export default function NotFoundScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const isWide = width >= DESKTOP_BREAKPOINT;
  const artWidth = Math.min(ART_MAX_WIDTH, width - (isWide ? 120 : 64));

  const { t } = useT();
  return (
    <FeedLayout showMobileMenu>
      <View style={styles.body}>
        <View style={{ width: artWidth }}>
          <NotFoundArt Colors={Colors} />
        </View>

        <Text style={styles.title}>{t('common.errors.notFound.title')}</Text>
        <Text style={styles.subtitle}>
          {t('common.errors.notFound.description')}
        </Text>

        <TouchableOpacity activeOpacity={0.85} onPress={() => router.replace('/')} style={styles.cta}>
          <LinearGradient
            colors={Colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Ionicons name="home-outline" size={18} color="#fff" />
            <Text style={styles.ctaText}>Voltar para o início</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </FeedLayout>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    gap: 4,
  },
  title: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 340,
  },
  cta: {
    marginTop: 26,
    borderRadius: 14,
    overflow: 'hidden',
    ...Colors.shadow.md,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
