import React, { useState, useEffect } from 'react';
import { Image, View, StyleProp, ViewStyle } from 'react-native';
import { IconsAvatar } from './Avatar';
import { groupAvatarBorderRadius } from '../utils/helpers';

const DEFAULT_AVATAR_SEED = 'auto';

interface GroupAvatarProps {
  /** Seed for generated avatar (DiceBear icons). Fallback: group.avatarSeed ?? group.name ?? DEFAULT_AVATAR_SEED */
  seed?: string;
  thumbnail?: string | null;
  /** When provided, uses group.avatarSeed/name for seed and group.thumbnail - overrides seed/thumbnail */
  group?: { avatarSeed?: string | null; thumbnail?: string | null; name?: string } | null;
  size?: number;
  /** Override border radius (default: size / 3). Use to match container for no gap. */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

function isUrl(s: string): boolean {
  return s.startsWith('data:') || s.includes('://');
}

/** Renders group avatar: Image if thumbnail is valid URL and loads, IconsAvatar (seed) otherwise. */
export function GroupAvatar({ seed, thumbnail, group, size = 36, borderRadius, style }: GroupAvatarProps) {
  const [loadError, setLoadError] = useState(false);
  const resolvedThumbnail = group?.thumbnail ?? thumbnail;
  useEffect(() => { setLoadError(false); }, [resolvedThumbnail]);
  const resolvedSeed = (group?.avatarSeed ?? group?.name ?? seed ?? DEFAULT_AVATAR_SEED).trim() || DEFAULT_AVATAR_SEED;
  const radius = borderRadius ?? groupAvatarBorderRadius(size);
  const containerStyle: StyleProp<ViewStyle> = [
    { width: size, height: size, borderRadius: radius, overflow: 'hidden' },
    style,
  ];

  const useImage = resolvedThumbnail && isUrl(resolvedThumbnail) && !loadError;
  if (useImage) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: resolvedThumbnail!.trim() }}
          style={{ width: size, height: size, borderRadius: radius }}
          onError={() => setLoadError(true)}
        />
      </View>
    );
  }
  return <IconsAvatar seed={resolvedSeed} size={size} style={containerStyle} />;
}
