import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import {
  subscribeUploadProgress,
  type UploadProgressState,
} from '../services/uploadProgress';

export function UploadProgressBanner({ skipSafeArea = false }: { skipSafeArea?: boolean }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<UploadProgressState | null>(null);

  useEffect(() => subscribeUploadProgress(setState), []);

  if (!state) return null;

  const pct = Math.round(state.fraction * 100);
  const label =
    state.total > 1 ? `Uploading ${state.current} of ${state.total}` : 'Uploading';
  const padTop = skipSafeArea ? 8 : Math.max(insets.top, 8) + 8;

  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { paddingTop: padTop }]}
    >
      <View
        style={styles.card}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: pct, min: 0, max: 100 }}
      >
        <View style={styles.row}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.pct}>{pct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(4, pct)}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99998,
    elevation: 24,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Shadows.lg,
    ...(Platform.OS === 'android' ? { elevation: 24 } : null),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: Colors.text,
  },
  pct: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: Colors.textSub,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.bg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
});
