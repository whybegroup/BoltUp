import { useCallback, useMemo, type ReactElement, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, Pressable } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  NestedReorderableList,
  useIsActive,
  useReorderableDrag,
  type ReorderableListRenderItemInfo,
} from 'react-native-reorderable-list';
import { Colors } from '../constants/theme';

function RankingDragHandle({
  drag,
  disabled,
  label,
}: {
  drag: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onLongPress={Platform.OS === 'web' ? undefined : drag}
      onPressIn={Platform.OS === 'web' ? () => !disabled && drag() : undefined}
      disabled={disabled}
      style={styles.dragHandle}
      delayLongPress={120}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="reorder-three" size={22} color={Colors.textMuted} />
    </Pressable>
  );
}

export function RankingPollOptionRowShell({
  dragHandleLabel,
  disabled,
  children,
}: {
  dragHandleLabel: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();
  return (
    <View style={[styles.rowShell, isActive && styles.rowShellDragging]}>
      <RankingDragHandle drag={drag} disabled={disabled || isActive} label={dragHandleLabel} />
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

type PollRankingReorderListProps<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  onReorder: (from: number, to: number) => void;
  renderItem: (info: ReorderableListRenderItemInfo<T>) => ReactElement | null;
  onDragActiveChange?: (active: boolean) => void;
  ItemSeparator?: () => ReactElement | null;
};

export function PollRankingReorderList<T>({
  data,
  keyExtractor,
  onReorder,
  renderItem,
  onDragActiveChange,
  ItemSeparator,
}: PollRankingReorderListProps<T>) {
  const panGesture = useMemo(() => Gesture.Pan().activateAfterLongPress(520), []);

  const setDragActive = useCallback(
    (active: boolean) => {
      onDragActiveChange?.(active);
    },
    [onDragActiveChange],
  );

  const handleDragStart = useCallback(() => {
    'worklet';
    runOnJS(setDragActive)(true);
  }, [setDragActive]);

  const handleDragEnd = useCallback(() => {
    'worklet';
    runOnJS(setDragActive)(false);
  }, [setDragActive]);

  return (
    <NestedReorderableList
      data={data}
      keyExtractor={keyExtractor}
      scrollable={false}
      scrollEnabled={false}
      dragEnabled
      panEnabled
      shouldUpdateActiveItem
      panGesture={panGesture}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      autoscrollThreshold={0.12}
      autoscrollSpeedScale={1.4}
      cellAnimations={{ opacity: 1, transform: [] }}
      onReorder={({ from, to }) => onReorder(from, to)}
      renderItem={renderItem}
      ItemSeparatorComponent={ItemSeparator ?? (() => <View style={styles.gap} />)}
    />
  );
}

const styles = StyleSheet.create({
  dragHandle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowShell: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowShellDragging: {
    zIndex: 2,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  gap: {
    height: 8,
  },
});
