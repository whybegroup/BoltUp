import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Radius } from '../constants/theme';
import { ResolvableImage } from './ResolvableImage';
import { downloadOrShareImage } from '../services/downloadImage';

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

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

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
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [downloading, setDownloading] = useState(false);

  const hasMany = urls.length > 1;
  const hasHeader = !!title || !!subtitle || !!headerAvatar;
  const safeIndex = Math.max(0, Math.min(index, Math.max(urls.length - 1, 0)));
  const currentUrl = urls[safeIndex] ?? '';
  const normalizedUrlMap = useMemo(
    () => (urlMap instanceof Map ? urlMap : urlMap ? new Map(Object.entries(urlMap)) : undefined),
    [urlMap]
  );

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = useCallback(() => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  useEffect(() => {
    if (!visible) return;
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [safeIndex, visible, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
          scale.value = next;
        })
        .onEnd(() => {
          const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value));
          scale.value = withTiming(clamped);
          savedScale.value = clamped;
          if (clamped <= 1.01) {
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            scale.value = withTiming(1);
            savedScale.value = 1;
          }
        }),
    [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .averageTouches(true)
        .onUpdate((e) => {
          if (savedScale.value <= 1.01) return;
          translateX.value = savedTranslateX.value + e.translationX;
          translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
          savedTranslateX.value = translateX.value;
          savedTranslateY.value = translateY.value;
        }),
    [savedScale, translateX, translateY, savedTranslateX, savedTranslateY]
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          if (savedScale.value > 1.05) {
            resetZoom();
          } else {
            scale.value = withTiming(DOUBLE_TAP_SCALE);
            savedScale.value = DOUBLE_TAP_SCALE;
          }
        }),
    [resetZoom, scale, savedScale]
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(pinch, pan, doubleTap),
    [pinch, pan, doubleTap]
  );

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ] as const,
  }));

  const onDownload = useCallback(async () => {
    if (!currentUrl.trim() || downloading) return;
    setDownloading(true);
    try {
      await downloadOrShareImage(currentUrl, normalizedUrlMap);
      if (Platform.OS === 'web') {
        Toast.show({ type: 'success', text1: 'Download started' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not download image';
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setDownloading(false);
    }
  }, [currentUrl, downloading, normalizedUrlMap]);

  const imageHeight = Math.max(240, winH * 0.72);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.root}>
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
            <View style={styles.headerLeft}>
              {headerAvatar}
              {hasHeader ? (
                <View style={styles.headerTextCol}>
                  {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
                  {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
                </View>
              ) : (
                <Text style={styles.headerTitle}>Photo</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => void onDownload()}
                style={styles.iconBtn}
                accessibilityLabel="Download image"
                disabled={downloading || !currentUrl.trim()}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="download-outline" size={22} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

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

          <GestureDetector gesture={composed}>
            <Animated.View style={[{ width: winW, height: imageHeight }, styles.imageStage, imageAnimStyle]}>
              <ResolvableImage
                storedUrl={currentUrl}
                urlMap={normalizedUrlMap}
                style={styles.image}
                resizeMode="contain"
              />
            </Animated.View>
          </GestureDetector>

          {showCounter && hasMany ? (
            <Text style={[styles.counter, { bottom: Math.max(insets.bottom, 16) + 24 }]}>
              {safeIndex + 1} / {urls.length}
            </Text>
          ) : (
            <Text style={[styles.hint, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
              Pinch to zoom · Double-tap
            </Text>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  headerTextCol: { flexShrink: 1, minWidth: 0 },
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  imageStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
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
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  hint: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: Fonts.regular,
  },
});
