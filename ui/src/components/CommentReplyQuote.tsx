import { Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

type CommentReplyQuoteProps = {
  author: string;
  preview: string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  authorStyle?: StyleProp<TextStyle>;
  previewStyle?: StyleProp<TextStyle>;
};

export function CommentReplyQuote({
  author,
  preview,
  onPress,
  onLongPress,
  accessibilityLabel = 'Jump to replied comment',
  containerStyle,
  pressedStyle,
  authorStyle,
  previewStyle,
}: CommentReplyQuoteProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [containerStyle, pressed ? [styles.pressed, pressedStyle] : null]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="return-down-forward" size={14} color={Colors.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={authorStyle} numberOfLines={1}>
          {author}
        </Text>
        <Text style={previewStyle} numberOfLines={2}>
          {preview}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.88 },
});
