import { Alert, Image, Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { StorageService } from '@moijia/client';
import {
  loadImageUploadQuality,
  type ImageUploadQuality,
} from '../utils/imageUploadQualityPrefs';

function isCancelled(e: unknown): boolean {
  return e instanceof Error && e.message === 'cancelled';
}

export type { ImageUploadQuality };

export type PickedImageAsset = {
  uri: string;
  contentType: string;
  fileName?: string;
  width?: number;
  height?: number;
};

export type PickedFileAsset = {
  uri: string;
  contentType: string;
  fileName: string;
};

const COMPATIBLE_IMAGE_TYPES = /^(image\/jpeg|image\/jpg|image\/png|image\/gif)$/i;
const PNG_TYPE = /^image\/png$/i;
const GIF_TYPE = /^image\/gif$/i;
const COMPRESSED_MAX_EDGE = 1920;
const COMPRESSED_JPEG_QUALITY = 0.72;
const LIBRARY_SELECTION_LIMIT = 20;

function inferContentType(
  mimeType: string | null | undefined,
  fileName?: string | null,
  uri?: string
): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  const hint = `${fileName || ''} ${uri || ''}`.toLowerCase();
  if (hint.includes('.png')) return 'image/png';
  if (hint.includes('.gif')) return 'image/gif';
  if (hint.includes('.webp')) return 'image/webp';
  if (hint.includes('.heic') || hint.includes('.heif')) return 'image/heic';
  if (hint.includes('.avif')) return 'image/avif';
  return 'image/jpeg';
}

function replaceExt(fileName: string | undefined, ext: string): string {
  const raw = (fileName || `photo-${Date.now()}`).trim() || `photo-${Date.now()}`;
  const base = raw.replace(/\.[^.]+$/, '');
  return `${base}.${ext}`;
}

function needsReencode(contentType: string, quality: ImageUploadQuality): boolean {
  if (GIF_TYPE.test(contentType)) return false;
  if (quality === 'compressed') return true;
  return !COMPATIBLE_IMAGE_TYPES.test(contentType);
}

async function getImageSize(
  uri: string,
  width?: number,
  height?: number
): Promise<{ width: number; height: number } | null> {
  if (width && height) return { width, height };
  try {
    return await new Promise((resolve, reject) => {
      Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
    });
  } catch {
    return null;
  }
}

function resizeActions(
  size: { width: number; height: number } | null,
  quality: ImageUploadQuality
): Array<{ resize: { width: number } | { height: number } }> {
  if (quality !== 'compressed' || !size) return [];
  const edge = Math.max(size.width, size.height);
  if (edge <= COMPRESSED_MAX_EDGE) return [];
  return size.width >= size.height
    ? [{ resize: { width: COMPRESSED_MAX_EDGE } }]
    : [{ resize: { height: COMPRESSED_MAX_EDGE } }];
}

function saveOptionsFor(
  contentType: string,
  quality: ImageUploadQuality
): { format: SaveFormat; compress: number; contentType: string; ext: string } {
  if (quality === 'original' && PNG_TYPE.test(contentType)) {
    return { format: SaveFormat.PNG, compress: 1, contentType: 'image/png', ext: 'png' };
  }
  return {
    format: SaveFormat.JPEG,
    compress: quality === 'compressed' ? COMPRESSED_JPEG_QUALITY : 1,
    contentType: 'image/jpeg',
    ext: 'jpg',
  };
}

export async function convertPickedImage(
  asset: PickedImageAsset,
  quality: ImageUploadQuality
): Promise<PickedImageAsset> {
  const contentType = inferContentType(asset.contentType, asset.fileName, asset.uri);
  if (!needsReencode(contentType, quality)) {
    return { ...asset, contentType };
  }
  const size = await getImageSize(asset.uri, asset.width, asset.height);
  const save = saveOptionsFor(contentType, quality);
  try {
    const result = await manipulateAsync(asset.uri, resizeActions(size, quality), {
      compress: save.compress,
      format: save.format,
    });
    return {
      uri: result.uri,
      contentType: save.contentType,
      fileName: replaceExt(asset.fileName, save.ext),
      width: result.width,
      height: result.height,
    };
  } catch {
    if (COMPATIBLE_IMAGE_TYPES.test(contentType) && quality === 'original') {
      return { ...asset, contentType };
    }
    throw new Error('Could not convert this image. Try a JPEG or PNG.');
  }
}

