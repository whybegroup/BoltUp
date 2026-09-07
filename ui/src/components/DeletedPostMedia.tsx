import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/theme';
import { displayFileName } from '../utils/fileKind';
import { isDeletedFileHref, isDeletedImageSrc, withDeletedFileSuffix } from '../utils/deletedMedia';
import { FileExtensionIcon } from './FileExtensionPreview';
import { ResolvableImage } from './ResolvableImage';

export function DeletedImagePlaceholder({
  style,
  accessibilityLabel = 'Deleted image',
}: {
  style?: StyleProp<ImageStyle | ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <View
      style={[styles.imagePh, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name="image-outline" size={22} color={Colors.textMuted} />
      <Text style={styles.imagePhLabel}>DELETED</Text>
    </View>
  );
}

export function PostMediaImage({
  storedUrl,
  style,
  resizeMode = 'cover',
}: {
  storedUrl: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
}) {
  const [missing, setMissing] = useState(() => isDeletedImageSrc(storedUrl));

  useEffect(() => {
    setMissing(isDeletedImageSrc(storedUrl));
  }, [storedUrl]);

  if (missing) {
    return <DeletedImagePlaceholder style={style} />;
  }

  return (
    <ResolvableImage
      storedUrl={storedUrl}
      style={style}
      resizeMode={resizeMode}
      onError={() => setMissing(true)}
    />
  );
}

export function PostAttachmentFileRow({
  url,
  name,
  onPress,
  textStyle,
}: {
  url: string;
  name?: string;
  onPress?: () => void;
  textStyle?: StyleProp<TextStyle>;
}) {
  const deleted = isDeletedFileHref(url);
  const baseName = displayFileName(url, name);
  const label = deleted ? withDeletedFileSuffix(baseName) : baseName;
  const inner = (
    <>
      <FileExtensionIcon url={url} fileName={name} size={14} />
      <Text
        style={[textStyle, deleted && styles.deletedFileName]}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {label}
      </Text>
    </>
  );

  if (deleted || !onPress) {
    return (
      <View
        style={styles.fileRow}
        accessibilityRole="text"
        accessibilityLabel={deleted ? `Deleted file ${label}` : label}
      >
        {inner}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.fileRow}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View attached file ${label}`}
    >
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  imagePh: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    gap: 4,
    paddingHorizontal: 6,
  },
  imagePhLabel: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  deletedFileName: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
    textDecorationColor: Colors.textMuted,
  },
});
