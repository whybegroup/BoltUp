import { createElement, useCallback, useEffect, useState } from 'react';
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
import PdfFirstPagePreview from './PdfFirstPagePreview';

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

export function FileViewerPdf({ uri, fileName }: { uri: string; fileName?: string }) {
  const nativeDocPreview = Platform.OS === 'ios';
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPdfData(null);
    setPreviewFailed(false);
    setOpened(false);
    if (nativeDocPreview) return;
    void (async () => {
      try {
        const res = await fetch(uri);
        if (!res.ok) throw new Error('fetch failed');
        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_PREVIEW_BYTES) throw new Error('too large');
        const b64 = arrayBufferToBase64(buf);
        if (!cancelled) setPdfData(b64);
      } catch {
        if (!cancelled) setPreviewFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri, nativeDocPreview]);

  const onPreviewFailed = useCallback(async () => {
    setPreviewFailed(true);
  }, []);

  const openPdf = useCallback(() => {
    if (Platform.OS === 'web') {
      setOpened(true);
      return;
    }
    void WebBrowser.openBrowserAsync(uri);
  }, [uri]);

  const onPreviewLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  if (opened && Platform.OS === 'web') {
    return (
      <View style={styles.full}>
        {createElement('iframe', {
          src: uri,
          title: fileName || 'PDF',
          style: {
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#fff',
            borderRadius: 8,
          },
        })}
        <TouchableOpacity
          onPress={() => setOpened(false)}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to preview"
        >
          <Text style={styles.openBtnText}>Back to preview</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canMountDom = box.w > 1 && box.h > 1;
  const domStyle = { width: box.w, height: box.h, backgroundColor: '#fff', borderRadius: 8 };

  return (
    <View style={styles.wrap}>
      <View style={styles.preview} onLayout={onPreviewLayout}>
        {previewFailed ? (
          <FileExtensionPreview url={uri} fileName={fileName} variant="viewer" />
        ) : nativeDocPreview ? (
          canMountDom ? (
            <PdfFirstPagePreview
              mode="document"
              uri={uri}
              dom={{ scrollEnabled: true, style: domStyle }}
            />
          ) : (
            <ActivityIndicator color="#fff" />
          )
        ) : pdfData && canMountDom ? (
          <PdfFirstPagePreview
            mode="page"
            data={pdfData}
            onFailed={onPreviewFailed}
            dom={{ scrollEnabled: false, style: domStyle }}
          />
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>
      <TouchableOpacity
        onPress={openPdf}
        style={styles.openBtn}
        accessibilityRole="button"
        accessibilityLabel="Open PDF"
      >
        <Text style={styles.openBtnText}>Open PDF</Text>
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
  full: {
    flex: 1,
    width: '100%',
    height: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
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
  backBtn: {
    alignSelf: 'center',
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
