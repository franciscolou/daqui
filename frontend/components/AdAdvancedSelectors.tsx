import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORIES } from '../data/mock';
import { Palette } from '../constants/Colors';
import { useTheme, useThemedStyles } from '../lib/theme';
import InfoTooltip from './InfoTooltip';
import { useT } from '../lib/i18n';
import { activeLocale } from '../lib/time';

export interface AdAdvancedSelectorValue {
  categories: string[];
  hours: number[] | null;
  daysOfWeek: number[] | null;
  specialDates: string[];
}

interface Props {
  value: AdAdvancedSelectorValue;
  onChange: (value: AdAdvancedSelectorValue) => void;
  // Janela real da campanha ('YYYY-MM-DD', inclusive dos dois lados) — datas
  // especiais fora dela nunca coincidem com a campanha ativa (ver
  // `daos/ad.py::_matches_schedule` no backend) e são recusadas no checkout.
  minDate: string;
  maxDate: string;
}

const POST_CATEGORIES = CATEGORIES.filter((category) => category.key !== 'todos');
const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function FieldLabel({
  children,
  info,
  onClear,
}: {
  children: string;
  info: string;
  onClear?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  return (
    <View style={styles.labelRow}>
      <View style={styles.labelAndInfo}>
        <Text style={styles.label}>{children}</Text>
        <InfoTooltip text={info} />
      </View>
      {onClear && (
        <TouchableOpacity style={styles.clearButton} onPress={onClear}>
          <Text style={styles.clearButtonText}>{t('ads.advanced.clear')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function toggle<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((current) => current !== item) : [...items, item];
}

function formatBrDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(activeLocale());
}

function CalendarDay({
  date,
  today,
  minDate,
  maxDate,
  selected,
  onToggle,
}: {
  date: DateData;
  today: string;
  minDate: string;
  maxDate: string;
  selected: boolean;
  onToggle: (date: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [hovered, setHovered] = useState(false);
  const selectable = date.dateString >= minDate && date.dateString <= maxDate;

  return (
    <Pressable
      accessibilityRole={selectable ? 'button' : undefined}
      accessibilityState={{ disabled: !selectable, selected }}
      disabled={!selectable}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => onToggle(date.dateString)}
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

export default function AdAdvancedSelectors({ value, onChange, minDate, maxDate }: Props) {
  const Colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useT();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const markedDates = useMemo(
    () => Object.fromEntries(value.specialDates.map((date) => [date, {
      selected: true,
      selectedColor: Colors.primary,
    }])),
    [Colors.primary, value.specialDates],
  );

  const set = <K extends keyof AdAdvancedSelectorValue>(
    key: K,
    next: AdAdvancedSelectorValue[K],
  ) => onChange({ ...value, [key]: next });

  const toggleHour = (hour: number) => {
    const next = toggle(value.hours ?? [], hour).sort((a, b) => a - b);
    set('hours', next.length ? next : null);
  };

  const toggleDay = (day: number) => {
    const next = toggle(value.daysOfWeek ?? [], day).sort((a, b) => a - b);
    set('daysOfWeek', next.length ? next : null);
  };

  const toggleDate = (date: string) =>
    set('specialDates', toggle(value.specialDates, date).sort());

  return (
    <View style={styles.container}>
      <FieldLabel
        info={t('ads.advanced.info.categories')}
        onClear={value.categories.length ? () => set('categories', []) : undefined}
      >
        {t('ads.advanced.categories')}
      </FieldLabel>
      <View style={styles.chips}>
        {POST_CATEGORIES.map((category) => {
          const active = value.categories.includes(category.key);
          return (
            <TouchableOpacity
              key={category.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => set('categories', toggle(value.categories, category.key))}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`categories.${category.key}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FieldLabel
        info={t('ads.advanced.info.hours')}
        onClear={value.hours?.length ? () => set('hours', null) : undefined}
      >
        {t('ads.advanced.hours')}
      </FieldLabel>
      <View style={styles.hoursGrid}>
        {HOURS.map((hour) => {
          const active = value.hours?.includes(hour) ?? false;
          return (
            <TouchableOpacity
              key={hour}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              style={[styles.hour, active && styles.chipActive]}
              onPress={() => toggleHour(hour)}
            >
              <Text style={[styles.hourText, active && styles.chipTextActive]}>
                {String(hour).padStart(2, '0')}h
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.helper}>{value.hours?.length ? t('ads.advanced.hoursSelected', { count: value.hours.length }) : t('ads.advanced.anyTime')}</Text>

      <FieldLabel
        info={t('ads.advanced.info.days')}
        onClear={value.daysOfWeek?.length ? () => set('daysOfWeek', null) : undefined}
      >
        {t('ads.advanced.days')}
      </FieldLabel>
      <View style={styles.chips}>
        {WEEK_DAYS.map((label, day) => {
          const active = value.daysOfWeek?.includes(day) ?? false;
          return (
            <TouchableOpacity
              key={label}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              style={[styles.dayChip, active && styles.chipActive]}
              onPress={() => toggleDay(day)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`ads.advanced.weekdays.${label}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {!value.daysOfWeek?.length && <Text style={styles.helper}>{t('ads.advanced.everyDay')}</Text>}

      <FieldLabel
        info={t('ads.advanced.info.dates')}
        onClear={value.specialDates.length ? () => set('specialDates', []) : undefined}
      >
        {t('ads.advanced.specialDatesOptional')}
      </FieldLabel>
      <TouchableOpacity style={styles.calendarButton} onPress={() => setCalendarOpen(true)}>
        <Ionicons name="calendar-outline" size={17} color={Colors.primary} />
        <Text style={styles.calendarButtonText}>{t('ads.advanced.chooseCalendar')}</Text>
      </TouchableOpacity>
      <Text style={styles.helper}>
        {value.specialDates.length
          ? t('ads.advanced.datesSelectedHint', { start: formatBrDate(minDate), end: formatBrDate(maxDate) })
          : t('ads.advanced.noDatesHint', { start: formatBrDate(minDate), end: formatBrDate(maxDate) })}
      </Text>
      {!!value.specialDates.length && (
        <View style={styles.chips}>
          {value.specialDates.map((date) => (
            <TouchableOpacity key={date} style={styles.dateChip} onPress={() => toggleDate(date)}>
              <Text style={styles.dateText}>{formatBrDate(date)}</Text>
              <Ionicons name="close" size={14} color={Colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
        <Pressable nativeID="ad-calendar-no-hover" style={styles.overlay} onPress={() => setCalendarOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('ads.advanced.specialDates')}</Text>
                <Text style={styles.modalSubtitle}>{t('ads.advanced.tapDates')}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setCalendarOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Calendar
                style={{ minHeight: 350 }}
                current={minDate}
                minDate={minDate}
                maxDate={maxDate}
                hideExtraDays
                disableAllTouchEventsForDisabledDays
                markedDates={markedDates}
                onDayPress={(day: DateData) => toggleDate(day.dateString)}
                dayComponent={({ date }) => {
                  if (!date) return null;
                  return (
                    <CalendarDay
                      date={date}
                      today={today}
                      minDate={minDate}
                      maxDate={maxDate}
                      selected={value.specialDates.includes(date.dateString)}
                      onToggle={toggleDate}
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
                }}
              />
            </ScrollView>
            <TouchableOpacity style={styles.doneButton} onPress={() => setCalendarOpen(false)}>
              <Text style={styles.doneButtonText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (Colors: Palette) => StyleSheet.create({
  container: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  labelAndInfo: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.text },
  clearButton: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  clearButtonText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  dayChip: { minWidth: 48, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  chipTextActive: { color: '#fff' },
  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hour: { width: 48, alignItems: 'center', paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  hourText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  helper: { fontSize: 11, color: Colors.textTertiary },
  calendarButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: Colors.primary, borderRadius: 11, paddingVertical: 10, backgroundColor: Colors.primaryFaint },
  calendarButtonText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.primaryFaint, borderWidth: 1, borderColor: Colors.primary },
  dateText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.48)' },
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
  doneButton: { alignItems: 'center', marginTop: 10, paddingVertical: 11, borderRadius: 11, backgroundColor: Colors.primary },
  doneButtonText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
