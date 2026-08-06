import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import { api, ReportTargetType } from '../lib/api';
import AttachmentPicker, { AttachmentDraft } from './AttachmentPicker';
import { useT } from '../lib/i18n';

const MAX_COMMENT = 3000;

const REASONS: Record<ReportTargetType, string[]> = {
  post: [
    'offensive', 'wrong_category', 'spam', 'harmful',
  ],
  comment: [
    'offensive', 'spam', 'harmful',
  ],
  user: [
    'fake', 'not_neighbor', 'harmful_person',
  ],
};

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
}

export default function ReportModal({ visible, onClose, targetType, targetId }: ReportModalProps) {
  const { t } = useT();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const uploading = attachments.some((a) => a.uploading);

  const close = () => {
    onClose();
    setReason(null);
    setComment('');
    setAttachments([]);
    setSaving(false);
    setFeedback(null);
  };

  const submit = async () => {
    if (!reason || saving || uploading) return;
    setSaving(true);
    setFeedback(null);
    try {
      const attachmentPayload = attachments
        .filter((a) => a.url)
        .map((a) => ({ url: a.url as string, type: a.type }));
      await api.submitReport(targetType, targetId, reason, comment.trim(), attachmentPayload);
      setFeedback({
        ok: true,
        text: t('report.success'),
      });
      setTimeout(close, 1400);
    } catch {
      setFeedback({ ok: false, text: t('report.error') });
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close} tabIndex={-1}>
        <Pressable style={styles.card} onPress={() => {}} tabIndex={-1}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t(`report.titles.${targetType}`)}</Text>
            <TouchableOpacity onPress={close} hitSlop={8}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>{t('report.reason')} <Text style={styles.required}>*</Text></Text>
            {REASONS[targetType].map((reasonKey) => {
              const active = reason === reasonKey;
              return (
                <TouchableOpacity
                  key={reasonKey}
                  style={styles.reasonRow}
                  onPress={() => setReason(reasonKey)}
                  activeOpacity={0.7}
                  focusable={false}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? Colors.primary : Colors.textTertiary}
                  />
                  <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                    {t(`report.reasons.${reasonKey}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.label}>{t('report.comment')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('report.commentPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              value={comment}
              onChangeText={(t) => setComment(t.slice(0, MAX_COMMENT))}
              multiline
              maxLength={MAX_COMMENT}
            />
            <Text style={styles.counter}>{comment.length}/{MAX_COMMENT}</Text>

            <View style={styles.attachmentsSection}>
              <AttachmentPicker
                attachments={attachments}
                setAttachments={setAttachments}
                upload={api.uploadReportAttachment}
                max={3}
                label={t('report.attachments')}
              />
            </View>

            {feedback && (
              <View
                style={[styles.feedbackBox, feedback.ok ? styles.feedbackOkBox : styles.feedbackErrBox]}
              >
                <Ionicons
                  name={feedback.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={feedback.ok ? Colors.success : Colors.error}
                />
                <Text
                  style={[styles.feedbackText, { color: feedback.ok ? Colors.success : Colors.error }]}
                >
                  {feedback.text}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, (!reason || saving || uploading) && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={!reason || saving || uploading}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>{t('report.submit')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
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
      maxWidth: 440,
      maxHeight: '85%',
      backgroundColor: Colors.surface,
      borderRadius: 20,
      padding: 18,
      ...Colors.shadow.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
    label: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 18, marginBottom: 8 },
    required: { color: Colors.error },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
    },
    reasonText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 19 },
    reasonTextActive: { color: Colors.text, fontWeight: '700' },
    input: {
      minHeight: 100,
      backgroundColor: Colors.background,
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
    attachmentsSection: { marginTop: 18 },
    feedbackBox: {
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
      backgroundColor: Colors.primary,
      borderRadius: 14,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
      marginBottom: 4,
    },
    submitBtnDisabled: { backgroundColor: Colors.textTertiary, opacity: 0.5 },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  });
