import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { api, ApiError } from '../../lib/api';
import { useTheme, useThemedStyles } from '../../lib/theme';
import FeedLayout from '../../components/FeedLayout';
import StarRating from '../../components/StarRating';

const MAX = 1000;

const RATING_LABELS: Record<number, string> = {
  0: 'Toque nas estrelas para avaliar',
  1: 'Péssimo',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Ótimo',
};

const STATUS_INFO: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Em análise pela moderação', icon: 'time-outline' },
  approved: { label: 'Avaliação publicada', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Avaliação não aprovada', icon: 'close-circle-outline' },
};

export default function RateScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const mine = await api.getMyReview();
      if (mine) {
        setRating(mine.rating);
        setComment(mine.comment);
        setStatus(mine.status);
      }
    } catch {
      /* ignora */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (rating < 0.5 || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      await api.submitReview(rating, comment.trim());
      setStatus('pending');
      setFeedback({ ok: true, text: 'Obrigado! Sua avaliação foi enviada e passará pela moderação.' });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : 'Não foi possível enviar. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const label = RATING_LABELS[Math.ceil(rating)] ?? RATING_LABELS[0];

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avaliar o Daqui</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.heroIcon}>
            <Ionicons name="heart" size={30} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Como está sendo sua experiência?</Text>
          <Text style={styles.subtitle}>
            Sua opinião ajuda a melhorar o Daqui para todo o bairro.
          </Text>

          <View style={styles.starsWrap}>
            <StarRating value={rating} onChange={setRating} size={44} gap={8} />
            <Text style={styles.ratingLabel}>
              {rating > 0 ? `${rating.toString().replace('.', ',')} · ${label}` : label}
            </Text>
          </View>

          {!!status && STATUS_INFO[status] && (
            <View style={styles.statusRow}>
              <Ionicons name={STATUS_INFO[status].icon} size={15} color={Colors.textSecondary} />
              <Text style={styles.statusText}>{STATUS_INFO[status].label}</Text>
            </View>
          )}

          <Text style={styles.label}>Comentário (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Conte o que você achou, o que funciona bem e o que poderia melhorar…"
            placeholderTextColor={Colors.textTertiary}
            value={comment}
            onChangeText={(t) => setComment(t.slice(0, MAX))}
            multiline
            maxLength={MAX}
          />
          <Text style={styles.counter}>{comment.length}/{MAX}</Text>

          {feedback && (
            <View style={[styles.feedbackBox, feedback.ok ? styles.feedbackOkBox : styles.feedbackErrBox]}>
              <Ionicons
                name={feedback.ok ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={feedback.ok ? Colors.success : Colors.error}
              />
              <Text style={[styles.feedbackText, { color: feedback.ok ? Colors.success : Colors.error }]}>
                {feedback.text}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (rating < 0.5 || saving) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={rating < 0.5 || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{status ? 'Atualizar avaliação' : 'Enviar avaliação'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { padding: 20, paddingBottom: 48, alignItems: 'center' },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textTertiary, textAlign: 'center', marginTop: 6, maxWidth: 320, lineHeight: 20 },
  starsWrap: { alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 6 },
  ratingLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 4 },
  statusText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  label: { alignSelf: 'stretch', fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 22, marginBottom: 8 },
  input: {
    alignSelf: 'stretch',
    minHeight: 120,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as any,
  counter: { alignSelf: 'flex-end', fontSize: 12, color: Colors.textTertiary, marginTop: 6 },
  feedbackBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  feedbackOkBox: { backgroundColor: Colors.primaryFaint },
  feedbackErrBox: { backgroundColor: Colors.error + '12' },
  feedbackText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  submitBtn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
