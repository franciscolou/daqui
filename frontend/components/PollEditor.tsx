import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useMemo } from 'react';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';

// Locale pt-br do calendário (idempotente — também definido na tela de publicar).
LocaleConfig.locales['pt-br'] = LocaleConfig.locales['pt-br'] ?? {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

const MAX_OPTIONS = 10;

export interface PollDraft {
  options: { id?: string; text: string }[];
  multiple: boolean;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export function emptyPollDraft(): PollDraft {
  return { options: [{ text: '' }, { text: '' }], multiple: false, date: '', time: '18:00' };
}

// Máscara leve HH:MM.
export function maskTime(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

// Constrói o ISO (UTC) a partir de data local + hora; null se inválido.
export function buildClosesAt(date: string, time: string): string | null {
  if (!date || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(y, mo - 1, d, h, m, 0, 0);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function cleanPollOptions(draft: PollDraft): { id?: string; text: string }[] {
  const seen = new Set<string>();
  const out: { id?: string; text: string }[] = [];
  for (const o of draft.options) {
    const text = o.text.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: o.id, text });
  }
  return out;
}

// Válido: ≥2 opções distintas + prazo (data+hora) no futuro.
export function pollDraftValid(draft: PollDraft): boolean {
  if (cleanPollOptions(draft).length < 2) return false;
  const iso = buildClosesAt(draft.date, draft.time);
  return !!iso && new Date(iso).getTime() > Date.now();
}

export default function PollEditor({
  value,
  onChange,
}: {
  value: PollDraft;
  onChange: (draft: PollDraft) => void;
}) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const accent = Colors.category.enquete ?? Colors.primary;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const setOption = (i: number, text: string) => {
    const options = value.options.map((o, idx) => (idx === i ? { ...o, text } : o));
    onChange({ ...value, options });
  };
  const addOption = () => {
    if (value.options.length >= MAX_OPTIONS) return;
    onChange({ ...value, options: [...value.options, { text: '' }] });
  };
  const removeOption = (i: number) => {
    if (value.options.length <= 2) return;
    onChange({ ...value, options: value.options.filter((_, idx) => idx !== i) });
  };

  const marked = value.date
    ? { [value.date]: { selected: true, selectedColor: accent } }
    : {};

  return (
    <View style={{ gap: 16 }}>
      {/* Opções */}
      <View>
        <Text style={styles.label}>
          Opções <Text style={styles.req}>*</Text>
        </Text>
        <View style={{ gap: 8 }}>
          {value.options.map((o, i) => (
            <View key={i} style={styles.optionRow}>
              <View style={styles.optIndex}>
                <Text style={styles.optIndexText}>{i + 1}</Text>
              </View>
              <TextInput
                style={styles.optInput}
                placeholder={`Opção ${i + 1}`}
                placeholderTextColor={Colors.textTertiary}
                value={o.text}
                onChangeText={(t) => setOption(i, t)}
                maxLength={200}
              />
              <TouchableOpacity
                style={styles.removeOpt}
                onPress={() => removeOption(i)}
                disabled={value.options.length <= 2}
                hitSlop={6}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={value.options.length <= 2 ? Colors.border : Colors.textTertiary}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
        {value.options.length < MAX_OPTIONS && (
          <TouchableOpacity style={styles.addOpt} onPress={addOption} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={accent} />
            <Text style={[styles.addOptText, { color: accent }]}>Adicionar opção</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Múltiplos votos */}
      <TouchableOpacity
        style={styles.multiRow}
        activeOpacity={0.8}
        onPress={() => onChange({ ...value, multiple: !value.multiple })}
      >
        <View style={styles.multiLeft}>
          <View style={[styles.multiIcon, { backgroundColor: accent + '18' }]}>
            <Ionicons name="checkmark-done" size={18} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.multiTitle}>Permitir múltiplos votos</Text>
            <Text style={styles.multiDesc}>Cada vizinho pode escolher mais de uma opção</Text>
          </View>
        </View>
        <View style={[styles.toggle, value.multiple && { backgroundColor: accent }]}>
          <View style={[styles.toggleThumb, value.multiple && styles.toggleThumbOn]} />
        </View>
      </TouchableOpacity>

      {/* Prazo de encerramento */}
      <View>
        <Text style={styles.label}>
          Encerra em <Text style={styles.req}>*</Text>
        </Text>
        <View style={styles.calendarWrap}>
          <Calendar
            key={Colors.background}
            minDate={today}
            markedDates={marked}
            onDayPress={(day) => onChange({ ...value, date: day.dateString })}
            theme={{
              calendarBackground: Colors.surface,
              monthTextColor: Colors.text,
              dayTextColor: Colors.text,
              textDisabledColor: Colors.textTertiary,
              todayTextColor: accent,
              arrowColor: accent,
              textSectionTitleColor: Colors.textSecondary,
              selectedDayBackgroundColor: accent,
              selectedDayTextColor: '#fff',
            }}
          />
        </View>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={18} color={Colors.textTertiary} />
          <Text style={styles.timeLabel}>Horário</Text>
          <TextInput
            style={styles.timeInput}
            placeholder="18:00"
            placeholderTextColor={Colors.textTertiary}
            value={value.time}
            onChangeText={(t) => onChange({ ...value, time: maskTime(t) })}
            maxLength={5}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  label: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  req: { color: Colors.error },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optIndex: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optIndexText: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary },
  optInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  removeOpt: { padding: 2 },
  addOpt: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 4 },
  addOptText: { fontSize: 14, fontWeight: '700' },
  multiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  multiLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  multiIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  multiTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  multiDesc: { fontSize: 12, color: Colors.textTertiary, marginTop: 1 },
  toggle: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', ...Colors.shadow.sm },
  toggleThumbOn: { alignSelf: 'flex-end' },
  calendarWrap: { borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  timeLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  timeInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: Colors.text, fontWeight: '600', textAlign: 'right' },
});
