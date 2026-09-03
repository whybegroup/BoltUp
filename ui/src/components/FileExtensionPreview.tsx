import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/theme';
import { displayFileName, fileKindStyle } from '../utils/fileKind';

export function FileExtensionIcon({
  url,
  fileName,
  size = 16,
}: {
  url: string;
  fileName?: string;
  size?: number;
}) {
  const kind = fileKindStyle(url, fileName);
  return <Ionicons name={kind.icon} size={size} color={kind.color} />;
}

export function FileExtensionPreview({
  url,
  fileName,
  variant = 'tile',
  style,
}: {
  url: string;
  fileName?: string;
  variant?: 'tile' | 'viewer' | 'inline';
  style?: StyleProp<ViewStyle>;
}) {
  const kind = fileKindStyle(url, fileName);
  const name = displayFileName(url, fileName);
  const dark = variant === 'viewer';
  const iconSize = variant === 'viewer' ? 56 : variant === 'inline' ? 22 : 36;

  if (variant === 'inline') {
    return (
      <View style={[styles.inline, style]}>
        <Ionicons name={kind.icon} size={iconSize} color={kind.color} />
        <Text style={styles.inlineName} numberOfLines={1} ellipsizeMode="middle">
          {name}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.stack, dark && styles.stackDark, style]}>
      <Ionicons name={kind.icon} size={iconSize} color={dark ? '#fff' : kind.color} />
      <Text
        style={[styles.name, dark && styles.nameDark, variant === 'viewer' && styles.nameViewer]}
        numberOfLines={variant === 'viewer' ? 3 : 2}
        ellipsizeMode="middle"
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  stackDark: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
  },
  name: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
    textAlign: 'center',
    width: '100%',
  },
  nameDark: {
    color: '#fff',
    marginTop: 12,
  },
  nameViewer: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: Fonts.semiBold,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
  },
  inlineName: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
});
