import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Palette } from '../../constants/Colors';
import { CATEGORIES, PostCategory } from '../../data/mock';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import WideLayout from '../../components/WideLayout';
import { router } from 'expo-router';

const CREATE_CATEGORIES = CATEGORIES.filter((c) => c.key !== 'todos');

export default function PublishScreen() {
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [selectedCategory, setSelectedCategory] = useState<PostCategory | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPublish = !!selectedCategory && content.trim().length > 10 && !publishing;

  const handlePublish = async () => {
    if (!canPublish || !selectedCategory) return;
    setError(null);
    setPublishing(true);
    try {
      await api.createPost({
        category: selectedCategory,
        title: title.trim() || undefined,
        content: content.trim(),
        urgent: isUrgent,
      });
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao publicar.');
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WideLayout>
      <KeyboardAvoidingView
        style={[styles.flex, styles.column]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <LinearGradient colors={['#0D2918', '#15803D']} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Novo post</Text>
            <TouchableOpacity
              style={[styles.publishBtn, !canPublish && styles.publishBtnDisabled]}
              onPress={handlePublish}
              disabled={!canPublish}
              activeOpacity={0.85}
            >
              {publishing ? (
                <ActivityIndicator color={Colors.primaryDark} size="small" />
              ) : (
                <Text style={[styles.publishBtnText, !canPublish && styles.publishBtnTextDisabled]}>
                  Publicar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView style={styles.flex} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Author preview */}
          <View style={styles.authorRow}>
            <Image source={{ uri: user?.avatar }} style={styles.authorAvatar} />
            <View>
              <Text style={styles.authorName}>{user?.name}</Text>
              <View style={styles.authorMeta}>
                <Ionicons name="location-outline" size={12} color={Colors.primary} />
                <Text style={styles.authorNeighborhood}>{user?.neighborhood}</Text>
                <View style={styles.audienceChip}>
                  <Ionicons name="people" size={11} color={Colors.primary} />
                  <Text style={styles.audienceText}>Bairro inteiro</Text>
                </View>
              </View>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Category selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Categoria *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {CREATE_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key;
                const color = Colors.category[cat.key as PostCategory] ?? Colors.primary;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryChip,
                      isActive && { backgroundColor: color, borderColor: color },
                      !isActive && { backgroundColor: Colors.surface, borderColor: Colors.border },
                    ]}
                    onPress={() => setSelectedCategory(cat.key as PostCategory)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={cat.icon as any} size={15} color={isActive ? '#fff' : color} />
                    <Text style={[styles.categoryChipText, isActive && { color: '#fff' }, !isActive && { color }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Urgent toggle */}
          <View style={styles.urgentRow}>
            <View style={styles.urgentLeft}>
              <View style={[styles.urgentIcon, isUrgent && styles.urgentIconActive]}>
                <Ionicons name="alert-circle" size={18} color={isUrgent ? '#fff' : Colors.error} />
              </View>
              <View>
                <Text style={styles.urgentLabel}>Marcar como urgente</Text>
                <Text style={styles.urgentDesc}>Notifica todos os vizinhos imediatamente</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.toggle, isUrgent && styles.toggleActive]}
              onPress={() => setIsUrgent(!isUrgent)}
            >
              <View style={[styles.toggleThumb, isUrgent && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Título (opcional)</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="Um título claro e direto..."
              placeholderTextColor={Colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />
            <Text style={styles.charCount}>{title.length}/80</Text>
          </View>

          {/* Content */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Mensagem *</Text>
            <TextInput
              style={styles.contentInput}
              placeholder="O que você quer compartilhar com o bairro?"
              placeholderTextColor={Colors.textTertiary}
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>{content.length}/2000</Text>
          </View>

          {/* Attachments */}
          <View style={[styles.section, { paddingBottom: 8 }]}>
            <Text style={styles.sectionLabel}>Adicionar ao post</Text>
            <View style={styles.attachRow}>
              <TouchableOpacity style={styles.attachBtn}>
                <View style={[styles.attachIcon, { backgroundColor: Colors.indigo + '15' }]}>
                  <Ionicons name="image" size={20} color={Colors.indigo} />
                </View>
                <Text style={[styles.attachLabel, { color: Colors.indigo }]}>Foto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn}>
                <View style={[styles.attachIcon, { backgroundColor: Colors.accent + '15' }]}>
                  <Ionicons name="camera" size={20} color={Colors.accent} />
                </View>
                <Text style={[styles.attachLabel, { color: Colors.accent }]}>Câmera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn}>
                <View style={[styles.attachIcon, { backgroundColor: Colors.error + '15' }]}>
                  <Ionicons name="location" size={20} color={Colors.error} />
                </View>
                <Text style={[styles.attachLabel, { color: Colors.error }]}>Local</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn}>
                <View style={[styles.attachIcon, { backgroundColor: Colors.warning + '15' }]}>
                  <Ionicons name="pricetag" size={20} color={Colors.warning} />
                </View>
                <Text style={[styles.attachLabel, { color: Colors.warning }]}>Preço</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tips */}
          {selectedCategory && (
            <View style={styles.tipCard}>
              <Ionicons name="bulb-outline" size={18} color={Colors.warning} />
              <Text style={styles.tipText}>
                {selectedCategory === 'seguranca'
                  ? 'Para alertas de segurança, inclua local exato, horário e descrição detalhada.'
                  : selectedCategory === 'pets'
                  ? 'Inclua foto, cor, raça e onde o pet foi visto pela última vez.'
                  : selectedCategory === 'venda'
                  ? 'Adicione fotos reais, preço e forma de contato para mais respostas.'
                  : selectedCategory === 'evento'
                  ? 'Informe data, horário, endereço e o que levar.'
                  : 'Seja claro e direto. Inclua detalhes relevantes para seus vizinhos.'}
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      </WideLayout>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  column: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  publishBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  publishBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  publishBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  publishBtnTextDisabled: { color: 'rgba(255,255,255,0.5)' },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  authorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
  },
  authorName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  authorMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  authorNeighborhood: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  audienceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  audienceText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 18 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryRow: { gap: 8, paddingBottom: 4 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  categoryChipText: { fontSize: 13, fontWeight: '700' },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urgentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  urgentIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentIconActive: { backgroundColor: Colors.error },
  urgentLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  urgentDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  toggle: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleActive: { backgroundColor: Colors.primary },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    ...Colors.shadow.sm,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  titleInput: {
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
  contentInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 140,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: 5,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attachBtn: { alignItems: 'center', gap: 5 },
  attachIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  attachLabel: { fontSize: 11, fontWeight: '600' },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  tipText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: Colors.error + '12',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '500' },
});
