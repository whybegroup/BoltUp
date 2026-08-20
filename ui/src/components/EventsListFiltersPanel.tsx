import { useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from './AppDateTimePicker';
import Svg, { Path } from 'react-native-svg';
import { Colors, Fonts, Radius } from '../constants/theme';
import { formatFilterDatetimeTwelveHour } from '../utils/helpers';
import { Pill } from './ui';
import {
  RSVP_FILTER_OPTIONS,
  formatLocalDateTime,
  formatLocalTimeTwelveHour,
  mergeFilterDraftDatePart,
  mergeFilterDraftTimePart,
  parseFilterDateTime,
  webFilterModalInputStyle,
  type EventDateMode,
} from '../utils/eventListFilters';

export type EventsListFiltersPanelProps = {
  filterRsvp: string[];
  setFilterRsvp: Dispatch<SetStateAction<string[]>>;
  filterNeeds: boolean;
  setFilterNeeds: Dispatch<SetStateAction<boolean>>;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: Dispatch<SetStateAction<boolean>>;
  startDateText: string;
  setStartDateText: Dispatch<SetStateAction<string>>;
  endDateText: string;
  setEndDateText: Dispatch<SetStateAction<string>>;
  startMode: EventDateMode;
  setStartMode: Dispatch<SetStateAction<EventDateMode>>;
  endMode: EventDateMode;
  setEndMode: Dispatch<SetStateAction<EventDateMode>>;
  defaultStartSpecificText: string;
  defaultEndSpecificText: string;
  groupPillsRow?: ReactNode;
};

export function EventsListFiltersPanel({
  filterRsvp,
  setFilterRsvp,
  filterNeeds,
  setFilterNeeds,
  showAdvancedFilters,
  setShowAdvancedFilters,
  startDateText,
  setStartDateText,
  endDateText,
  setEndDateText,
  startMode,
  setStartMode,
  endMode,
  setEndMode,
  defaultStartSpecificText,
  defaultEndSpecificText,
  groupPillsRow,
}: EventsListFiltersPanelProps) {
  const [datetimeFilterModal, setDatetimeFilterModal] = useState<null | 'start' | 'end'>(null);
  const [filterModalDraft, setFilterModalDraft] = useState(() => new Date());
  const [iosFilterFieldPicker, setIosFilterFieldPicker] = useState<null | 'date' | 'time'>(null);
  const [iosFilterSubDraft, setIosFilterSubDraft] = useState(() => new Date());

  const closeDatetimeFilterModal = () => {
    setIosFilterFieldPicker(null);
    setDatetimeFilterModal(null);
  };

  return (
    <>
      <View style={styles.filtersContainer}>
        {groupPillsRow}

        <View style={[styles.filterPanel, { position: 'relative' }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingVertical: 8 }}
          >
            <TouchableOpacity
              onPress={() => setShowAdvancedFilters((p) => !p)}
              style={[
                styles.filterIconBtn,
                showAdvancedFilters && { borderColor: Colors.text, backgroundColor: Colors.text },
              ]}
            >
              <Svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke={showAdvancedFilters ? Colors.surface : Colors.text}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </Svg>
            </TouchableOpacity>
            <Pill
              label="Needs people"
              leading={
                <Ionicons
                  name="warning-outline"
                  size={14}
                  color={filterNeeds ? '#92400E' : Colors.textSub}
                />
              }
              selected={filterNeeds}
              onPress={() => setFilterNeeds((p) => !p)}
              activeColor="#FDE68A"
              activeBg="#FFFBEB"
              activeText="#92400E"
            />
          </ScrollView>

          {showAdvancedFilters && (
            <>
              <View style={styles.filterExpandedRow}>
                <Text style={styles.filterExpandedHeader}>RSVP</Text>
                {RSVP_FILTER_OPTIONS.map(([v, label]) => {
                  const isSelected = filterRsvp.includes(v);
                  const pillStyle =
                    v === 'going'
                      ? isSelected
                        ? styles.rsvpPillGoingActive
                        : styles.rsvpPillGoing
                      : v === 'maybe'
                        ? isSelected
                          ? styles.rsvpPillMaybeActive
                          : styles.rsvpPillMaybe
                        : v === 'notGoing'
                          ? isSelected
                            ? styles.rsvpPillNotGoingActive
                            : styles.rsvpPillNotGoing
                          : isSelected
                            ? styles.rsvpPillNoneActive
                            : styles.rsvpPillNone;

                  return (
                    <TouchableOpacity
                      key={v}
                      style={[styles.rsvpDropdownItem, pillStyle]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setFilterRsvp(isSelected ? [] : [v]);
                      }}
                    >
                      <Text style={styles.rsvpDropdownLabel}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.filterExpandedRow}>
                <Text style={styles.filterExpandedHeader}>Time Range</Text>
                <View style={styles.dateFilterColumn}>
                  <View style={styles.dateFilterRow}>
                    <Text style={styles.dateFilterFieldLabel}>From</Text>
                    <View style={styles.dateFieldWithNow}>
                      <TouchableOpacity
                        style={[
                          styles.dateQuickButton,
                          startMode === 'now' && styles.dateQuickButtonActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setStartMode('now')}
                      >
                        <Text style={styles.dateQuickButtonText}>Now</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.dateQuickButton,
                          startMode === 'allTime' && styles.dateQuickButtonActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setStartMode('allTime')}
                      >
                        <Text style={styles.dateQuickButtonText}>All time</Text>
                      </TouchableOpacity>
                      <View
                        style={[styles.nativeDateFieldWrap, styles.filterDatetimeSlot]}
                        collapsable={false}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            let text = startDateText;
                            if (!text) {
                              const now = new Date();
                              const y = now.getFullYear();
                              const m = String(now.getMonth() + 1).padStart(2, '0');
                              const d = String(now.getDate()).padStart(2, '0');
                              text = `${y}-${m}-${d} 00:00`;
                              setStartDateText(text);
                            }
                            setFilterModalDraft(parseFilterDateTime(text) ?? new Date());
                            setDatetimeFilterModal('start');
                          }}
                          activeOpacity={0.7}
                          style={[
                            styles.dateValueChip,
                            startMode === 'specific' && styles.dateSpecificWrapperActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dateValueText,
                              startMode === 'specific' && styles.dateValueTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {formatFilterDatetimeTwelveHour(
                              startDateText || defaultStartSpecificText
                            )}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                  <View style={styles.dateFilterRow}>
                    <Text style={styles.dateFilterFieldLabel}>To</Text>
                    <View style={styles.dateFieldWithNow}>
                      <TouchableOpacity
                        style={[
                          styles.dateQuickButton,
                          endMode === 'now' && styles.dateQuickButtonActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setEndMode('now')}
                      >
                        <Text style={styles.dateQuickButtonText}>Now</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.dateQuickButton,
                          endMode === 'allTime' && styles.dateQuickButtonActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => setEndMode('allTime')}
                      >
                        <Text style={styles.dateQuickButtonText}>All time</Text>
                      </TouchableOpacity>
                      <View
                        style={[styles.nativeDateFieldWrap, styles.filterDatetimeSlot]}
                        collapsable={false}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            let text = endDateText;
                            if (!text) {
                              const now = new Date();
                              const y = now.getFullYear();
                              const m = String(now.getMonth() + 1).padStart(2, '0');
                              const d = String(now.getDate()).padStart(2, '0');
                              text = `${y}-${m}-${d} 00:00`;
                              setEndDateText(text);
                            }
                            setFilterModalDraft(parseFilterDateTime(text) ?? new Date());
                            setDatetimeFilterModal('end');
                          }}
                          activeOpacity={0.7}
                          style={[
                            styles.dateValueChip,
                            endMode === 'specific' && styles.dateSpecificWrapperActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dateValueText,
                              endMode === 'specific' && styles.dateValueTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {formatFilterDatetimeTwelveHour(
                              endDateText || defaultEndSpecificText
                            )}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={datetimeFilterModal != null}
        onRequestClose={() => {
          if (Platform.OS === 'ios' && iosFilterFieldPicker != null) {
            setIosFilterFieldPicker(null);
          } else {
            closeDatetimeFilterModal();
          }
        }}
        statusBarTranslucent
      >
        <View style={styles.filterDatetimeModalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, styles.iosFilterPickerBackdrop]}
            onPress={() => {
              if (Platform.OS === 'ios' && iosFilterFieldPicker != null) {
                setIosFilterFieldPicker(null);
              } else {
                closeDatetimeFilterModal();
              }
            }}
          />
          <View style={styles.filterDatetimeModalCard} pointerEvents="box-none">
            {Platform.OS === 'ios' && iosFilterFieldPicker != null ? (
              <>
                <View style={styles.filterIosSubPickerHeader}>
                  <TouchableOpacity
                    onPress={() => setIosFilterFieldPicker(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.filterIosSubPickerBack}
                  >
                    <Ionicons name="chevron-back" size={22} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.filterIosSubPickerTitle}>
                    {iosFilterFieldPicker === 'date' ? 'Date' : 'Time'}
                  </Text>
                </View>
                <View
                  style={
                    iosFilterFieldPicker === 'date'
                      ? styles.filterIosSubPickerHostCalendar
                      : styles.filterIosSubPickerHostTime
                  }
                >
                  <DateTimePicker
                    value={iosFilterSubDraft}
                    mode={iosFilterFieldPicker}
                    display={iosFilterFieldPicker === 'date' ? 'inline' : 'spinner'}
                    locale="en-US"
                    onChange={(_, date) => {
                      if (date) setIosFilterSubDraft(date);
                    }}
                    style={
                      iosFilterFieldPicker === 'date'
                        ? styles.filterIosSubPickerCalendar
                        : styles.filterIosSubPickerTimeWheels
                    }
                  />
                </View>
                <TouchableOpacity
                  style={[styles.filterDatetimeModalSave, styles.filterIosSubPickerDone]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (iosFilterFieldPicker === 'date') {
                      setFilterModalDraft((prev) =>
                        mergeFilterDraftDatePart(prev, iosFilterSubDraft)
                      );
                    } else {
                      setFilterModalDraft((prev) =>
                        mergeFilterDraftTimePart(prev, iosFilterSubDraft)
                      );
                    }
                    setIosFilterFieldPicker(null);
                  }}
                >
                  <Text style={styles.filterDatetimeModalSaveText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.filterDatetimeModalTitle}>
                  {datetimeFilterModal === 'start' ? 'From' : datetimeFilterModal === 'end' ? 'To' : ''}
                </Text>
                <ScrollView
                  style={styles.filterDatetimeModalScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.filterModalSectionLabel}>Date</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={
                        datetimeFilterModal
                          ? formatLocalDateTime(filterModalDraft).slice(0, 10)
                          : ''
                      }
                      onChange={(e: { target?: { value?: string } }) => {
                        const datePart = String(e?.target?.value || '').trim();
                        if (!datePart || !datetimeFilterModal) return;
                        const [y, m, d] = datePart.split('-').map(Number);
                        if (!y || !m || !d) return;
                        setFilterModalDraft((prev) =>
                          mergeFilterDraftDatePart(prev, new Date(y, m - 1, d, 12, 0))
                        );
                      }}
                      style={webFilterModalInputStyle()}
                    />
                  ) : Platform.OS === 'ios' ? (
                    <TouchableOpacity
                      style={styles.filterModalIosField}
                      activeOpacity={0.75}
                      onPress={() => {
                        setIosFilterSubDraft(new Date(filterModalDraft));
                        setIosFilterFieldPicker('date');
                      }}
                    >
                      <Text style={styles.filterModalIosFieldText}>
                        {formatLocalDateTime(filterModalDraft).slice(0, 10)}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <DateTimePicker
                      value={filterModalDraft}
                      mode="date"
                      display="spinner"
                      locale="en-US"
                      onChange={(_, date) => {
                        if (date) setFilterModalDraft((prev) => mergeFilterDraftDatePart(prev, date));
                      }}
                      style={styles.inlinePicker}
                    />
                  )}
                  <Text style={styles.filterModalSectionLabel}>Time</Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="time"
                      value={(() => {
                        const t = formatLocalDateTime(filterModalDraft).split(' ')[1] ?? '00:00';
                        return t.length === 5 ? t : '00:00';
                      })()}
                      onChange={(e: { target?: { value?: string } }) => {
                        const timePart = String(e?.target?.value || '').trim();
                        if (!timePart || !datetimeFilterModal) return;
                        const [hs, mins] = timePart.split(':');
                        const hh = Number(hs) || 0;
                        const mm = Number(mins) || 0;
                        setFilterModalDraft((prev) => {
                          const n = new Date(prev);
                          n.setHours(hh, mm, 0, 0);
                          return n;
                        });
                      }}
                      style={webFilterModalInputStyle()}
                    />
                  ) : Platform.OS === 'ios' ? (
                    <TouchableOpacity
                      style={styles.filterModalIosField}
                      activeOpacity={0.75}
                      onPress={() => {
                        setIosFilterSubDraft(new Date(filterModalDraft));
                        setIosFilterFieldPicker('time');
                      }}
                    >
                      <Text style={styles.filterModalIosFieldText}>
                        {formatLocalTimeTwelveHour(filterModalDraft)}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <DateTimePicker
                      value={filterModalDraft}
                      mode="time"
                      display="spinner"
                      is24Hour={false}
                      locale="en-US"
                      onChange={(_, date) => {
                        if (date) setFilterModalDraft((prev) => mergeFilterDraftTimePart(prev, date));
                      }}
                      style={styles.inlinePicker}
                    />
                  )}
                </ScrollView>
                <TouchableOpacity
                  style={styles.filterDatetimeModalSave}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (datetimeFilterModal === 'start') {
                      setStartDateText(formatLocalDateTime(filterModalDraft));
                      setStartMode('specific');
                    } else if (datetimeFilterModal === 'end') {
                      setEndDateText(formatLocalDateTime(filterModalDraft));
                      setEndMode('specific');
                    }
                    closeDatetimeFilterModal();
                  }}
                >
                  <Text style={styles.filterDatetimeModalSaveText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  filtersContainer: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPanel: { paddingBottom: 6 },
  filterIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterExpandedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.bg,
  },
  filterExpandedHeader: {
    width: '100%',
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rsvpDropdownItem: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  rsvpDropdownLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  rsvpPillGoing: { borderColor: Colors.border, backgroundColor: Colors.bg },
  rsvpPillGoingActive: { borderColor: Colors.accent, backgroundColor: Colors.bg },
  rsvpPillMaybe: { borderColor: Colors.border, backgroundColor: Colors.bg },
  rsvpPillMaybeActive: { borderColor: Colors.accent, backgroundColor: Colors.bg },
  rsvpPillNotGoing: { borderColor: Colors.border, backgroundColor: Colors.bg },
  rsvpPillNotGoingActive: { borderColor: Colors.accent, backgroundColor: Colors.bg },
  rsvpPillNone: { borderColor: Colors.border, backgroundColor: Colors.bg },
  rsvpPillNoneActive: { borderColor: Colors.accent, backgroundColor: Colors.bg },
  dateFilterColumn: { width: '100%', gap: 8 },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  dateFilterFieldLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
    minWidth: 40,
  },
  filterDatetimeSlot: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 0,
  },
  dateValueChip: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dateValueText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
    textAlign: 'left',
  },
  dateValueTextActive: { color: Colors.text },
  dateFieldWithNow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    flexWrap: 'wrap',
    flexShrink: 1,
    minWidth: 0,
  },
  nativeDateFieldWrap: { alignSelf: 'flex-start', alignItems: 'flex-start', gap: 6 },
  inlinePicker: { alignSelf: 'flex-start' },
  iosFilterPickerBackdrop: { backgroundColor: 'rgba(0,0,0,0.25)' },
  filterDatetimeModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  filterDatetimeModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 2,
  },
  filterDatetimeModalTitle: {
    fontSize: 17,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    marginBottom: 12,
  },
  filterModalSectionLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    marginTop: 8,
    marginBottom: 6,
  },
  filterDatetimeModalScroll: { maxHeight: 420 },
  filterDatetimeModalSave: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  filterDatetimeModalSaveText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.surface,
  },
  filterModalIosField: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#18181B',
    backgroundColor: Colors.bg,
    marginBottom: 4,
  },
  filterModalIosFieldText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  filterIosSubPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 0,
  },
  filterIosSubPickerTitle: {
    fontSize: 17,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    marginBottom: 0,
    flex: 1,
  },
  filterIosSubPickerBack: {
    paddingVertical: 4,
    paddingRight: 4,
    marginLeft: -4,
  },
  filterIosSubPickerHostCalendar: {
    width: '100%',
    minHeight: 320,
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  filterIosSubPickerHostTime: {
    width: '100%',
    minHeight: 200,
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
    alignItems: 'stretch',
    justifyContent: 'center',
    overflow: 'visible',
  },
  filterIosSubPickerCalendar: { alignSelf: 'center' },
  filterIosSubPickerTimeWheels: { width: '100%', alignSelf: 'stretch' },
  filterIosSubPickerDone: { marginTop: 4 },
  dateQuickButton: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateQuickButtonText: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  dateQuickButtonActive: {
    backgroundColor: Colors.bg,
    borderColor: Colors.accent,
  },
  dateSpecificWrapperActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.bg,
  },
});
