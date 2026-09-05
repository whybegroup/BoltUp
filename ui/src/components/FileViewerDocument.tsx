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
import { extensionFromFileNameOrUrl } from '../utils/fileKind';
import { FileExtensionPreview } from './FileExtensionPreview';
import DocumentPreview from './DocumentPreview';

const MAX_PREVIEW_BYTES = 12 * 1024 * 1024;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  if (typeof btoa === 'function') return btoa(binary);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i);
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += i + 1 < binary.length ? chars[(triple >> 6) & 63] : '=';
    out += i + 2 < binary.length ? chars[triple & 63] : '=';
  }
  return out;
}

export function FileViewerDocument({ uri, fileName }: { uri: string; fileName?: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [data, setData] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const ext = extensionFromFileNameOrUrl(fileName?.trim() || uri);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    void (async () => {
      try {
        const res = await fetch(uri);
        if (!res.ok) throw new Error('fetch failed');
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_PREVIEW_BYTES) throw new Error('too large');
        const b64 = arrayBufferToBase64(buf);
        if (!cancelled) setData(b64);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const onPreviewFailed = useCallback(async () => {
    setFailed(true);
  }, []);

  const openFile = useCallback(() => {
    if (Platform.OS === 'web') {
      window.open(uri, '_blank', 'noopener,noreferrer');
      return;
    }
    void WebBrowser.openBrowserAsync(uri);
  }, [uri]);

  const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  const canMountDom = box.w > 1 && box.h > 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.preview} onLayout={onPreviewLayout}>
        {failed ? (
          <FileExtensionPreview url={uri} fileName={fileName} variant="viewer" />
        ) : data && canMountDom ? (
          <DocumentPreview
            data={data}
            ext={ext}
            onFailed={onPreviewFailed}
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
        onPress={openFile}
        style={styles.openBtn}
        accessibilityRole="button"
        accessibilityLabel="Open file"
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
