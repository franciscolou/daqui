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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Palette } from '../../constants/Colors';
import { CATEGORIES, PostCategory } from '../../data/mock';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme, useThemedStyles } from '../../lib/theme';
import WideLayout from '../../components/WideLayout';
import LocationPickerModal from '../../components/LocationPickerModal';
import MapPickButton from '../../components/MapPickButton';
import PollEditor, {
  PollDraft,
  emptyPollDraft,
  pollDraftValid,
  cleanPollOptions,
  buildClosesAt,
} from '../../components/PollEditor';
import { router } from 'expo-router';
import { goBack } from '../../lib/navigation';

// Calendário em português
LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  monthNamesShort: [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ],
  dayNames: [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado',
  ],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

const CREATE_CATEGORIES = CATEGORIES.filter((c) => c.key !== 'todos');
const MAX_MEDIA = 10;

interface DraftMedia {
  localUri: string;
  type: 'image' | 'video';
  url?: string; // preenchido quando o upload termina
  uploading: boolean;
}

// Máscara de moeda BR: trata a entrada como centavos e formata com vírgula.
function maskPrice(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PublishScreen() {
  const { user } = useAuth();
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [selectedCategory, setSelectedCategory] = useState<PostCategory | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos específicos por categoria
  const [location, setLocationRaw] = useState('');
  // Validação do endereço contra o bairro (via API de endereços).
  const [locationStatus, setLocationStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [locationMsg, setLocationMsg] = useState<string | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [eventDates, setEventDates] = useState<string[]>([]);
  const [allDay, setAllDay] = useState(true);
  const [eventTime, setEventTime] = useState('');
  const [price, setPrice] = useState('');
  const [priceNegotiable, setPriceNegotiable] = useState(false);
  const [media, setMedia] = useState<DraftMedia[]>([]); // até 10 fotos/vídeos
  const [pollDraft, setPollDraft] = useState<PollDraft>(emptyPollDraft());
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);

  // Ao editar o endereço, o status de validação anterior deixa de valer.
  const setLocation = (v: string) => {
    setLocationRaw(v);
    setLocationStatus('idle');
    setLocationMsg(null);
  };

  // Confere se um endereço existe e fica dentro do bairro (API de endereços).
  // Recebe o texto explicitamente (em vez de ler `location` do closure) pra
  // poder ser chamada logo após escolher um ponto no mapa, sem esperar o
  // próximo render refletir o `setLocation` anterior.
  const validateLocationValue = async (addr: string) => {
    addr = addr.trim();
    if (!addr) {
      setLocationStatus('idle');
      setLocationMsg(null);
      return;
    }
    setLocationStatus('checking');
    setLocationMsg(null);
    try {
      await api.geocode(addr);
      setLocationStatus('valid');
    } catch (e) {
      setLocationStatus('invalid');
      setLocationMsg(e instanceof ApiError ? e.message : 'Não foi possível validar o endereço.');
    }
  };
  const validateLocation = () => validateLocationValue(location);

  // Endereço escolhido no mapa (LocationPickerModal): preenche o campo de
  // texto e roda a mesma validação de "dentro do bairro" de um endereço
  // digitado.
  const handlePickLocation = (address: string) => {
    setLocation(address);
    validateLocationValue(address);
    setLocationPickerOpen(false);
  };

  // Centro inicial do mapa de seleção: coordenadas do usuário (mesmas usadas
  // na tela Mapa) ou o centro de São Paulo como fallback.
  const pickerCenter = useMemo(
    () =>
      user?.latitude != null && user?.longitude != null
        ? { latitude: user.latitude, longitude: user.longitude }
        : { latitude: -23.5505, longitude: -46.6333 },
    [user?.latitude, user?.longitude],
  );

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const markedDates = useMemo(() => {
    const marks: Record<string, { selected: boolean; selectedColor: string }> = {};
    for (const d of eventDates) {
      marks[d] = { selected: true, selectedColor: Colors.category.evento ?? Colors.primary };
    }
    return marks;
  }, [eventDates, Colors]);

  const toggleDate = (day: string) => {
    setEventDates((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  // Converte a string mascarada ("1.234,56") em número.
  const priceNumber = () => parseFloat(price.replace(/\./g, '').replace(',', '.'));
  const priceValid = priceNegotiable || priceNumber() > 0;

  // Requisitos extras por categoria
  const categoryValid =
    selectedCategory === 'venda'
      ? priceValid
      : selectedCategory === 'evento'
      ? eventDates.length > 0
      : selectedCategory === 'enquete'
      ? pollDraftValid(pollDraft)
      : true;

  // Título é obrigatório apenas em Eventos.
  const titleValid = selectedCategory !== 'evento' || title.trim().length > 0;
  // A mensagem é obrigatória (basta não estar vazia) exceto em Eventos.
  const contentValid = selectedCategory === 'evento' || content.trim().length > 0;

  const canPublish =
    !!selectedCategory && titleValid && contentValid && categoryValid &&
    locationStatus !== 'invalid' && locationStatus !== 'checking' &&
    !media.some((m) => m.uploading) && !publishing;

  // Mensagem explicando por que o botão está desabilitado (ajuda o usuário).
  const disabledReason = (() => {
    if (!selectedCategory) return 'Selecione uma categoria';
    if (!titleValid) return 'Informe o nome do evento';
    if (media.some((m) => m.uploading)) return 'Aguarde o envio das fotos/vídeos terminar';
    if (selectedCategory === 'evento' && eventDates.length === 0)
      return 'Selecione ao menos uma data para o evento';
    if (selectedCategory === 'venda' && !priceValid)
      return 'Informe o preço ou marque "Negociável"';
    if (selectedCategory === 'enquete' && !pollDraftValid(pollDraft))
      return 'Preencha ao menos 2 opções e um prazo futuro';
    if (!contentValid) return 'Escreva uma mensagem';
    if (locationStatus === 'invalid') return locationMsg ?? 'Endereço fora do bairro';
    return null;
  })();

  const pickMedia = async () => {
    setError(null);
    const remaining = MAX_MEDIA - media.length;
    if (remaining <= 0) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Permita o acesso às fotos para adicionar imagens ou vídeos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });
      if (res.canceled) return;

      const picked = res.assets.slice(0, remaining);
      const drafts: DraftMedia[] = picked.map((a) => ({
        localUri: a.uri,
        type: a.type === 'video' ? 'video' : 'image',
        uploading: true,
      }));
      setMedia((prev) => [...prev, ...drafts]);

      await Promise.all(
        picked.map(async (asset, i) => {
          const localUri = drafts[i].localUri;
          try {
            const uploaded = await api.uploadPostMedia({
              uri: asset.uri,
              mimeType: asset.mimeType ?? undefined,
              fileName: asset.fileName ?? undefined,
            });
            setMedia((prev) =>
              prev.map((m) =>
                m.localUri === localUri ? { ...m, url: uploaded.url, uploading: false } : m,
              ),
            );
          } catch {
            setMedia((prev) => prev.filter((m) => m.localUri !== localUri));
            setError('Não foi possível enviar um dos arquivos.');
          }
        }),
      );
    } catch {
      setError('Não foi possível carregar as imagens ou vídeos.');
    }
  };

  const removeMedia = (localUri: string) => {
    setMedia((prev) => prev.filter((m) => m.localUri !== localUri));
  };

  const buildDetails = (): Record<string, any> | undefined => {
    switch (selectedCategory) {
      case 'evento':
        return {
          event_dates: eventDates,
          all_day: allDay,
          event_time: allDay ? null : eventTime.trim() || null,
          location: location.trim() || null,
        };
      case 'recomendacao':
        return {
          place_name: placeName.trim() || null,
          location: location.trim() || null,
        };
      case 'venda':
        return {
          price: priceNegotiable ? null : priceNumber(),
          price_negotiable: priceNegotiable,
          location: location.trim() || null,
        };
      case 'perdidos':
        return { location: location.trim() || null };
      case 'seguranca':
        return { location: location.trim() || null };
      default:
        return undefined;
    }
  };

  const handlePublish = async () => {
    if (!canPublish || !selectedCategory) return;
    setError(null);
    setPublishing(true);
    try {
      await api.createPost({
        category: selectedCategory,
        title: title.trim() || undefined,
        content: content.trim(),
        media: media.filter((m) => m.url).map((m) => ({ url: m.url as string, type: m.type })),
        details: buildDetails(),
        important: isImportant,
        poll:
          selectedCategory === 'enquete'
            ? {
                options: cleanPollOptions(pollDraft).map((o) => o.text),
                multiple: pollDraft.multiple,
                closes_at: buildClosesAt(pollDraft.date, pollDraft.time)!,
              }
            : undefined,
      });
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao publicar.');
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WideLayout showMobileMenu={false}>
      <KeyboardAvoidingView
        style={[styles.flex, styles.column]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <LinearGradient colors={['#0D2918', '#15803D']} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => goBack('/(tabs)' as any)}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Novo post</Text>
            {isWide ? (
              // No desktop o botão fica no rodapé, após os campos.
              <View style={styles.headerSpacer} />
            ) : (
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
            )}
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
            <FieldLabel styles={styles}>Categoria</FieldLabel>
            <View style={styles.categoryRow}>
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
            </View>
          </View>

          {/* Important toggle */}
          <View style={styles.importantRow}>
            <View style={styles.importantLeft}>
              <View style={[styles.importantIcon, isImportant && styles.importantIconActive]}>
                <Ionicons name="alert-circle" size={18} color={isImportant ? '#fff' : Colors.error} />
              </View>
              <View>
                <Text style={styles.importantLabel}>Marcar como importante</Text>
                <Text style={styles.importantDesc}>Notifica todos os vizinhos imediatamente</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.toggle, isImportant && styles.toggleActive]}
              onPress={() => setIsImportant(!isImportant)}
            >
              <View style={[styles.toggleThumb, isImportant && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {/* Title / Nome do evento */}
          {selectedCategory === 'evento' ? (
            <>
              <View style={styles.section}>
                {/* Nome do evento (maior) + Horário (menor) na mesma linha */}
                <View style={styles.fieldRow}>
                  <View style={styles.fieldColWide}>
                    <FieldLabel styles={styles}>Nome do evento</FieldLabel>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="Ex.: Feira de trocas do bairro"
                      placeholderTextColor={Colors.textTertiary}
                      value={title}
                      onChangeText={setTitle}
                      maxLength={80}
                    />
                  </View>
                  <View style={styles.fieldCol}>
                    <FieldLabel styles={styles}>Horário</FieldLabel>
                    <TextInput
                      style={[styles.fieldInput, allDay && styles.priceInputDisabled]}
                      placeholder="19:00"
                      placeholderTextColor={Colors.textTertiary}
                      value={allDay ? '' : eventTime}
                      onChangeText={setEventTime}
                      editable={!allDay}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                    />
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      onPress={() => setAllDay(!allDay)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, allDay && styles.checkboxChecked]}>
                        {allDay && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <Text style={styles.checkboxLabel}>
                        {eventDates.length > 1 ? 'Dias inteiros' : 'O dia inteiro'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Data(s) do evento — acima de Mensagem */}
              <View style={styles.section}>
                <FieldLabel styles={styles}>Data(s) do evento</FieldLabel>
                <View style={styles.calendarWrap}>
                  <Calendar
                    // Remonta ao trocar de tema para o calendário recalcular seus estilos
                    key={Colors.background}
                    minDate={today}
                    markedDates={markedDates}
                    onDayPress={(day) => toggleDate(day.dateString)}
                    theme={{
                      calendarBackground: Colors.surface,
                      monthTextColor: Colors.text,
                      dayTextColor: Colors.text,
                      textDisabledColor: Colors.textTertiary,
                      todayTextColor: Colors.primary,
                      arrowColor: Colors.primary,
                      textSectionTitleColor: Colors.textSecondary,
                      selectedDayBackgroundColor: Colors.primary,
                      selectedDayTextColor: '#fff',
                      dotColor: Colors.primary,
                      selectedDotColor: '#fff',
                    }}
                  />
                </View>
                {eventDates.length > 0 && (
                  <Text style={styles.helperText}>
                    {eventDates.length} {eventDates.length === 1 ? 'dia selecionado' : 'dias selecionados'}
                  </Text>
                )}
              </View>
            </>
          ) : (
            <View style={styles.section}>
              <FieldLabel styles={styles} optional>Título</FieldLabel>
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
          )}

          {/* Content / Pergunta da enquete */}
          <View style={styles.section}>
            <FieldLabel styles={styles}>
              {selectedCategory === 'enquete' ? 'Pergunta' : 'Mensagem'}
            </FieldLabel>
            <TextInput
              style={selectedCategory === 'enquete' ? styles.titleInput : styles.contentInput}
              placeholder={
                selectedCategory === 'enquete'
                  ? 'O que você quer perguntar ao bairro?'
                  : 'O que você quer compartilhar com o bairro?'
              }
              placeholderTextColor={Colors.textTertiary}
              value={content}
              onChangeText={setContent}
              multiline={selectedCategory !== 'enquete'}
              numberOfLines={selectedCategory === 'enquete' ? 1 : 6}
              textAlignVertical="top"
              maxLength={selectedCategory === 'enquete' ? 200 : 2000}
            />
            {selectedCategory !== 'enquete' && (
              <Text style={styles.charCount}>{content.length}/2000</Text>
            )}
          </View>

          {/* Editor da enquete */}
          {selectedCategory === 'enquete' && (
            <View style={styles.section}>
              <PollEditor value={pollDraft} onChange={setPollDraft} />
            </View>
          )}

          {/* Fotos e vídeos (opcional, até 10; não se aplica a enquetes) */}
          {!!selectedCategory && selectedCategory !== 'enquete' && (
            <View style={styles.section}>
              <FieldLabel styles={styles} optional>
                {`${selectedCategory === 'venda' ? 'Fotos e vídeos do produto' : 'Fotos e vídeos'} (${media.length}/${MAX_MEDIA})`}
              </FieldLabel>
              {media.length === 0 ? (
                <TouchableOpacity style={styles.imagePicker} onPress={pickMedia} activeOpacity={0.8}>
                  <Ionicons name="image-outline" size={22} color={Colors.primary} />
                  <Text style={styles.imagePickerText}>Adicionar fotos ou vídeos</Text>
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageThumbRow}>
                  {media.map((m) => (
                    <View key={m.localUri} style={styles.imageThumbWrap}>
                      {m.type === 'video' ? (
                        <View style={[styles.imageThumb, styles.videoThumb]}>
                          <Ionicons name="videocam" size={22} color="#fff" />
                        </View>
                      ) : (
                        <Image source={{ uri: m.localUri }} style={styles.imageThumb} resizeMode="cover" />
                      )}
                      {m.uploading && (
                        <View style={styles.thumbUploadingOverlay}>
                          <ActivityIndicator color="#fff" size="small" />
                        </View>
                      )}
                      <View style={styles.removeImageBtnWrap}>
                        <TouchableOpacity
                          style={styles.removeImageBtn}
                          onPress={() => removeMedia(m.localUri)}
                          disabled={m.uploading}
                        >
                          <Ionicons name="close" size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  {media.length < MAX_MEDIA && (
                    <TouchableOpacity style={styles.addImageThumb} onPress={pickMedia} activeOpacity={0.8}>
                      <Ionicons name="add" size={26} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Campos específicos por categoria */}
          {selectedCategory === 'evento' && (
            <LocationField
              styles={styles}
              Colors={Colors}
              value={location}
              onChange={setLocation}
              onBlur={validateLocation}
              onPickPress={() => setLocationPickerOpen(true)}
              status={locationStatus}
              message={locationMsg}
            />
          )}

          {selectedCategory === 'recomendacao' && (
            <View style={styles.section}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldCol}>
                  <FieldLabel styles={styles}>Nome do local</FieldLabel>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Ex.: Padaria do Zé"
                    placeholderTextColor={Colors.textTertiary}
                    value={placeName}
                    onChangeText={setPlaceName}
                    maxLength={80}
                  />
                </View>
                <View style={styles.fieldCol}>
                  <FieldLabel styles={styles}>Local</FieldLabel>
                  <View style={styles.fieldInputRow}>
                    <Ionicons name="location-outline" size={18} color={Colors.textTertiary} />
                    <TextInput
                      style={styles.fieldInputFlex}
                      placeholder="Ex.: Rua das Flores"
                      placeholderTextColor={Colors.textTertiary}
                      value={location}
                      onChangeText={setLocation}
                      onBlur={validateLocation}
                      maxLength={120}
                    />
                    <MapPickButton onPress={() => setLocationPickerOpen(true)} />
                  </View>
                </View>
              </View>
              <LocationStatusRow styles={styles} Colors={Colors} status={locationStatus} message={locationMsg} />
            </View>
          )}

          {selectedCategory === 'venda' && (
            <>
              <View style={styles.section}>
                <FieldLabel styles={styles}>Preço</FieldLabel>
                <View style={styles.priceRow}>
                  <View style={[styles.priceInputWrap, priceNegotiable && styles.priceInputDisabled]}>
                    <Text style={styles.priceCurrency}>R$</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0,00"
                      placeholderTextColor={Colors.textTertiary}
                      value={priceNegotiable ? '' : price}
                      onChangeText={(t) => setPrice(maskPrice(t))}
                      editable={!priceNegotiable}
                      keyboardType="decimal-pad"
                      maxLength={14}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.negChip, priceNegotiable && styles.negChipActive]}
                    onPress={() => setPriceNegotiable(!priceNegotiable)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.negChipText, priceNegotiable && styles.negChipTextActive]}>
                      Negociável
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <LocationField
              styles={styles}
              Colors={Colors}
              value={location}
              onChange={setLocation}
              onBlur={validateLocation}
              onPickPress={() => setLocationPickerOpen(true)}
              status={locationStatus}
              message={locationMsg}
            />
            </>
          )}

          {selectedCategory === 'perdidos' && (
            <LocationField
              styles={styles}
              Colors={Colors}
              value={location}
              onChange={setLocation}
              onBlur={validateLocation}
              onPickPress={() => setLocationPickerOpen(true)}
              status={locationStatus}
              message={locationMsg}
            />
          )}

          {selectedCategory === 'seguranca' && (
            <LocationField
              styles={styles}
              Colors={Colors}
              value={location}
              onChange={setLocation}
              onBlur={validateLocation}
              onPickPress={() => setLocationPickerOpen(true)}
              status={locationStatus}
              message={locationMsg}
            />
          )}

          {/* Dica do que falta preencher para habilitar o botão */}
          {!!selectedCategory && !!disabledReason && (
            <View style={styles.hintRow}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textTertiary} />
              <Text style={styles.hintText}>{disabledReason}</Text>
            </View>
          )}

          {/* Botão de publicar no rodapé (apenas desktop) */}
          {isWide && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.bottomPublishBtn, !canPublish && styles.bottomPublishBtnDisabled]}
                onPress={handlePublish}
                disabled={!canPublish}
                activeOpacity={0.85}
              >
                {publishing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.bottomPublishText}>Publicar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      </WideLayout>

      <LocationPickerModal
        visible={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onConfirm={handlePickLocation}
        initialCenter={pickerCenter}
      />
    </SafeAreaView>
  );
}

// Rótulo de campo. Por padrão mostra asterisco vermelho; `optional` o omite.
function FieldLabel({
  styles,
  children,
  optional,
}: {
  styles: ReturnType<typeof makeStyles>;
  children: string;
  optional?: boolean;
}) {
  return (
    <Text style={styles.sectionLabel}>
      {children}
      {!optional && <Text style={styles.requiredMark}> *</Text>}
    </Text>
  );
}

type LocationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

// Linha de feedback da validação do endereço (dentro do bairro?).
function LocationStatusRow({
  styles,
  Colors,
  status,
  message,
}: {
  styles: ReturnType<typeof makeStyles>;
  Colors: Palette;
  status: LocationStatus;
  message: string | null;
}) {
  if (status === 'idle') return null;
  const map = {
    checking: { icon: 'sync', color: Colors.textTertiary, text: 'Verificando endereço…' },
    valid: { icon: 'checkmark-circle', color: Colors.primary, text: 'Endereço confirmado no seu bairro' },
    invalid: { icon: 'alert-circle', color: Colors.error, text: message ?? 'Endereço fora do bairro' },
  }[status];
  return (
    <View style={styles.locStatusRow}>
      <Ionicons name={map.icon as any} size={14} color={map.color} />
      <Text style={[styles.locStatusText, { color: map.color }]}>{map.text}</Text>
    </View>
  );
}

function LocationField({
  styles,
  Colors,
  value,
  onChange,
  onBlur,
  onPickPress,
  status,
  message,
}: {
  styles: ReturnType<typeof makeStyles>;
  Colors: Palette;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onPickPress: () => void;
  status: LocationStatus;
  message: string | null;
}) {
  return (
    <View style={styles.section}>
      <FieldLabel styles={styles}>Local</FieldLabel>
      <View style={styles.fieldInputRow}>
        <Ionicons name="location-outline" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.fieldInputFlex}
          placeholder="Ex.: Rua das Flores 123, Praça..."
          placeholderTextColor={Colors.textTertiary}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          maxLength={120}
        />
        <MapPickButton onPress={onPickPress} />
      </View>
      <LocationStatusRow styles={styles} Colors={Colors} status={status} message={message} />
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  column: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 16,
    // Padding vertical simétrico: centraliza os botões da barra superior
    // (como acontece na barra inferior no mobile).
    paddingVertical: 12,
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
  headerSpacer: { width: 38, height: 38 },
  bottomPublishBtn: {
    // No desktop o botão fica compacto e alinhado à direita, não ocupando a
    // largura toda.
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    ...Colors.shadow.sm,
  },
  bottomPublishBtnDisabled: { backgroundColor: Colors.border },
  bottomPublishText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  hintText: { fontSize: 13, color: Colors.textTertiary, fontWeight: '500' },
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
  section: { paddingHorizontal: 16, paddingTop: 18 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  requiredMark: { color: Colors.error, fontWeight: '700' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldCol: { flex: 1, minWidth: 0 },
  fieldColWide: { flex: 2, minWidth: 0 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
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
  importantRow: {
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
  importantLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  importantIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importantIconActive: { backgroundColor: Colors.error },
  importantLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  importantDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
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
  fieldInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  fieldInputFlex: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  helperText: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, fontWeight: '600' },
  locStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locStatusText: { fontSize: 12, fontWeight: '600' },
  calendarWrap: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  imagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryFaint,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    paddingVertical: 22,
  },
  imagePickerText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  imageThumbRow: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  imageThumbWrap: { position: 'relative' },
  imageThumb: { width: 92, height: 92, borderRadius: 14, backgroundColor: Colors.border },
  videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  thumbUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageThumb: {
    width: 92,
    height: 92,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryFaint,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
  },
  removeImageBtnWrap: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  removeImageBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  priceInputDisabled: { opacity: 0.5 },
  priceCurrency: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  priceInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: Colors.text, fontWeight: '600' },
  negChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  negChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  negChipText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  negChipTextActive: { color: '#fff' },
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
