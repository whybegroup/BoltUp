import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ImageUploadQuality = 'compressed' | 'original';

const STORAGE_KEY = '@moijia:imageUploadQuality:v1';
const DEFAULT_QUALITY: ImageUploadQuality = 'compressed';

/** Mirrors storage so pickers can read the choice without awaiting a disk hit mid-gesture. */
let cached: ImageUploadQuality | null = null;
const listeners = new Set<(q: ImageUploadQuality) => void>();

function parse(raw: string | null): ImageUploadQuality {
  return raw === 'original' || raw === 'compressed' ? raw : DEFAULT_QUALITY;
}

export function getImageUploadQualitySync(): ImageUploadQuality {
  return cached ?? DEFAULT_QUALITY;
}

export async function loadImageUploadQuality(): Promise<ImageUploadQuality> {
  if (cached) return cached;
  try {
    cached = parse(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    cached = DEFAULT_QUALITY;
  }
  return cached;
}

export async function saveImageUploadQuality(quality: ImageUploadQuality): Promise<void> {
  cached = quality;
  for (const fn of listeners) fn(quality);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, quality);
  } catch {
    // Preference stays in memory for this session.
  }
}

export function useImageUploadQuality(): [ImageUploadQuality, (q: ImageUploadQuality) => void] {
  const [quality, setQuality] = useState<ImageUploadQuality>(getImageUploadQualitySync);

  useEffect(() => {
    let active = true;
    void loadImageUploadQuality().then((q) => {
      if (active) setQuality(q);
    });
    listeners.add(setQuality);
    return () => {
      active = false;
      listeners.delete(setQuality);
    };
  }, []);

  return [quality, (q) => void saveImageUploadQuality(q)];
}

export const IMAGE_UPLOAD_QUALITY_LABELS: Record<ImageUploadQuality, string> = {
  compressed: 'Smaller file size',
  original: 'Original quality',
};