export async function convertWebImageFile(file: File, quality: ImageUploadQuality): Promise<File> {
  const contentType = inferContentType(file.type, file.name);
  if (!needsReencode(contentType, quality)) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const converted = await convertPickedImage(
      { uri: objectUrl, contentType, fileName: file.name },
      quality
    );
    const blob = await (await fetch(converted.uri)).blob();
    const ext = converted.contentType === 'image/png' ? 'png' : 'jpg';
    return new File([blob], converted.fileName || replaceExt(file.name, ext), {
      type: converted.contentType,
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Converts each image to JPEG/PNG at the user's saved quality. Throws `cancelled` if none are images. */
export async function prepareWebImageFiles(files: Iterable<File>): Promise<File[]> {
  const images = [...files].filter(
    (f) => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(f.name)
  );
  if (!images.length) {
    Alert.alert('Upload', 'Please choose an image file.');
    throw new Error('cancelled');
  }
  const quality = await loadImageUploadQuality();
  const out: File[] = [];
  for (const file of images) {
    out.push(await convertWebImageFile(file, quality));
  }
  return out;
}

function pickerAssetToPicked(asset: ImagePicker.ImagePickerAsset): PickedImageAsset {
  return {
    uri: asset.uri,
    contentType: inferContentType(asset.mimeType, asset.fileName, asset.uri),
    fileName: asset.fileName ?? undefined,
    width: asset.width,
    height: asset.height,
  };
}

async function convertPickedImages(
  assets: PickedImageAsset[],
  quality: ImageUploadQuality
): Promise<PickedImageAsset[]> {
  const out: PickedImageAsset[] = [];
  for (const asset of assets) {
    out.push(await convertPickedImage(asset, quality));
  }
  return out;
}

/** Opens the image library; throws `cancelled` if the user backs out. Single image, always original (avatars). */
export async function pickImageFromLibrary(): Promise<PickedImageAsset> {
  const assets = await pickImagesFromLibrary({ multiple: false, useQualityPreference: false });
  return assets[0];
}

/** Opens the image library. Multiple selection and the saved quality preference by default. */
export async function pickImagesFromLibrary(opts?: {
  multiple?: boolean;
  useQualityPreference?: boolean;
}): Promise<PickedImageAsset[]> {
  const multiple = opts?.multiple ?? true;
  const usePreference = opts?.useQualityPreference ?? true;
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('Photo library access is required to upload images.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? LIBRARY_SELECTION_LIMIT : 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });

  if (result.canceled || !result.assets?.length) {
    throw new Error('cancelled');
  }

  const picked = result.assets.map(pickerAssetToPicked);
  const quality = usePreference ? await loadImageUploadQuality() : 'original';
  return convertPickedImages(picked, quality);
}

/** Opens the camera; throws `cancelled` if the user backs out. */
export async function pickImageFromCamera(): Promise<PickedImageAsset> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('Camera access is required to take photos.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled || !result.assets?.length) {
    throw new Error('cancelled');
  }
  return pickerAssetToPicked(result.assets[0]);
}

async function pickCameraImageForUpload(): Promise<PickedImageAsset> {
  const asset = await pickImageFromCamera();
  const quality = await loadImageUploadQuality();
  return convertPickedImage(asset, quality);
}

/** Opens the document picker; throws `cancelled` if the user backs out. */
export async function pickFileFromDevice(): Promise<PickedFileAsset> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: '*/*',
  });
  if (result.canceled || !result.assets?.length) {
    throw new Error('cancelled');
  }
  const asset = result.assets[0];
  const fileName = asset.name?.trim() || `file-${Date.now()}`;
  return {
    uri: asset.uri,
    contentType: asset.mimeType || 'application/octet-stream',
    fileName,
  };
}

