import { memo, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  View,
  type ImageResizeMode,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { Colors } from '../constants/theme';
import { isDirectRenderableImageUrl, resolveImageViewUrls, toRenderableImageUrl } from '../services/resolveImageViewUrls';
import {
  ensureCachedImageFileUri,
  peekCachedImageFileUri,
} from '../services/imageDiskCache';

type Props = {
  storedUrl: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Batch map from useResolvedImageUrls; omit to resolve this URL alone. */
  urlMap?: Map<string, string>;
  onError?: () => void;
};

/** Avoid `source={{ uri }}` identity churn on parent re-renders (e.g. typing in a nearby TextInput), which can reload images. */
const StableUriImage = memo(function StableUriImage({
  uri,
  style,
  resizeMode,
  onError,
}: {
  uri: string;
  style: StyleProp<ImageStyle>;
  resizeMode: ImageResizeMode;
  onError?: () => void;
}) {
  const source = useMemo(
    () => ({
      uri,
      // Prefer HTTP cache when still using remote URLs (iOS).
      ...(Platform.OS === 'ios' && !uri.startsWith('file:')
        ? ({ cache: 'force-cache' } as const)
        : null),
    }),
    [uri]
  );
  return <Image source={source} style={style} resizeMode={resizeMode} onError={onError} />;
});

function useDisplayUri(
  storedUrl: string,
  remoteViewUrl: string | null
): string | null {
  const [displayUri, setDisplayUri] = useState<string | null>(() => {
    if (!storedUrl?.trim()) return null;
    if (isDirectRenderableImageUrl(storedUrl)) return toRenderableImageUrl(storedUrl);
    return peekCachedImageFileUri(storedUrl);
  });

  useEffect(() => {
    let cancelled = false;
    const source = storedUrl?.trim();
    if (!source) {
      setDisplayUri(null);
      return;
    }
    if (isDirectRenderableImageUrl(source)) {
      setDisplayUri(toRenderableImageUrl(source));
      return;
    }

    const peek = peekCachedImageFileUri(source);
    if (peek) {
      setDisplayUri(peek);
      return;
    }

    if (!remoteViewUrl?.trim()) {
      setDisplayUri(null);
      return;
    }

    // Show remote immediately, then swap to disk cache when ready.
    setDisplayUri(toRenderableImageUrl(remoteViewUrl));
    void ensureCachedImageFileUri(source, remoteViewUrl).then((fileUri) => {
      if (!cancelled && fileUri) setDisplayUri(fileUri);
    });

    return () => {
      cancelled = true;
    };
  }, [storedUrl, remoteViewUrl]);

  return displayUri;
}

export function ResolvableImage({ storedUrl, style, resizeMode = 'cover', urlMap, onError }: Props) {
  const [singleRemote, setSingleRemote] = useState<string | null>(() =>
    storedUrl?.trim() && isDirectRenderableImageUrl(storedUrl)
      ? toRenderableImageUrl(storedUrl)
      : null
  );

  useEffect(() => {
    if (urlMap) return;
    if (!storedUrl?.trim()) {
      setSingleRemote(null);
      return;
    }
    if (isDirectRenderableImageUrl(storedUrl)) {
      setSingleRemote(toRenderableImageUrl(storedUrl));
      return;
    }
    let cancelled = false;
    resolveImageViewUrls([storedUrl]).then((m) => {
      if (!cancelled) setSingleRemote(m.get(storedUrl) ?? storedUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [storedUrl, urlMap]);

  const remoteFromMap =
    urlMap && storedUrl?.trim()
      ? urlMap.has(storedUrl)
        ? (urlMap.get(storedUrl) as string)
        : undefined
      : undefined;
  const remoteViewUrl = urlMap ? (remoteFromMap ?? null) : singleRemote;
  const displayUri = useDisplayUri(storedUrl, remoteViewUrl);

  if (!storedUrl?.trim()) {
    return null;
  }

  if (urlMap && remoteFromMap === undefined) {
    return (
      <View style={[style, styles.ph]}>
        <ActivityIndicator size="small" color={Colors.textMuted} />
      </View>
    );
  }

  if (urlMap && remoteFromMap !== undefined && !remoteFromMap.trim()) {
    return null;
  }

  if (!displayUri?.trim()) {
    return (
      <View style={[style, styles.ph]}>
        <ActivityIndicator size="small" color={Colors.textMuted} />
      </View>
    );
  }

  return (
    <StableUriImage uri={displayUri} style={style} resizeMode={resizeMode} onError={onError} />
  );
}

const styles = StyleSheet.create({
  ph: { backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
});
