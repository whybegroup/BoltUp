import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

type CommentsSectionProps = {
  isEmpty: boolean;
  emptyContent?: ReactNode;
  children: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onLayout?: ViewProps['onLayout'];
};

export function CommentsSection({
  isEmpty,
  emptyContent,
  children,
  containerStyle,
  contentStyle,
  onLayout,
}: CommentsSectionProps) {
  return (
    <View style={containerStyle} onLayout={onLayout}>
      <View style={contentStyle}>
        {isEmpty ? emptyContent : null}
        {children}
      </View>
    </View>
  );
}
