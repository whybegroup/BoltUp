import { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { formatLocalDateInput, isSameDay } from '../utils/helpers';
import { formSectionTitleStyle } from './ui';
import {
  type RecurrenceFormState,
  type RecurrencePreset,
  type RecurrenceEndType,
  type MonthlyRecurrencePattern,
  formatRecurrenceFormSummary,
  defaultRecurrenceFormState,
  normalizeRecurrenceCount,
  formatMonthlyPatternSummary,
  getRecurrenceUntilMaxCalendarDate,
  clampRecurrenceUntilYmd,
} from '../utils/recurrence';

type Props = {
  anchorDate: Date;
  value: RecurrenceFormState;
  onChange: (next: RecurrenceFormState) => void;
};

const UNTIL_CAL_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Selected rows/chips in the repeat modal (not primary actions). */
const REPEAT_SELECT_BG = '#52525B';
const REPEAT_SELECT_FG = '#FAFAF9';

function getUntilMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const daysInMo = last.getDate();
  const rows: (Date | null)[][] = [];
  let row: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) row.push(null);
  for (let d = 1; d <= daysInMo; d++) {
    row.push(new Date(year, month, d));
    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }
  return rows;
}

function untilLocalDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function UntilEndDateCalendar({
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  minDate,
  maxDate,
  selectedYmd,
  onSelectYmd,
}: {
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  minDate: Date;
  maxDate: Date;
  selectedYmd: string;
  onSelectYmd: (ymd: string) => void;
}) {
  const grid = useMemo(() => getUntilMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const selectedDate = useMemo(() => parseYmdToLocalDate(selectedYmd), [selectedYmd]);
  const minT = untilLocalDayMs(minDate);
  const maxT = untilLocalDayMs(maxDate);
  const monthTitle = new Date(viewYear, viewMonth, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.untilCal}>
      <View style={styles.untilCalHeader}>
        <TouchableOpacity onPress={onPrevMonth} hitSlop={10} style={styles.untilCalNav} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={18} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.untilCalTitle}>{monthTitle}</Text>
        <TouchableOpacity onPress={onNextMonth} hitSlop={10} style={styles.untilCalNav} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={18} color={Colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.untilCalWeekdayRow}>
        {UNTIL_CAL_WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.untilCalWeekday}>
            {w}
          </Text>
        ))}
      </View>
      {grid.map((grow, ri) => (
        <View key={ri} style={styles.untilCalRow}>
          {grow.map((cell, ci) => {
            if (!cell) return <View key={ci} style={styles.untilCalCell} />;
            const t = untilLocalDayMs(cell);
            const disabled = t < minT || t > maxT;
            const selected = !!selectedDate && !disabled && isSameDay(cell, selectedDate);
            const label = (
              <Text
                style={[
                  styles.untilCalCellText,
                  disabled && styles.untilCalCellTextDisabled,
                  selected && styles.untilCalCellTextSelected,
                ]}
              >
                {cell.getDate()}
              </Text>
            );
            if (disabled) {
              return (
                <View key={ci} style={[styles.untilCalCell, styles.untilCalCellDisabled]}>
                  {label}
                </View>
              );
            }
            return (
              <TouchableOpacity
                key={ci}
                style={[styles.untilCalCell, selected && styles.untilCalCellSelected]}
                onPress={() => onSelectYmd(formatLocalDateInput(cell))}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                {label}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const PRESET_ROWS: { preset: RecurrencePreset; label: string }[] = [
  { preset: 'none', label: 'Does not repeat' },
  { preset: 'daily', label: 'Daily' },
  { preset: 'weekly', label: 'Weekly' },
  { preset: 'monthly', label: 'Monthly' },
  { preset: 'yearly', label: 'Annually' },
  { preset: 'custom', label: 'Custom…' },
];

function toggleDay(days: number[], d: number): number[] {
  const has = days.includes(d);
  if (has) return days.filter((x) => x !== d).sort((a, b) => a - b);
  return [...days, d].sort((a, b) => a - b);
}

function parseYmdToLocalDate(s: string): Date | null {
  const [y, m, d] = s.trim().split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function MonthlyPatternSection({
  anchorDate,
  pattern,
  interval,
  onPattern,
}: {
  anchorDate: Date;
  pattern: MonthlyRecurrencePattern;
  interval: number;
  onPattern: (p: MonthlyRecurrencePattern) => void;
}) {
  const iv = Math.max(1, interval);
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[styles.endRow, pattern === 'monthDay' && styles.endRowOn]}
        onPress={() => onPattern('monthDay')}
      >
        <Text style={[styles.endRowText, styles.monthlyOptionSummary]}>
          {formatMonthlyPatternSummary('monthDay', iv, anchorDate)}
        </Text>
        {pattern === 'monthDay' ? (
          <Ionicons name="radio-button-on" size={18} color={REPEAT_SELECT_BG} />
        ) : (
          <Ionicons name="radio-button-off" size={18} color={Colors.textMuted} />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.endRow, pattern === 'weekdayOfMonth' && styles.endRowOn]}
        onPress={() => onPattern('weekdayOfMonth')}
      >
        <Text style={[styles.endRowText, styles.monthlyOptionSummary]}>
          {formatMonthlyPatternSummary('weekdayOfMonth', iv, anchorDate)}
        </Text>
        {pattern === 'weekdayOfMonth' ? (
          <Ionicons name="radio-button-on" size={18} color={REPEAT_SELECT_BG} />
        ) : (
          <Ionicons name="radio-button-off" size={18} color={Colors.textMuted} />
        )}
      </TouchableOpacity>
    </View>
  );
}

export function RecurrenceField({ anchorDate, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [untilViewMonth, setUntilViewMonth] = useState(() => ({
    y: anchorDate.getFullYear(),
    m: anchorDate.getMonth(),
  }));
  const summary = useMemo(() => formatRecurrenceFormSummary(value, anchorDate), [value, anchorDate]);

  const untilMinDate = useMemo(() => startOfLocalDay(anchorDate), [anchorDate]);
  const untilMaxDate = useMemo(() => getRecurrenceUntilMaxCalendarDate(anchorDate), [anchorDate]);
  const untilPickerValue = useMemo(() => {
    const raw = parseYmdToLocalDate(value.untilDate) ?? untilMinDate;
    const t = startOfLocalDay(raw).getTime();
    const minT = untilMinDate.getTime();
    const maxT = untilMaxDate.getTime();
    if (t < minT) return untilMinDate;
    if (t > maxT) return untilMaxDate;
    return raw;
  }, [value.untilDate, untilMinDate, untilMaxDate]);

  useEffect(() => {
    if (!open || value.endType !== 'until') return;
    const r = untilPickerValue;
    setUntilViewMonth({ y: r.getFullYear(), m: r.getMonth() });
  }, [open, value.endType, untilPickerValue]);

  const applyPreset = (preset: RecurrencePreset) => {
    if (preset === 'none') {
      onChange(defaultRecurrenceFormState());
      return;
    }
    const next: RecurrenceFormState = {
      ...defaultRecurrenceFormState(),
      preset,
    };
    if (preset === 'custom') {
      next.customInterval = value.customInterval >= 1 ? value.customInterval : 1;
      next.customUnit = value.customUnit;
      next.weeklyDays = value.weeklyDays.length ? value.weeklyDays : [anchorDate.getDay()];
      next.monthlyPattern = value.monthlyPattern;
      next.endType = value.endType;
      next.untilDate = clampRecurrenceUntilYmd(value.untilDate || '', anchorDate);
      next.count = value.count || '10';
    }
    onChange(next);
  };

  const setEndType = (endType: RecurrenceEndType) => {
    onChange({ ...value, endType });
  };

  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={styles.wrap}>
      <Text style={formSectionTitleStyle}>Repeat</Text>
      <TouchableOpacity style={styles.row} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <Text style={styles.rowText}>{summary}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Pressable
            style={styles.modalDismiss}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Repeat event</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.dialogScroll}
              contentContainerStyle={styles.dialogScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {PRESET_ROWS.map(({ preset, label }) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.option, value.preset === preset && styles.optionOn]}
                  onPress={() => applyPreset(preset)}
                >
                  <Text style={[styles.optionText, value.preset === preset && styles.optionTextOn]}>
                    {label}
                  </Text>
                  {value.preset === preset ? (
                    <Ionicons name="checkmark" size={18} color={REPEAT_SELECT_FG} />
                  ) : null}
                </TouchableOpacity>
              ))}

              {value.preset === 'monthly' && (
                <MonthlyPatternSection
                  anchorDate={anchorDate}
                  pattern={value.monthlyPattern}
                  interval={1}
                  onPattern={(monthlyPattern) => onChange({ ...value, monthlyPattern })}
                />
              )}

              {value.preset === 'custom' && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Every</Text>
                  <View style={styles.customRow}>
                    <TextInput
                      style={styles.intervalInput}
                      keyboardType="number-pad"
                      value={String(value.customInterval)}
                      onChangeText={(t) => {
                        const n = parseInt(t.replace(/\D/g, ''), 10);
                        onChange({
                          ...value,
                          customInterval: Number.isFinite(n) && n > 0 ? Math.min(999, n) : 1,
                        });
                      }}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                      {(
                        [
                          ['day', 'day'],
                          ['week', 'week'],
                          ['month', 'month'],
                          ['year', 'year'],
                        ] as const
                      ).map(([u, lab]) => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.unitChip, value.customUnit === u && styles.unitChipOn]}
                          onPress={() => onChange({ ...value, customUnit: u })}
                        >
                          <Text style={[styles.unitChipText, value.customUnit === u && styles.unitChipTextOn]}>
                            {lab}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}

              {value.preset === 'custom' && value.customUnit === 'week' && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Repeat on</Text>
                  <View style={styles.dowRow}>
                    {weekdayLabels.map((ch, i) => {
                      const on = value.weeklyDays.includes(i);
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[styles.dowCell, on && styles.dowCellOn]}
                          onPress={() =>
                            onChange({
                              ...value,
                              weeklyDays: toggleDay(
                                value.weeklyDays.length ? value.weeklyDays : [anchorDate.getDay()],
                                i
                              ),
                            })
                          }
                        >
                          <Text style={[styles.dowText, on && styles.dowTextOn]}>{ch}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {value.preset === 'custom' && value.customUnit === 'month' && (
                <MonthlyPatternSection
                  anchorDate={anchorDate}
                  pattern={value.monthlyPattern}
                  interval={value.customInterval >= 1 ? value.customInterval : 1}
                  onPattern={(monthlyPattern) => onChange({ ...value, monthlyPattern })}
                />
              )}

              {value.preset !== 'none' && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Ends</Text>
                  <TouchableOpacity
                    style={[styles.endRow, value.endType === 'until' && styles.endRowOn]}
                    onPress={() => setEndType('until')}
                  >
                    <Text style={styles.endRowText}>On date</Text>
                    {value.endType === 'until' ? (
                      <Ionicons name="radio-button-on" size={18} color={REPEAT_SELECT_BG} />
                    ) : (
                      <Ionicons name="radio-button-off" size={18} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.endRow, value.endType === 'count' && styles.endRowOn]}
                    onPress={() => setEndType('count')}
                  >
                    <Text style={styles.endRowText}>After number of times</Text>
                    {value.endType === 'count' ? (
                      <Ionicons name="radio-button-on" size={18} color={REPEAT_SELECT_BG} />
                    ) : (
                      <Ionicons name="radio-button-off" size={18} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                  {value.endType === 'until' ? (
                    <UntilEndDateCalendar
                      viewYear={untilViewMonth.y}
                      viewMonth={untilViewMonth.m}
                      onPrevMonth={() =>
                        setUntilViewMonth(({ y, m }) => {
                          const d = new Date(y, m - 1, 1);
                          return { y: d.getFullYear(), m: d.getMonth() };
                        })
                      }
                      onNextMonth={() =>
                        setUntilViewMonth(({ y, m }) => {
                          const d = new Date(y, m + 1, 1);
                          return { y: d.getFullYear(), m: d.getMonth() };
                        })
                      }
                      minDate={untilMinDate}
                      maxDate={untilMaxDate}
                      selectedYmd={value.untilDate}
                      onSelectYmd={(ymd) =>
                        onChange({ ...value, untilDate: clampRecurrenceUntilYmd(ymd, anchorDate) })
                      }
                    />
                  ) : null}
                  {value.endType === 'count' ? (
                    <TextInput
                      style={[styles.dateInput, styles.countInputMargin]}
                      keyboardType="number-pad"
                      value={value.count}
                      onChangeText={(t) => onChange({ ...value, count: t.replace(/\D/g, '') })}
                      onBlur={() => {
                        const raw = value.count.replace(/\D/g, '');
                        const parsed = parseInt(raw, 10);
                        const n =
                          !raw || !Number.isFinite(parsed) || parsed < 1
                            ? normalizeRecurrenceCount(10)
                            : normalizeRecurrenceCount(parsed);
                        if (String(n) !== value.count) onChange({ ...value, count: String(n) });
                      }}
                    />
                  ) : null}
                </View>
              )}
            </ScrollView>
            <View style={styles.dialogFooter}>
              <TouchableOpacity style={styles.doneBtn} onPress={() => setOpen(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: 9,
    paddingHorizontal: 12,
    minHeight: 0,
  },
  rowText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.text, flex: 1 },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalDismiss: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    maxHeight: Platform.OS === 'web' ? ('92vh' as any) : '90%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flexDirection: 'column',
    ...Shadows.lg,
  },
  dialogHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  dialogTitle: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.text },
  dialogScroll: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  dialogScrollContent: { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 4 },
  dialogFooter: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
  },
  optionOn: { backgroundColor: REPEAT_SELECT_BG },
  optionText: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text, flex: 1 },
  optionTextOn: { color: REPEAT_SELECT_FG },
  section: { marginTop: 6, marginBottom: 2, paddingHorizontal: 6 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dowRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  dowCell: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  dowCellOn: { backgroundColor: REPEAT_SELECT_BG, borderColor: REPEAT_SELECT_BG },
  dowText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.text },
  dowTextOn: { color: REPEAT_SELECT_FG },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  intervalInput: {
    width: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 6,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
    backgroundColor: Colors.surface,
    textAlign: 'center',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null),
  },
  unitScroll: { flexGrow: 0, flexShrink: 1 },
  unitChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
    backgroundColor: Colors.bg,
  },
  unitChipOn: { backgroundColor: REPEAT_SELECT_BG, borderColor: REPEAT_SELECT_BG },
  unitChipText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.text },
  unitChipTextOn: { color: REPEAT_SELECT_FG },
  endRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  endRowOn: {},
  endRowText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.text },
  monthlyOptionSummary: { flex: 1, marginRight: 6 },
  untilCal: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 6,
    backgroundColor: Colors.bg,
  },
  untilCalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  untilCalNav: { padding: 2 },
  untilCalTitle: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text },
  untilCalWeekdayRow: { flexDirection: 'row', marginBottom: 4 },
  untilCalWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
  },
  untilCalRow: { flexDirection: 'row' },
  untilCalCell: {
    flex: 1,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  untilCalCellDisabled: {
    opacity: 0.38,
  },
  untilCalCellSelected: {
    backgroundColor: REPEAT_SELECT_BG,
  },
  untilCalCellText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.text,
    textAlign: 'center',
  },
  untilCalCellTextDisabled: {
    color: Colors.textMuted,
  },
  untilCalCellTextSelected: {
    color: REPEAT_SELECT_FG,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 8,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.surface,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null),
  },
  countInputMargin: { marginTop: 6 },
  doneBtn: {
    backgroundColor: REPEAT_SELECT_BG,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: REPEAT_SELECT_FG },
});
