import { createAvatar } from '@dicebear/core';
import { bottts, icons } from '@dicebear/collection';

const DEFAULT_SIZE = 256;

/** DiceBear icons style supports explicit icon selection. These can be used as seed. */
export const ICON_OPTIONS = [
  'heart', 'star', 'camera', 'gift', 'lightbulb', 'cup', 'book', 'flag',
  'trophy', 'palette', 'globe', 'house', 'key', 'sun', 'moon', 'flower1',
  'gem', 'envelope', 'phone', 'brush', 'cloud', 'lightning', 'puzzle',
  'handThumbsUp', 'emojiSmile', 'search', 'map', 'compass', 'award',
] as const;

export type IconOption = (typeof ICON_OPTIONS)[number];

export function isIconOption(seed: string): seed is IconOption {
  return (ICON_OPTIONS as readonly string[]).includes(seed);
}

/**
 * Generate bottts avatar SVG string (offline, no API calls).
 */
export function generateBotttsSvg(seed: string, size = DEFAULT_SIZE): string {
  const avatar = createAvatar(bottts, {
    seed,
    size,
    backgroundType: ['solid'],
  });
  return avatar.toString();
}

/**
 * Generate icons avatar SVG string (offline, no API calls).
 * When seed is a known icon name (ICON_OPTIONS), uses that specific icon.
 */
export function generateIconsSvg(seed: string, size = DEFAULT_SIZE): string {
  const avatar = createAvatar(icons, {
    seed,
    size,
    backgroundType: ['solid'],
    ...(isIconOption(seed) && { icon: [seed] }),
  } as Parameters<typeof createAvatar>[1]);
  return avatar.toString();
}
