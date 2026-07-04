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
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { MAX_COMMENT, RateForm as RateFormState } from '../lib/useRateForm';
import StarRating from './StarRating';

const STATUS_INFO: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Em análise pela moderação', icon: 'time-outline' },
  approved: { label: 'Avaliação publicada', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Avaliação não aprovada', icon: 'close-circle-outline' },
};

/**
 * Corpo do formulário de avaliação (estrelas, comentário, envio). `compact`
 * reduz tamanhos/paddings para caber num modal; sem ele, ocupa uma tela cheia.
 */
export default function RateForm({ form, compact = false }: { form: RateFormState; compact?: boolean }) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { rating, setRating, comment, setComment, status, loading, saving, feedback, submit, label } = form;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.body, compact && styles.bodyCompact]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.heroIcon, compact && styles.heroIconCompact]}>
        <Ionicons name="heart" size={compact ? 26 : 30} color={Colors.primary} />
      </View>
      <Text style={styles.title}>Como está sendo sua experiência?</Text>
      <Text style={styles.subtitle}>
        Sua opinião ajuda a melhorar o Daqui para todo o bairro.
      </Text>

      <View style={styles.starsWrap}>
        <StarRating value={rating} onChange={setRating} size={compact ? 36 : 44} gap={compact ? 6 : 8} />
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
        onChangeText={(t) => setComment(t.slice(0, MAX_COMMENT))}
        multiline
        maxLength={MAX_COMMENT}
      />
      <Text style={styles.counter}>{comment.length}/{MAX_COMMENT}</Text>

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
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { padding: 20, paddingBottom: 48, alignItems: 'center' },
  bodyCompact: { padding: 0, paddingTop: 10, paddingBottom: 8 },
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
  heroIconCompact: { width: 56, height: 56, borderRadius: 18, marginTop: 0, marginBottom: 12 },
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
