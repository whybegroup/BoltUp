import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '../constants/theme';
import { ReactionEmojiGlyph } from './ReactionEmojiGlyph';

type EmojiBarProps = {
  quickReactions: string[];
  activeEmojis?: string[];
  onPressReaction: (emoji: string) => void;
  onPressViewAll: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  viewAllAccessibilityLabel?: string;
};

export function EmojiBar({
  quickReactions,
  activeEmojis = [],
  onPressReaction,
  onPressViewAll,
  disabled = false,
  style,
  viewAllAccessibilityLabel = 'More emojis',
}: EmojiBarProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.quickInner}>
        {quickReactions.map((emoji) => {
          const active = activeEmojis.includes(emoji);
          return (
            <TouchableOpacity
              key={emoji}
              onPress={() => onPressReaction(emoji)}
              disabled={disabled}
              style={[styles.quickHit, active && styles.quickHitActive]}
              accessibilityLabel={`React with ${emoji}`}
            >
              <ReactionEmojiGlyph emoji={emoji} size={24} />
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={styles.moreBtn}
        onPress={onPressViewAll}
        disabled={disabled}
        accessibilityLabel={viewAllAccessibilityLabel}
        activeOpacity={0.75}
      >
        <View style={styles.moreInner}>
          <Ionicons name="happy-outline" size={22} color={Colors.textSub} />
          <View style={styles.morePlus} pointerEvents="none">
            <Ionicons name="add" size={11} color={Colors.textSub} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  quickInner: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickHit: {
    flex: 1,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderRadius: 10,
  },
  quickHitActive: {
    opacity: 0.85,
  },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreInner: {
    position: 'relative',
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePlus: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
});
