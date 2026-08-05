import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import InfoTooltip from './InfoTooltip';

interface Props {
  // 'YYYY-MM-DD', ou null = imediatamente (assim que o pagamento confirmar).
  value: string | null;
  onChange: (value: string | null) => void;
}

const INFO = 'Quando o anúncio começa a rodar. Deixe em "imediatamente" pra começar assim que o pagamento for confirmado — a duração escolhida acima passa a contar a partir da data marcada aqui.';

function formatDate(date: string) {
  return date.split('-').reverse().join('/');
}

function CalendarDay({
  date,
  today,
  selected,
  onPick,
}: {
  date: DateData;
  today: string;
  selected: boolean;
  onPick: (date: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [hovered, setHovered] = useState(false);
  const selectable = date.dateString >= today;

  return (
    <Pressable
      accessibilityRole={selectable ? 'button' : undefined}
      accessibilityState={{ disabled: !selectable, selected }}
      disabled={!selectable}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => onPick(date.dateString)}
      style={({ pressed }) => [
        styles.calendarDay,
        selected && styles.calendarDaySelected,
        selectable && hovered && !selected && styles.calendarDayHovered,
        selectable && hovered && selected && styles.calendarDaySelectedHovered,
        selectable && pressed && !selected && styles.calendarDayPressed,
      ]}
    >
      <Text style={[
        styles.calendarDayText,
        !selectable && styles.calendarDayTextDisabled,
        date.dateString === today && !selected && styles.calendarDayTextToday,
        selected && styles.calendarDayTextSelected,
      ]}>
        {date.day}
      </Text>
    </Pressable>
  );
}

export default function StartDatePicker({ value, onChange }: Props) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const pick = (date: string) => {
    onChange(date);
    setOpen(false);
  };

  const pickImmediate = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <View style={styles.labelAndInfo}>
          <Text style={styles.label}>Data de início</Text>
          <InfoTooltip text={INFO} />
        </View>
        {value && (
          <TouchableOpacity style={styles.clearButton} onPress={() => onChange(null)}>
            <Text style={styles.clearButtonText}>Voltar pra imediatamente</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.dateButton} onPress={() => setOpen(true)}>
        <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
        <Text style={styles.dateButtonText}>
          {value ? formatDate(value) : 'Imediatamente, assim que o pagamento confirmar'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable nativeID="ad-calendar-no-hover" style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Data de início</Text>
                <Text style={styles.modalSubtitle}>Escolha quando o anúncio começa a rodar</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Calendar
                style={{ minHeight: 350 }}
                current={value && value >= today ? value : today}
                minDate={today}
                hideExtraDays
                disableAllTouchEventsForDisabledDays
                onDayPress={(day: DateData) => pick(day.dateString)}
                dayComponent={({ date }) => {
                  if (!date) return null;
                  return (
                    <CalendarDay
                      date={date}
                      today={today}
                      selected={value === date.dateString}
                      onPick={pick}
                    />
                  );
                }}
                theme={{
                  calendarBackground: Colors.surface,
                  dayTextColor: Colors.text,
                  monthTextColor: Colors.text,
                  textDisabledColor: Colors.textTertiary,
                  arrowColor: Colors.primary,
                  todayTextColor: Colors.primary,
                  selectedDayBackgroundColor: Colors.primary,
                }}
              />
            </ScrollView>
            <TouchableOpacity style={styles.immediateButton} onPress={pickImmediate}>
              <Text style={styles.immediateButtonText}>Começar imediatamente</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  labelAndInfo: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text },
  clearButton: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  clearButtonText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: Colors.primary, borderRadius: 11, paddingVertical: 12, backgroundColor: Colors.primaryFaint },
  dateButtonText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.48)' },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '90%', padding: 16, borderRadius: 16, backgroundColor: Colors.surface, ...Colors.shadow.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  modalSubtitle: { marginTop: 2, fontSize: 12, color: Colors.textSecondary },
  closeButton: { padding: 7, borderRadius: 999, backgroundColor: Colors.borderLight },
  calendarDay: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  calendarDayHovered: { backgroundColor: Colors.primaryFaint },
  calendarDayPressed: { backgroundColor: Colors.primaryLight },
  calendarDaySelected: { backgroundColor: Colors.primary },
  calendarDaySelectedHovered: { backgroundColor: Colors.primaryDark },
  calendarDayText: { fontSize: 14, color: Colors.text },
  calendarDayTextDisabled: { color: Colors.textTertiary },
  calendarDayTextToday: { fontWeight: '800', color: Colors.primary },
  calendarDayTextSelected: { fontWeight: '700', color: '#fff' },
  immediateButton: { alignItems: 'center', marginTop: 10, paddingVertical: 11, borderRadius: 11, backgroundColor: Colors.primaryFaint, borderWidth: 1, borderColor: Colors.primary },
  immediateButtonText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
});
