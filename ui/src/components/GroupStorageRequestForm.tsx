import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { Colors, Fonts, Radius } from '../constants/theme';
import {
  STORAGE_REQUEST_MAX_GB,
  STORAGE_REQUEST_MIN_GB,
  bytesToStorageRequestGb,
  formatStorageBytes,
  gbToBytes,
  snapStorageRequestGb,
} from '../utils/groupStorage';
import { useSetGroupStorageLimit } from '../hooks/api/useGroups';
import { apiErrorMessage } from '../utils/apiErrors';

export function GroupStorageRequestForm({
  groupId,
  userId,
  currentMaxBytes,
  usedBytes,
}: {
  groupId: string;
  userId: string;
  currentMaxBytes: number;
  usedBytes: number;
}) {
  const setLimit = useSetGroupStorageLimit(groupId, userId);

  const [selectedGb, setSelectedGb] = useState(() => bytesToStorageRequestGb(currentMaxBytes));

  const requestedBytes = useMemo(() => gbToBytes(selectedGb), [selectedGb]);
  const used = Math.max(0, usedBytes);
  const isDecrease = requestedBytes < currentMaxBytes;
  const unchanged = requestedBytes === currentMaxBytes;
  const belowUsage = requestedBytes <= used;
  const saving = setLimit.isPending;
  const canSubmit = !unchanged && !belowUsage && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await setLimit.mutateAsync(requestedBytes);
    } catch (e) {
      const msg = apiErrorMessage(e, 'Could not update storage limit');
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  return (
    <View style={styles.requestBlock}>
      <Text style={styles.requestTitle}>Storage limit</Text>
      <Text style={styles.hint}>
        Changes take effect immediately. The limit must stay above current usage.
      </Text>
      <Text style={styles.value}>{selectedGb} GB</Text>
      <StorageGbSlider valueGb={selectedGb} onChange={setSelectedGb} />
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>{STORAGE_REQUEST_MIN_GB} GB</Text>
        <Text style={styles.rangeLabel}>{STORAGE_REQUEST_MAX_GB} GB</Text>
      </View>
      {belowUsage ? (
        <Text style={styles.error}>
          This group is already using {formatStorageBytes(used)}. Choose a limit higher than current
          usage.
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={() => void submit()}
        disabled={!canSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator color={Colors.accentFg} />
        ) : (
          <Text style={styles.submitText}>
            {isDecrease ? 'Reduce storage limit' : 'Expand storage limit'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function StorageGbSlider({
  valueGb,
  onChange,
}: {
  valueGb: number;
  onChange: (gb: number) => void;
}) {
  const navigation = useNavigation();
  const trackRef = useRef<View>(null);
  const originX = useSharedValue(0);
  const trackW = useSharedValue(0);
  const pct =
    (valueGb - STORAGE_REQUEST_MIN_GB) / (STORAGE_REQUEST_MAX_GB - STORAGE_REQUEST_MIN_GB);

  const setStackSwipe = (enabled: boolean) => {
    navigation.setOptions({ gestureEnabled: enabled });
  };

  useEffect(() => {
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [navigation]);

  const measure = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      originX.value = x;
      trackW.value = w;
    });
  };

  const setFromAbsoluteX = (absoluteX: number) => {
    const w = trackW.value;
    if (w <= 0) return;
    const t = Math.min(1, Math.max(0, (absoluteX - originX.value) / w));
    const raw = STORAGE_REQUEST_MIN_GB + t * (STORAGE_REQUEST_MAX_GB - STORAGE_REQUEST_MIN_GB);
    onChange(snapStorageRequestGb(raw));
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .activeOffsetX([-4, 4])
        .failOffsetY([-24, 24])
        .onTouchesDown(() => {
          runOnJS(measure)();
          runOnJS(setStackSwipe)(false);
        })
        .onBegin((e) => {
          runOnJS(setFromAbsoluteX)(e.absoluteX);
        })
        .onUpdate((e) => {
          runOnJS(setFromAbsoluteX)(e.absoluteX);
        })
        .onFinalize(() => {
          runOnJS(setStackSwipe)(true);
        }),
    [onChange, navigation]
  );

  return (
    <View style={styles.sliderPad}>
      <GestureDetector gesture={pan}>
        <View
          ref={trackRef}
          style={styles.sliderHit}
          onLayout={measure}
          accessibilityRole="adjustable"
          accessibilityLabel="Requested storage"
          accessibilityValue={{
            min: STORAGE_REQUEST_MIN_GB,
            max: STORAGE_REQUEST_MAX_GB,
            now: valueGb,
            text: `${valueGb} gigabytes`,
          }}
        >
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${pct * 100}%` }]} />
          </View>
          <View pointerEvents="none" style={[styles.sliderThumb, { left: `${pct * 100}%` }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const THUMB = 22;

const styles = StyleSheet.create({
  requestBlock: { marginTop: 4 },
  requestTitle: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  hint: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textMuted, marginTop: 4, marginBottom: 10 },
  value: {
    fontSize: 22,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  sliderPad: { paddingHorizontal: THUMB / 2 },
  sliderHit: {
    height: 36,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    top: (36 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    marginLeft: -THUMB / 2,
    borderRadius: THUMB / 2,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 10,
  },
  rangeLabel: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textMuted },
  error: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.notGoing,
    marginBottom: 10,
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
