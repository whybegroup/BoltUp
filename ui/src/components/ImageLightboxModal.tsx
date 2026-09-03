import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Radius } from '../constants/theme';
import { edgeToEdgeModalProps } from './edgeToEdgeModalProps';
import { ResolvableImage } from './ResolvableImage';
import { FileExtensionPreview } from './FileExtensionPreview';
import { shareImage } from '../services/downloadImage';
import { isImageFileUrl } from '../utils/fileKind';

type ImageLightboxModalProps = {
  visible: boolean;
  urls: string[];
  /** Parallel to `urls` — original file names for non-image items. */
  names?: Array<string | undefined>;
  index: number;
  onChangeIndex: (nextIndex: number) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerAvatar?: ReactNode;
  showCounter?: boolean;
  urlMap?: Map<string, string> | Record<string, string>;
  onDelete?: (url: string) => void;
  deleting?: boolean;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_EPS = 1.01;
const DOUBLE_TAP_SCALE = 2.5;
const SLIDE = { duration: 220, easing: Easing.out(Easing.cubic) };
const DISMISS = { duration: 220, easing: Easing.in(Easing.cubic) };

function clampZoomPan(tx: number, ty: number, s: number, w: number, h: number): { x: number; y: number } {
  'worklet';
  const maxX = Math.max(0, (w * (s - 1)) / 2);
  const maxY = Math.max(0, (h * (s - 1)) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, tx)),
    y: Math.min(maxY, Math.max(-maxY, ty)),
  };
}

