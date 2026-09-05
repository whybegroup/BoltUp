import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Fonts, Radius } from '../constants/theme';
import { FileExtensionPreview } from './FileExtensionPreview';
import HtmlPreview from './HtmlPreview';

const MAX_HTML_BYTES = 2 * 1024 * 1024;

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function withBaseHref(html: string, uri: string): string {
  if (/<base[\s>]/i.test(html)) return html;
  let href = uri;
  try {
    href = new URL('.', uri).href;
  } catch {
    /* keep uri */
  }
  const tag = `<base href="${escapeAttr(href)}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${tag}`);
  }
  return `<head>${tag}</head>${html}`;
}

export function FileViewerHtml({ uri, fileName }: { uri: string; fileName?: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setFailed(false);
    void (async () => {
      try {
        const res = await fetch(uri);
        if (!res.ok) throw new Error('fetch failed');
        const text = await res.text();
        if (text.length > MAX_HTML_BYTES) throw new Error('too large');
        if (!cancelled) setHtml(withBaseHref(text, uri));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const openHtml = useCallback(() => {
    if (Platform.OS === 'web') {
      window.open(uri, '_blank', 'noopener,noreferrer');
      return;
    }
    void WebBrowser.openBrowserAsync(uri);
  }, [uri]);

  const canMountDom = box.w > 1 && box.h > 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.preview} onLayout={onPreviewLayout}>
        {failed ? (
          <FileExtensionPreview url={uri} fileName={fileName} variant="viewer" />
        ) : html && canMountDom ? (
          <HtmlPreview
            html={html}
            dom={{
              scrollEnabled: true,
              style: { width: box.w, height: box.h, backgroundColor: '#fff', borderRadius: 8 },
            }}
          />
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>
      <TouchableOpacity
        onPress={openHtml}
        style={styles.openBtn}
        accessibilityRole="button"
        accessibilityLabel="Open HTML"
      >
        <Text style={styles.openBtnText}>Open</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 14,
  },
  preview: {
    flex: 1,
    width: '100%',
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: Radius.lg,
  },
  openBtn: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.lg,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  openBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
});