/**
 * Presign + PUT to the API (local `api/data` storage; set API_PUBLIC_URL if clients use another host).
 */
export async function uploadPickedImageAsset(userId: string, asset: PickedImageAsset): Promise<string> {
  if (!userId) throw new Error('You must be signed in to upload photos.');
  const ready = await convertPickedImage(asset, 'original');

  const presign = await StorageService.presignUpload({
    userId,
    contentType: ready.contentType,
    filename: ready.fileName,
  });

  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    body = await (await fetch(ready.uri)).blob();
  } else {
    const file = new ExpoFile(ready.uri);
    body = await file.arrayBuffer();
  }

  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': ready.contentType },
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}). Check S3 CORS and credentials.`);
  }

  return presign.publicUrl;
}

export async function uploadPickedFileAsset(userId: string, asset: PickedFileAsset): Promise<string> {
  if (!userId) throw new Error('You must be signed in to upload files.');

  const presign = await StorageService.presignUpload({
    userId,
    contentType: asset.contentType,
    filename: asset.fileName,
  });

  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    body = await (await fetch(asset.uri)).blob();
  } else {
    const file = new ExpoFile(asset.uri);
    body = await file.arrayBuffer();
  }

  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': asset.contentType },
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}). Check upload settings.`);
  }

  return presign.publicUrl;
}

/** Picks any file from the device and uploads it. Throws `cancelled` when picker closes. */
export async function pickAndUploadFileFromDevice(
  userId: string
): Promise<{ publicUrl: string; fileName: string }> {
  const asset = await pickFileFromDevice();
  const publicUrl = await uploadPickedFileAsset(userId, asset);
  return { publicUrl, fileName: asset.fileName };
}

/** Converts a managed `/storage/files/...` URL to forced-download endpoint. */
export function uploadUrlToDownloadUrl(sourceUrl: string): string {
  const trimmed = sourceUrl?.trim();
  if (!trimmed) return sourceUrl;
  try {
    const u = new URL(trimmed);
    const prefix = '/storage/files/';
    if (!u.pathname.startsWith(prefix)) return sourceUrl;
    const rest = u.pathname.slice(prefix.length);
    return `${u.origin}/storage/download/${rest}`;
  } catch {
    return sourceUrl;
  }
}

/** Picks from library then presigns + PUT. Throws `cancelled` if the user backs out of the picker. */
export async function pickAndUploadImageFromLibrary(userId: string): Promise<string> {
  const assets = await pickImagesFromLibrary({ multiple: false, useQualityPreference: true });
  return uploadPickedImageAsset(userId, assets[0]);
}

export async function pickAndUploadImagesFromLibrary(userId: string): Promise<string[]> {
  const assets = await pickImagesFromLibrary({ multiple: true, useQualityPreference: true });
  const urls: string[] = [];
  for (const asset of assets) {
    urls.push(await uploadPickedImageAsset(userId, asset));
  }
  return urls;
}

export async function pickAndUploadImageFromCamera(userId: string): Promise<string> {
  const asset = await pickCameraImageForUpload();
  return uploadPickedImageAsset(userId, asset);
}

/**
 * Opens the image picker immediately (no intermediate dialog). Returns public URLs, or undefined if cancelled / not signed in.
 */
export async function pickAndUploadCoverPhoto(userId: string): Promise<string[] | undefined> {
  if (!userId.trim()) {
    Alert.alert('Upload', 'You must be signed in to upload photos.');
    return undefined;
  }
  try {
    return await pickAndUploadImagesFromLibrary(userId);
  } catch (e) {
    if (isCancelled(e)) return undefined;
    Alert.alert('Upload', e instanceof Error ? e.message : 'Upload failed');
    return undefined;
  }
}

export async function takeAndUploadCoverPhoto(userId: string): Promise<string | undefined> {
  if (!userId.trim()) {
    Alert.alert('Upload', 'You must be signed in to upload photos.');
    return undefined;
  }
  try {
    return await pickAndUploadImageFromCamera(userId);
  } catch (e) {
    if (isCancelled(e)) return undefined;
    Alert.alert('Upload', e instanceof Error ? e.message : 'Upload failed');
    return undefined;
  }
}

