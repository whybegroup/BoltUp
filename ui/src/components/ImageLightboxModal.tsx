import type { ReactNode } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/theme';
import { ResolvableImage } from './ResolvableImage';

type ImageLightboxModalProps = {
  visible: boolean;
  urls: string[];
  index: number;
  onChangeIndex: (nextIndex: number) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerAvatar?: ReactNode;
  showCounter?: boolean;
  urlMap?: Map<string, string> | Record<string, string>;
};

export function ImageLightboxModal({
  visible,
  urls,
  index,
  onChangeIndex,
  onClose,
  title,
  subtitle,
  headerAvatar,
  showCounter = false,
  urlMap,
}: ImageLightboxModalProps) {
  const hasMany = urls.length > 1;
  const hasHeader = !!title || !!subtitle || !!headerAvatar;
  const safeIndex = Math.max(0, Math.min(index, Math.max(urls.length - 1, 0)));
  const normalizedUrlMap =
    urlMap instanceof Map ? urlMap : urlMap ? new Map(Object.entries(urlMap)) : undefined;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {hasHeader ? (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {headerAvatar}
              <View>
                {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
                {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, styles.closeBtnFloating]}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {hasMany ? (
          <>
            <TouchableOpacity
              accessibilityLabel="Previous image"
              onPress={() => onChangeIndex(Math.max(0, safeIndex - 1))}
              disabled={safeIndex <= 0}
              style={[styles.navBtn, styles.navPrev, safeIndex <= 0 && styles.navBtnDisabled]}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="Next image"
              onPress={() => onChangeIndex(Math.min(urls.length - 1, safeIndex + 1))}
              disabled={safeIndex >= urls.length - 1}
              style={[
                styles.navBtn,
                styles.navNext,
                safeIndex >= urls.length - 1 && styles.navBtnDisabled,
              ]}
            >
              <Ionicons name="chevron-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </>
        ) : null}
        <ResolvableImage
          storedUrl={urls[safeIndex] ?? ''}
          urlMap={normalizedUrlMap}
          style={styles.image}
          resizeMode="contain"
        />
        {showCounter && hasMany ? (
          <Text style={styles.counter}>
            {safeIndex + 1} / {urls.length}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#fff',
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Fonts.regular,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  closeBtnFloating: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 2,
  },
  image: {
    width: '100%',
    height: '70%',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    zIndex: 6,
    elevation: 6,
  },
  navBtnDisabled: { opacity: 0.28 },
  navPrev: { left: 10 },
  navNext: { right: 10 },
  counter: {
    position: 'absolute',
    bottom: 56,
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
});
