import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { MAX_TICKET_MESSAGE, MAX_TICKET_SUBJECT } from '../../constants/config';
import { api, ApiError, SupportTicket } from '../../lib/api';
import { goBack } from '../../lib/navigation';
import { useTheme, useThemedStyles } from '../../lib/theme';
import { useT } from '../../lib/i18n';
import { formatDate } from '../../lib/time';
import FeedLayout from '../../components/FeedLayout';
import AttachmentPicker, { AttachmentDraft } from '../../components/AttachmentPicker';
import ImageViewerModal, { MediaItem } from '../../components/ImageViewerModal';

type SectionKey = 'how' | 'faq' | 'tickets';

const SECTIONS: { key: SectionKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'how', icon: 'compass-outline' }, { key: 'faq', icon: 'help-circle-outline' }, { key: 'tickets', icon: 'mail-outline' },
];

export default function HelpScreen() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [section, setSection] = useState<SectionKey>('how');

  return (
    <FeedLayout showMobileMenu={false}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => goBack('/')}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('help.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.tabBar}>
        {SECTIONS.map((s) => {
          const active = s.key === section;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              activeOpacity={0.75}
              onPress={() => setSection(s.key)}
            >
              <Ionicons name={s.icon} size={15} color={active ? '#fff' : Colors.textSecondary} />
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]} numberOfLines={1}>
                {t(`help.tabs.${s.key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {section === 'how' && <HowToSection />}
      {section === 'faq' && <FaqSection />}
      {section === 'tickets' && <TicketsSection />}
    </FeedLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Como usar o Daqui                                                   */
/* ------------------------------------------------------------------ */

const HOW_TO_STEPS: { icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    icon: 'home-outline',
  },
  {
    icon: 'home',
  },
  {
    icon: 'add-circle-outline',
  },
  {
    icon: 'heart-outline',
  },
  {
    icon: 'chatbubbles-outline',
  },
  {
    icon: 'map-outline',
  },
  {
    icon: 'flag-outline',
  },
  {
    icon: 'star-outline',
  },
];

function HowToSection() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <Text style={styles.introText}>
        {t('help.how.intro')}
      </Text>
      {HOW_TO_STEPS.map((step, i) => (
        <View key={i} style={styles.stepCard}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{i + 1}</Text>
          </View>
          <View style={styles.stepText}>
            <View style={styles.stepTitleRow}>
              <Ionicons name={step.icon} size={16} color={Colors.primary} />
              <Text style={styles.stepTitle}>{t(`help.how.steps.${i}.title`)}</Text>
            </View>
            <Text style={styles.stepDesc}>{t(`help.how.steps.${i}.desc`)}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                  */
/* ------------------------------------------------------------------ */

const FAQ_ITEMS = [
  {
    q: 'O que é o Daqui?',
    a: 'O Daqui é uma rede social de bairro: um espaço para vizinhos trocarem avisos, recomendações, achados e perdidos, organizarem eventos e se ajudarem no dia a dia — tudo organizado pelo seu bairro.',
  },
  {
    q: 'Como o app sabe qual é o meu bairro? Posso trocar de bairro?',
    a: 'O bairro do seu cadastro é o que aparece em "Meu bairro" e é usado no mapa. Se você se mudou, dá para atualizá-lo a qualquer momento em Configurações > Meu endereço. Para só dar uma olhada em outro bairro sem mudar seu cadastro, use a aba "Perto de mim" no Início — ela usa a localização atual do aparelho, sem alterar o que está salvo no seu perfil.',
  },
  {
    q: 'Qual a diferença entre "Meu bairro", "Perto de mim" e "Incluir redondezas"?',
    a: '"Meu bairro" mostra o feed do bairro salvo no seu cadastro. "Perto de mim" descobre pelo GPS o bairro mais próximo de onde você está agora e mostra o feed dele, útil quando você está de passagem por outro bairro. Em ambos, o switch "Incluir redondezas" amplia o feed trazendo também posts dos bairros vizinhos.',
  },
  {
    q: 'O que significa o selo "Morador" em um post ou comentário?',
    a: 'O selo aparece quando o autor mora de fato no bairro daquele post ou comentário — ajuda a diferenciar vizinhos de quem só está vendo aquele bairro pela aba "Perto de mim" ou por "Incluir redondezas".',
  },
  {
    q: 'Quem consegue ver o que eu publico?',
    a: 'Posts e comentários ficam visíveis para quem está vendo o feed do seu bairro — inclusive quem chegou até ele pela aba "Perto de mim" ou com "Incluir redondezas" ligado. Seu endereço exato nunca é exibido para ninguém — apenas o nome do bairro aparece no seu perfil.',
  },
  {
    q: 'O que muda quando eu marco um post como "importante"?',
    a: 'O selo de importante prioriza o post no topo do feed dos vizinhos. Use com moderação: é pensado para avisos realmente urgentes (segurança, emergências), não para divulgação geral.',
  },
  {
    q: 'Como funciona a denúncia de conteúdo?',
    a: 'Ao denunciar um post, comentário ou perfil, o time de moderação analisa o caso. Denunciar não remove o conteúdo automaticamente: dependendo da análise, o conteúdo é removido ou a denúncia é descartada.',
  },
  {
    q: 'Minha conta pode ser suspensa?',
    a: 'Sim. Contas que violam as regras da comunidade (spam, ofensas, contas falsas) podem ser suspensas temporária ou indefinidamente pela moderação, com aviso do motivo e do prazo, quando houver.',
  },
  {
    q: 'O Daqui participa ou se responsabiliza por vendas e negociações entre vizinhos?',
    a: 'Não. Posts de venda e trocas são combinados diretamente entre os vizinhos; o Daqui não intermedia pagamentos, entregas ou garantias. Em caso de golpe ou má conduta, denuncie o conteúdo ou o perfil.',
  },
  {
    q: 'Perdi o acesso à minha conta — dá para recuperar a senha sozinho?',
    a: 'Ainda não existe um fluxo automático de recuperação de senha pelo app. Abra um chamado em "Meus chamados" descrevendo o problema e o suporte te ajuda.',
  },
  {
    q: 'Como excluo minha conta e meus dados?',
    a: 'A exclusão de conta ainda não está disponível diretamente pelo app. Abra um chamado em "Meus chamados" pedindo a exclusão e o suporte cuida do processo.',
  },
  {
    q: 'Qual a diferença entre "Denunciar" e abrir um chamado em "Meus chamados"?',
    a: 'Denunciar é para um post, comentário ou perfil específico que quebra as regras — vai direto para a fila de moderação de conteúdo. Um chamado é para dúvidas, problemas técnicos ou pedidos sobre a sua própria conta que não se resolvem denunciando algo.',
  },
  {
    q: 'Quanto tempo demora para meu chamado ser respondido?',
    a: 'Não há um prazo fixo — depende do volume de chamados em aberto. Assim que o suporte responder, a resposta aparece aqui mesmo, na aba "Meus chamados".',
  },
  {
    q: 'O Daqui é gratuito?',
    a: 'Sim. Usar o Daqui — publicar, comentar, trocar mensagens e participar de grupos — não tem custo.',
  },
];

function FaqSection() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { t } = useT();

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {FAQ_ITEMS.map((item, i) => {
        const open = openIndex === i;
        return (
          <TouchableOpacity
            key={i}
            style={styles.faqCard}
            activeOpacity={0.8}
            onPress={() => setOpenIndex(open ? null : i)}
          >
            <View style={styles.faqQuestionRow}>
              <Text style={styles.faqQuestion}>{t(`help.faq.${i}.q`)}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textTertiary} />
            </View>
            {open && <Text style={styles.faqAnswer}>{t(`help.faq.${i}.a`)}</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Meus chamados                                                        */
/* ------------------------------------------------------------------ */

function TicketsSection() {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t: tr } = useT();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [viewer, setViewer] = useState<{ media: MediaItem[]; index: number } | null>(null);

  const uploading = attachments.some((a) => a.uploading);

  const load = useCallback(() => {
    api.getMySupportTickets()
      .then(setTickets)
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const openForm = () => {
    setComposing(true);
    setSubject('');
    setMessage('');
    setAttachments([]);
    setFeedback(null);
  };

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      setFeedback({ ok: false, text: tr('help.tickets.required') });
      return;
    }
    if (uploading) return;
    setSending(true);
    setFeedback(null);
    try {
      const attachmentPayload = attachments
        .filter((a) => a.url)
        .map((a) => ({ url: a.url as string, type: a.type }));
      const created = await api.submitSupportTicket(subject.trim(), message.trim(), attachmentPayload);
      setTickets((prev) => [created, ...prev]);
      setComposing(false);
      setFeedback({
        ok: true,
        text: tr('help.tickets.sent', { id: created.id }),
      });
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof ApiError ? e.message : tr('help.tickets.sendError') });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {!composing && (
        <TouchableOpacity style={styles.newTicketBtn} activeOpacity={0.85} onPress={openForm}>
          <Ionicons name="add-circle" size={18} color="#fff" />
          <Text style={styles.newTicketBtnText}>{tr('help.tickets.new')}</Text>
        </TouchableOpacity>
      )}

      {composing && (
        <View style={styles.composeCard}>
          <Text style={styles.composeTitle}>{tr('help.tickets.new')}</Text>

          <Text style={styles.fieldLabel}>{tr('help.tickets.subject')} <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={tr('help.tickets.subjectPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            maxLength={MAX_TICKET_SUBJECT}
          />

          <Text style={styles.fieldLabel}>{tr('help.tickets.message')} <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={message}
            onChangeText={setMessage}
            placeholder={tr('help.tickets.messagePlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={MAX_TICKET_MESSAGE}
          />

          <AttachmentPicker
            attachments={attachments}
            setAttachments={setAttachments}
            upload={api.uploadTicketAttachment}
            max={3}
            label={tr('help.tickets.attachments')}
          />

          {feedback && !feedback.ok && <Text style={styles.feedbackErrText}>{feedback.text}</Text>}

          <View style={styles.composeActions}>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={() => setComposing(false)} disabled={sending}>
              <Text style={styles.secondaryBtnText}>{tr('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (sending || uploading) && styles.submitBtnDisabled]}
              activeOpacity={0.85}
              onPress={submit}
              disabled={sending || uploading}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>{tr('help.tickets.send')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {feedback && feedback.ok && !composing && (
        <View style={styles.feedbackOkBox}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.feedbackOkText}>{feedback.text}</Text>
        </View>
      )}

      {tickets.length === 0 && !composing ? (
        <View style={styles.emptyState}>
          <Ionicons name="mail-outline" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyStateText}>{tr('help.tickets.empty')}</Text>
        </View>
      ) : (
        tickets.map((t) => {
          const expanded = expandedId === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={styles.ticketCard}
              activeOpacity={0.8}
              onPress={() => setExpandedId(expanded ? null : t.id)}
            >
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketSubject} numberOfLines={expanded ? undefined : 1}>{t.subject}</Text>
                <View style={[styles.statusBadge, t.status === 'answered' ? styles.statusAnswered : styles.statusPending]}>
                  <Text style={[styles.statusBadgeText, t.status === 'answered' ? styles.statusAnsweredText : styles.statusPendingText]}>
                    {tr(t.status === 'answered' ? 'help.tickets.answered' : 'help.tickets.pending')}
                  </Text>
                </View>
              </View>
              <View style={styles.ticketMetaRow}>
                <Text style={styles.ticketNumber}>#{t.id}</Text>
                <Text style={styles.ticketDate}>
                  {formatDate(t.createdAt)}
                </Text>
              </View>
              {expanded && (
                <>
                  <Text style={styles.ticketMessage}>{t.message}</Text>
                  {t.attachments.length > 0 && (
                    <View style={styles.ticketAttachmentsRow}>
                      {t.attachments.map((a, i) => (
                        <TouchableOpacity
                          key={a.url}
                          style={styles.ticketAttachmentThumbBtn}
                          onPress={() => setViewer({ media: t.attachments, index: i })}
                          activeOpacity={0.85}
                        >
                          {a.type === 'video' ? (
                            <View style={[styles.ticketAttachmentThumb, styles.ticketAttachmentVideo]}>
                              <Ionicons name="videocam" size={18} color="#fff" />
                            </View>
                          ) : (
                            <Image
                              source={{ uri: a.url }}
                              style={styles.ticketAttachmentThumb}
                              resizeMode="cover"
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {t.status === 'answered' ? (
                    <View style={styles.responseBox}>
                      <View style={styles.responseHeader}>
                        <Ionicons name="chatbubble-ellipses" size={14} color={Colors.primary} />
                        <Text style={styles.responseLabel}>{tr('help.tickets.supportResponse')}</Text>
                      </View>
                      <Text style={styles.responseText}>{t.response}</Text>
                    </View>
                  ) : (
                    <Text style={styles.pendingHint}>
                      {tr('help.tickets.awaitingResponse')}
                    </Text>
                  )}
                </>
              )}
            </TouchableOpacity>
          );
        })
      )}

      <ImageViewerModal
        media={viewer?.media ?? []}
        initialIndex={viewer?.index ?? 0}
        visible={!!viewer}
        onClose={() => setViewer(null)}
      />
    </ScrollView>
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

  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  tabBtnTextActive: { color: '#fff' },

  body: { padding: 16, paddingBottom: 48, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  // Como usar
  introText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  stepCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  stepText: { flex: 1, minWidth: 0, gap: 4 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, flexShrink: 1 },
  stepDesc: { fontSize: 13, color: Colors.textTertiary, lineHeight: 19 },

  // FAQ
  faqCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text, lineHeight: 20 },
  faqAnswer: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 10 },

  // Meus chamados
  newTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
  },
  newTicketBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  composeCard: {
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  composeTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  required: { color: Colors.error },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.background,
    outlineStyle: 'none',
  } as any,
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  composeActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  submitBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  feedbackErrText: { fontSize: 12, fontWeight: '600', color: Colors.error },

  feedbackOkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.primaryFaint,
  },
  feedbackOkText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.success },

  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyStateText: { fontSize: 13, color: Colors.textTertiary },

  ticketCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ticketSubject: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text },
  ticketMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticketNumber: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  ticketDate: { fontSize: 11, color: Colors.textTertiary },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusPending: { backgroundColor: Colors.borderLight },
  statusAnswered: { backgroundColor: Colors.primaryFaint },
  statusBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  statusPendingText: { color: Colors.textTertiary },
  statusAnsweredText: { color: Colors.primary },
  ticketMessage: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: 4 },
  ticketAttachmentsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ticketAttachmentThumbBtn: { borderRadius: 10 },
  ticketAttachmentThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: Colors.border },
  ticketAttachmentVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B' },
  responseBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.primaryFaint,
    gap: 4,
  },
  responseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  responseLabel: { fontSize: 11, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  responseText: { fontSize: 13, color: Colors.text, lineHeight: 19 },
  pendingHint: { fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic', marginTop: 4 },
});