export function ImageLightboxModal({
  visible,
  urls,
  names,
  index,
  onChangeIndex,
  onClose,
  title,
  subtitle,
  headerAvatar,
  showCounter = false,
  urlMap,
  onDelete,
  deleting = false,
}: ImageLightboxModalProps) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const imageHeight = Math.max(240, winH * 0.72);
  const [sharing, setSharing] = useState(false);

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
  const pageOffset = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const panAxis = useSharedValue(0);
  const pageIndexSv = useSharedValue(safeIndex);
  const pageCountSv = useSharedValue(Math.max(urls.length, 1));
  const widthSv = useSharedValue(winW);
  const heightSv = useSharedValue(imageHeight);
  const dragOrigin = useSharedValue(0);
  const isPaging = useSharedValue(0);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      onChangeIndex(nextIndex);
    },
    [onChangeIndex]
  );

  const closeViewer = useCallback(() => {
    onClose();
  }, [onClose]);

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
    pageCountSv.value = Math.max(urls.length, 1);
    widthSv.value = winW;
    heightSv.value = imageHeight;
  }, [urls.length, winW, imageHeight, pageCountSv, widthSv, heightSv]);

  useEffect(() => {
    if (!visible) {
      dismissY.value = 0;
      panAxis.value = 0;
      isPaging.value = 0;
      return;
    }
    pageIndexSv.value = safeIndex;
    pageOffset.value = -safeIndex * winW;
    dismissY.value = 0;
    panAxis.value = 0;
    isPaging.value = 0;
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [
    visible,
    winW,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
    pageOffset,
    dismissY,
    panAxis,
    pageIndexSv,
    isPaging,
  ]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          if (isPaging.value) return;
          const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
          scale.value = next;
          const clamped = clampZoomPan(translateX.value, translateY.value, next, widthSv.value, heightSv.value);
          translateX.value = clamped.x;
          translateY.value = clamped.y;
        })
        .onEnd(() => {
          if (isPaging.value) {
            scale.value = 1;
            savedScale.value = 1;
            return;
          }
          const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value));
          if (nextScale <= ZOOM_EPS) {
            translateX.value = withTiming(0);
            translateY.value = withTiming(0);
            savedTranslateX.value = 0;
            savedTranslateY.value = 0;
            scale.value = withTiming(1);
            savedScale.value = 1;
            return;
          }
          const clamped = clampZoomPan(translateX.value, translateY.value, nextScale, widthSv.value, heightSv.value);
          scale.value = withTiming(nextScale);
          savedScale.value = nextScale;
          translateX.value = withTiming(clamped.x);
          translateY.value = withTiming(clamped.y);
          savedTranslateX.value = clamped.x;
          savedTranslateY.value = clamped.y;
        }),
    [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY, isPaging, widthSv, heightSv]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .maxPointers(1)
        .onStart(() => {
          cancelAnimation(pageOffset);
          cancelAnimation(dismissY);
          dragOrigin.value = pageOffset.value;
          const zoomed = scale.value > ZOOM_EPS || savedScale.value > ZOOM_EPS;
          isPaging.value = zoomed ? 0 : 1;
          if (isPaging.value) {
            scale.value = 1;
            savedScale.value = 1;
            translateX.value = 0;
            translateY.value = 0;
          }
        })
        .onUpdate((e) => {
          const zoomed = scale.value > ZOOM_EPS || savedScale.value > ZOOM_EPS;
          if (zoomed) {
            isPaging.value = 0;
            const next = clampZoomPan(
              savedTranslateX.value + e.translationX,
              savedTranslateY.value + e.translationY,
              scale.value,
              widthSv.value,
              heightSv.value
            );
            translateX.value = next.x;
            translateY.value = next.y;
            return;
          }
          if (panAxis.value === 0) {
            const ax = Math.abs(e.translationX);
            const ay = Math.abs(e.translationY);
            if (ay > 10 && ay > ax * 1.15) panAxis.value = 2;
            else if (ax > 6) panAxis.value = 1;
          }
          if (panAxis.value === 2) {
            dismissY.value = Math.max(0, e.translationY);
            return;
          }
          const count = pageCountSv.value;
          if (count <= 1) return;
          const w = widthSv.value;
          const minOffset = -(count - 1) * w;
          let next = dragOrigin.value + e.translationX;
          if (next > 0) next *= 0.28;
          else if (next < minOffset) next = minOffset + (next - minOffset) * 0.28;
          pageOffset.value = next;
        })
        .onEnd((e) => {
          const zoomed = scale.value > ZOOM_EPS || savedScale.value > ZOOM_EPS;
          if (zoomed) {
            const next = clampZoomPan(
              translateX.value,
              translateY.value,
              scale.value,
              widthSv.value,
              heightSv.value
            );
            translateX.value = next.x;
            translateY.value = next.y;
            savedTranslateX.value = next.x;
            savedTranslateY.value = next.y;
            isPaging.value = 0;
            panAxis.value = 0;
            return;
          }
          panAxis.value = 0;
          isPaging.value = 0;
          const w = widthSv.value;
          const count = pageCountSv.value;
          const pulledDown = dismissY.value > 12 || e.translationY > 12;
          if (pulledDown && Math.abs(e.translationY) >= Math.abs(e.translationX)) {
            if (dismissY.value > 110 || e.velocityY > 900) {
              dismissY.value = withTiming(winH, DISMISS, (finished) => {
                if (finished) runOnJS(closeViewer)();
              });
            } else {
              dismissY.value = withTiming(0, SLIDE);
            }
            const idx = Math.max(0, Math.min(count - 1, Math.round(-pageOffset.value / Math.max(w, 1))));
            pageIndexSv.value = idx;
            pageOffset.value = withTiming(-idx * w, SLIDE, (finished) => {
              if (finished) runOnJS(goToIndex)(idx);
            });
            return;
          }
          dismissY.value = withTiming(0, SLIDE);
          if (count <= 1) {
            pageOffset.value = withTiming(0, SLIDE);
            return;
          }
          const velocityBias = Math.abs(e.velocityX) > 600 ? Math.sign(-e.velocityX) * 0.35 : 0;
          let target = Math.round(-pageOffset.value / Math.max(w, 1) + velocityBias);
          if (target < 0) target = 0;
          if (target > count - 1) target = count - 1;
          pageIndexSv.value = target;
          pageOffset.value = withTiming(-target * w, SLIDE, (finished) => {
            if (finished) runOnJS(goToIndex)(target);
          });
        })
        .onFinalize(() => {
          isPaging.value = 0;
          panAxis.value = 0;
        }),
    [
      scale,
      savedScale,
      translateX,
      translateY,
      savedTranslateX,
      savedTranslateY,
      pageOffset,
      dismissY,
      panAxis,
      pageIndexSv,
      pageCountSv,
      widthSv,
      heightSv,
      dragOrigin,
      isPaging,
      winH,
      goToIndex,
      closeViewer,
    ]
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDistance(16)
        .onEnd(() => {
          if (isPaging.value || panAxis.value !== 0) return;
          if (savedScale.value > ZOOM_EPS || scale.value > ZOOM_EPS) {
            resetZoom();
          } else {
            scale.value = withTiming(DOUBLE_TAP_SCALE);
            savedScale.value = DOUBLE_TAP_SCALE;
          }
        }),
    [resetZoom, scale, savedScale, isPaging, panAxis]
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(pinch, pan, doubleTap),
    [pinch, pan, doubleTap]
  );

  const slideStyle = useAnimatedStyle(() => {
    const shrink = interpolate(dismissY.value, [0, winH * 0.5], [1, 0.92], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: pageOffset.value },
        { translateY: dismissY.value },
        { scale: shrink },
      ] as const,
    };
  });

  const zoomStyle = useAnimatedStyle(() => {
    const zoomed = scale.value > ZOOM_EPS;
    return {
      transform: [
        { translateX: zoomed ? translateX.value : 0 },
        { translateY: zoomed ? translateY.value : 0 },
        { scale: zoomed ? scale.value : 1 },
      ] as const,
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, winH * 0.42], [1, 0.12], Extrapolation.CLAMP),
  }));

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.value, [0, 140], [1, 0], Extrapolation.CLAMP),
  }));

  const onShare = useCallback(async () => {
    if (!currentUrl.trim() || sharing) return;
    setSharing(true);
    try {
      await shareImage(currentUrl, normalizedUrlMap);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not share image';
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setSharing(false);
    }
  }, [currentUrl, sharing, normalizedUrlMap]);

  return (
    <Modal {...edgeToEdgeModalProps} visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.root}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
          <Animated.View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }, chromeStyle]}>
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
              {onDelete ? (
                <TouchableOpacity
                  onPress={() => onDelete(currentUrl)}
                  style={styles.iconBtn}
                  accessibilityLabel="Delete image"
                  disabled={deleting || !currentUrl.trim()}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                  )}
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => void onShare()}
                style={styles.iconBtn}
                accessibilityLabel="Share image"
                disabled={sharing || !currentUrl.trim()}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="share-outline" size={22} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={[{ width: winW, height: imageHeight }, styles.clip]}>
            <GestureDetector gesture={composed}>
              <Animated.View
                style={[
                  {
                    height: imageHeight,
                    width: Math.max(urls.length, 1) * winW,
                    flexDirection: 'row',
                  },
                  slideStyle,
                ]}
              >
                {urls.map((url, i) => (
                  <Animated.View
                    key={`${i}-${url}`}
                    style={[
                      styles.page,
                      { width: winW, height: imageHeight },
                      i === safeIndex ? zoomStyle : null,
                    ]}
                  >
                    {isImageFileUrl(url, names?.[i]) ? (
                      <ResolvableImage
                        storedUrl={url}
                        urlMap={normalizedUrlMap}
                        style={styles.image}
                        resizeMode="contain"
                      />
                    ) : (
                      <FileExtensionPreview
                        url={url}
                        fileName={names?.[i]}
                        variant="viewer"
                      />
                    )}
                  </Animated.View>
                ))}
              </Animated.View>
            </GestureDetector>
          </View>

          {showCounter && hasMany ? (
            <Animated.View style={[styles.counterWrap, { bottom: Math.max(insets.bottom, 16) + 24 }, chromeStyle]}>
              <Text style={styles.counter}>
                {safeIndex + 1} / {urls.length}
              </Text>
            </Animated.View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.93)',
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
  clip: {
    overflow: 'hidden',
  },
  page: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  counterWrap: {
    position: 'absolute',
  },
  counter: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
});
