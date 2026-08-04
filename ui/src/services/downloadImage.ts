import { Linking, Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { ensureCachedImageFileUri, peekCachedImageFileUri } from './imageDiskCache';
import { isDirectRenderableImageUrl, resolveImageViewUrls } from './resolveImageViewUrls';

function extensionFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.(jpe?g|png|gif|webp|heic|bmp)$/i);
    if (m) return m[1].toLowerCase().replace('jpeg', 'jpg');
  } catch {
    /* ignore */
  }
  return 'jpg';
}

function fileNameFromUrl(url: string): string {
  const ext = extensionFromUrl(url);
  return `moijia-${Date.now()}.${ext}`;
}

async function resolveDownloadUri(
  storedUrl: string,
  urlMap?: Map<string, string> | Record<string, string>
): Promise<string> {
  const trimmed = storedUrl.trim();
  if (!trimmed) throw new Error('No image to download');
  if (isDirectRenderableImageUrl(trimmed)) return trimmed;

  const diskHit = peekCachedImageFileUri(trimmed);
  if (diskHit) return diskHit;

  let viewUrl: string | null = null;
  if (urlMap instanceof Map) {
    const mapped = urlMap.get(trimmed);
    if (mapped?.trim()) viewUrl = mapped.trim();
  } else if (urlMap && typeof urlMap === 'object') {
    const mapped = urlMap[trimmed];
    if (mapped?.trim()) viewUrl = mapped.trim();
  }
  if (!viewUrl) {
    const resolved = await resolveImageViewUrls([trimmed]);
    viewUrl = (resolved.get(trimmed) ?? trimmed).trim();
  }

  const cached = await ensureCachedImageFileUri(trimmed, viewUrl);
  return cached ?? viewUrl;
}

async function downloadOnWeb(uri: string): Promise<void> {
  const name = fileNameFromUrl(uri);
  try {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(uri, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Download (web) or save/share (native).
 * Uses React Native `Share` so no ExpoSharing native module is required.
 */
export async function downloadOrShareImage(
  storedUrl: string,
  urlMap?: Map<string, string> | Record<string, string>
): Promise<void> {
  const uri = await resolveDownloadUri(storedUrl, urlMap);
  if (!uri) throw new Error('No image to download');

  if (Platform.OS === 'web') {
    await downloadOnWeb(uri);
    return;
  }

  let localUri = uri;
  if (!/^file:\/\//i.test(uri)) {
    const name = fileNameFromUrl(uri);
    const destination = new File(Paths.cache, name);
    const file = await File.downloadFileAsync(uri, destination, { idempotent: true });
    localUri = file.uri;
  }

  try {
    if (Platform.OS === 'ios') {
      await Share.share({ url: localUri });
    } else {
      await Share.share({
        message: localUri,
        title: 'Save image',
        url: localUri,
      });
    }
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'message' in e) {
      const msg = String((e as { message?: string }).message ?? '');
      if (/cancel|dismiss/i.test(msg)) return;
    }
    const canOpen = await Linking.canOpenURL(uri);
    if (canOpen) {
      await Linking.openURL(uri);
      return;
    }
    throw e instanceof Error ? e : new Error('Could not share image');
  }
}
