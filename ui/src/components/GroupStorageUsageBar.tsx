import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Radius } from '../constants/theme';
import {
  DEFAULT_GROUP_MAX_STORAGE_BYTES,
  STORAGE_REQUEST_PRESETS_GB,
  formatStorageBytes,
  gbToBytes,
} from '../utils/groupStorage';
import { useCreateGroupStorageRequest, useGroupStorageRequests } from '../hooks/api/useGroups';
import { apiErrorMessage } from '../utils/apiErrors';

export function GroupStorageUsageBar({
  usedBytes,
  maxBytes,
  groupId,
  userId,
  canRequest,
}: {
  usedBytes: number;
  maxBytes?: number;
  groupId?: string;
  userId?: string;
  canRequest?: boolean;
}) {
  const max = maxBytes && maxBytes > 0 ? maxBytes : DEFAULT_GROUP_MAX_STORAGE_BYTES;
  const used = Math.max(0, usedBytes);
  const ratio = Math.min(1, used / max);
  const pct = Math.round(ratio * 100);
  const fillColor = ratio >= 1 ? Colors.notGoing : ratio >= 0.8 ? Colors.maybe : Colors.accent;

  const showRequest = Boolean(canRequest && groupId && userId);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>STORAGE</Text>
      <View style={styles.card}>
        <View style={styles.barTrack} accessibilityRole="progressbar">
          <View
            style={[
              styles.barFill,
              { width: `${Math.max(ratio > 0 ? 2 : 0, pct)}%`, backgroundColor: fillColor },
            ]}
          />
        </View>
        <Text style={styles.caption}>
          {formatStorageBytes(used)} of {formatStorageBytes(max)} used
        </Text>
        {showRequest ? (
          <StorageRequestForm groupId={groupId!} userId={userId!} currentMaxBytes={max} />
        ) : null}
      </View>
    </View>
  );
}

function StorageRequestForm({
  groupId,
  userId,
  currentMaxBytes,
}: {
  groupId: string;
  userId: string;
  currentMaxBytes: number;
}) {
  const { data: requests } = useGroupStorageRequests(groupId, userId);
  const createRequest = useCreateGroupStorageRequest(groupId, userId);
  const pending = requests?.find((r) => r.status === 'pending') ?? null;

  const [selectedGb, setSelectedGb] = useState<number | null>(null);
  const [customGb, setCustomGb] = useState('');
  const [note, setNote] = useState('');

  const requestedBytes = useMemo(() => {
    if (selectedGb != null) return gbToBytes(selectedGb);
    const parsed = parseInt(customGb.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 0;
    return gbToBytes(parsed);
  }, [selectedGb, customGb]);

  const canSubmit =
    requestedBytes > currentMaxBytes && !createRequest.isPending && !pending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await createRequest.mutateAsync({
        requestedBytes,
        note: note.trim() || undefined,
      });
      setNote('');
      setCustomGb('');
      setSelectedGb(null);
    } catch (e) {
      const msg = apiErrorMessage(e, 'Could not send storage request');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  if (pending) {
    return (
      <Text style={styles.pending}>
        A request for {formatStorageBytes(pending.requestedBytes)} is waiting for approval.
      </Text>
    );
  }

  return (
    <View style={styles.requestBlock}>
      <Text style={styles.requestTitle}>Need more space?</Text>
      <Text style={styles.hint}>Ask for a higher limit. A developer will review the request.</Text>
      <View style={styles.presets}>
        {STORAGE_REQUEST_PRESETS_GB.map((gb) => {
          const bytes = gbToBytes(gb);
          const disabled = bytes <= currentMaxBytes;
          const active = selectedGb === gb;
          return (
            <TouchableOpacity
              key={gb}
              onPress={() => {
                if (disabled) return;
                setSelectedGb(gb);
                setCustomGb('');
              }}
              disabled={disabled}
              style={[styles.preset, active && styles.presetActive, disabled && styles.presetDisabled]}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
            >
              <Text style={[styles.presetText, active && styles.presetTextActive]}>{gb} GB</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.customRow}>
        <Text style={styles.customLabel}>Custom</Text>
        <TextInput
          value={customGb}
          onChangeText={(t) => {
            setCustomGb(t.replace(/[^\d]/g, ''));
            setSelectedGb(null);
          }}
          keyboardType="number-pad"
          style={styles.input}
          maxLength={3}
          placeholder="GB"
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={styles.unit}>GB</Text>
      </View>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Optional note"
        placeholderTextColor={Colors.textMuted}
        style={styles.note}
        maxLength={280}
      />
      <TouchableOpacity
        onPress={() => void submit()}
        disabled={!canSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
        accessibilityRole="button"
      >
        {createRequest.isPending ? (
          <ActivityIndicator color={Colors.accentFg} />
        ) : (
          <Text style={styles.submitText}>Request more storage</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  caption: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  pending: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  requestBlock: { marginTop: 14 },
  requestTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  hint: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textMuted, marginTop: 4, marginBottom: 10 },
  presets: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  preset: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  presetActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  presetDisabled: { opacity: 0.4 },
  presetText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textSub },
  presetTextActive: { color: Colors.accentFg },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  customLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSub, width: 56 },
  input: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    fontSize: 14,
    color: Colors.text,
    fontFamily: Fonts.regular,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null),
  },
  unit: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textMuted, width: 28 },
  note: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    fontSize: 14,
    color: Colors.text,
    fontFamily: Fonts.regular,
    marginBottom: 10,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : null),
  },
  submit: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitDisabled: { backgroundColor: Colors.border },
  submitText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.accentFg },
});
