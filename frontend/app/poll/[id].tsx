import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { api, ApiError } from '../../lib/api';
import { useTheme, useThemedStyles } from '../../lib/theme';
import WideLayout from '../../components/WideLayout';
import PollEditor, {
  PollDraft,
  pollDraftValid,
  cleanPollOptions,
  buildClosesAt,
} from '../../components/PollEditor';

// ISO → { date: 'YYYY-MM-DD', time: 'HH:MM' } no fuso local.
function splitLocal(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

export default function EditPollScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [loading, setLoading] = useState(true);
  const [notAllowed, setNotAllowed] = useState(false);
  const [question, setQuestion] = useState('');
  const [draft, setDraft] = useState<PollDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [post, me] = await Promise.all([api.getPost(id), api.me()]);
      if (!post.poll || post.author.id !== me.id) {
        setNotAllowed(true);
        return;
      }
      const { date, time } = splitLocal(post.poll.closesAt);
      setQuestion(post.content);
      setDraft({
        options: post.poll.options.map((o) => ({ id: o.id, text: o.text })),
        multiple: post.poll.multiple,
        date,
        time,
      });
    } catch {
      setNotAllowed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const canSave = !!draft && pollDraftValid(draft) && question.trim().length > 0 && !saving;

  const save = async () => {
    if (!draft || !id || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await api.updatePost(id, {
        content: question.trim(),
        poll: {
          options: cleanPollOptions(draft),
          multiple: draft.multiple,
          closes_at: buildClosesAt(draft.date, draft.time)!,
        },
      });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WideLayout showMobileMenu={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Editar enquete</Text>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={save}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : notAllowed || !draft ? (
          <View style={styles.center}>
            <Ionicons name="lock-closed-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>Enquete indisponível para edição.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.infoNote}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
              <Text style={styles.infoNoteText}>
                Você pode editar a enquete a qualquer momento. O prazo é sempre para o futuro.
              </Text>
            </View>

            <Text style={styles.label}>
              Pergunta <Text style={styles.req}>*</Text>
            </Text>
            <TextInput
              style={styles.questionInput}
              placeholder="O que você quer perguntar ao bairro?"
              placeholderTextColor={Colors.textTertiary}
              value={question}
              onChangeText={setQuestion}
              maxLength={200}
            />

            <View style={{ height: 16 }} />
            <PollEditor value={draft} onChange={setDraft} />

            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </WideLayout>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  emptyText: { fontSize: 14, color: Colors.textSecondary },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 11,
    paddingHorizontal: 16,
    height: 36,
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40 },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
  },
  infoNoteText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  label: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  req: { color: Colors.error },
  questionInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  error: { color: Colors.error, fontSize: 13, marginTop: 14 },
});
