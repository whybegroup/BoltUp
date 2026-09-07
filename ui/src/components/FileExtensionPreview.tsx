import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/theme';
import { isDeletedFileHref, withDeletedFileSuffix } from '../utils/deletedMedia';
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
  const deleted = isDeletedFileHref(url);
  return <Ionicons name={kind.icon} size={size} color={deleted ? Colors.textMuted : kind.color} />;
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
  const deleted = isDeletedFileHref(url);
  const name = deleted
    ? withDeletedFileSuffix(displayFileName(url, fileName))
    : displayFileName(url, fileName);
  const dark = variant === 'viewer';
  const iconSize = variant === 'viewer' ? 56 : variant === 'inline' ? 22 : 36;
  const iconColor = deleted ? (dark ? 'rgba(255,255,255,0.45)' : Colors.textMuted) : dark ? '#fff' : kind.color;

  if (variant === 'inline') {
    return (
      <View style={[styles.inline, style]}>
        <Ionicons name={kind.icon} size={iconSize} color={iconColor} />
        <Text
          style={[styles.inlineName, deleted && styles.deletedName]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {name}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.stack, dark && styles.stackDark, style]}>
      <Ionicons name={kind.icon} size={iconSize} color={iconColor} />
      <Text
        style={[
          styles.name,
          dark && !deleted && styles.nameDark,
          variant === 'viewer' && styles.nameViewer,
          deleted && (dark ? styles.deletedNameDark : styles.deletedName),
        ]}
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
  deletedName: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    textDecorationColor: Colors.textMuted,
  },
  deletedNameDark: {
    color: 'rgba(255,255,255,0.45)',
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(255,255,255,0.45)',
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