/** Pending local file chosen in avatar UI; upload on Save / Create. */
export type PendingAvatarFile =
  | { kind: 'native'; asset: PickedImageAsset }
  | { kind: 'web'; file: File; objectUrl: string };

/** Cover photo row: already on server, or local pick to upload on Create/Save (same as avatar defer flow). */
export type CoverPhotoDraft =
  | { kind: 'remote'; url: string }
  | { kind: 'pending'; previewUri: string; pending: PendingAvatarFile };

export async function uploadPendingAvatarFile(userId: string, pending: PendingAvatarFile): Promise<string> {
  if (pending.kind === 'web') {
    return uploadWebImageFile(userId, pending.file);
  }
  return uploadPickedImageAsset(userId, pending.asset);
}

export function revokeCoverPhotoDraftPreview(d: CoverPhotoDraft) {
  if (d.kind === 'pending' && d.pending.kind === 'web') {
    URL.revokeObjectURL(d.pending.objectUrl);
  }
}

/** Upload any pending drafts in order; revokes web object URLs after successful upload. */
export async function uploadCoverPhotoDrafts(userId: string, drafts: CoverPhotoDraft[]): Promise<string[]> {
  const out: string[] = [];
  for (const d of drafts) {
    if (d.kind === 'remote') {
      out.push(d.url);
    } else {
      const url = await uploadPendingAvatarFile(userId, d.pending);
      if (d.pending.kind === 'web') {
        URL.revokeObjectURL(d.pending.objectUrl);
      }
      out.push(url);
    }
  }
  return out;
}

function pendingFromPicked(asset: PickedImageAsset): { previewUri: string; pending: PendingAvatarFile } {
  return { previewUri: asset.uri, pending: { kind: 'native', asset } };
}

/** Native image library pick — no network (use with web file input + {@link createWebDeferredCoverPhoto} on web). */
export async function pickDeferredCoverPhotoNative(): Promise<Array<{
  previewUri: string;
  pending: PendingAvatarFile;
}> | null> {
  try {
    const assets = await pickImagesFromLibrary({ multiple: true, useQualityPreference: true });
    return assets.map(pendingFromPicked);
  } catch (e) {
    if (isCancelled(e)) return null;
    Alert.alert('Photo', e instanceof Error ? e.message : 'Could not pick image');
    return null;
  }
}

export async function pickDeferredCoverPhotoFromCamera(): Promise<{
  previewUri: string;
  pending: PendingAvatarFile;
} | null> {
  try {
    const asset = await pickCameraImageForUpload();
    return pendingFromPicked(asset);
  } catch (e) {
    if (isCancelled(e)) return null;
    Alert.alert('Photo', e instanceof Error ? e.message : 'Could not take photo');
    return null;
  }
}

export function createWebDeferredCoverPhoto(file: File): { previewUri: string; pending: PendingAvatarFile } {
  const objectUrl = URL.createObjectURL(file);
  return { previewUri: objectUrl, pending: { kind: 'web', file, objectUrl } };
}

export function coverPhotoDraftDisplayUri(d: CoverPhotoDraft): string {
  return d.kind === 'remote' ? d.url : d.previewUri;
}

export async function uploadWebImageFile(userId: string, file: File): Promise<string> {
  if (!userId) throw new Error('You must be signed in to upload photos.');
  const ready = await convertWebImageFile(file, 'original');
  const contentType = ready.type?.startsWith('image/') ? ready.type : 'image/jpeg';
  const presign = await StorageService.presignUpload({
    userId,
    contentType,
    filename: ready.name,
  });
  const put = await fetch(presign.uploadUrl, {
    method: 'PUT',
    body: ready,
    headers: { 'Content-Type': contentType },
  });
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}). Check S3 CORS and credentials.`);
  }
  return presign.publicUrl;
}

export { isCancelled };
