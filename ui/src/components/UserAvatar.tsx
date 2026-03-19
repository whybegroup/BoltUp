import React, { useState, useEffect } from 'react';
import { Image, View, Text, StyleProp, ViewStyle } from 'react-native';
import { BotttsAvatar } from './Avatar';
import { avatarColor } from '../utils/helpers';
import { Colors, Fonts } from '../constants/theme';

const DEFAULT_AVATAR_SEED = 'auto';

interface UserAvatarProps {
  /** Seed for generated avatar (DiceBear bottts). Fallback: user.avatarSeed ?? user.name ?? DEFAULT_AVATAR_SEED */
  seed?: string;
  thumbnail?: string | null;
  /** When provided, uses user.avatarSeed/name for seed and user.thumbnail - overrides seed/thumbnail */
  user?: { avatarSeed?: string | null; thumbnail?: string | null; name?: string; displayName?: string } | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

function isUrl(s: string): boolean {
  return s.startsWith('data:') || s.includes('://');
}

/** Renders user avatar: Image if thumbnail is valid URL and loads, BotttsAvatar (seed) otherwise. */
export function UserAvatar({ seed, thumbnail, user, size = 36, style }: UserAvatarProps) {
  const [loadError, setLoadError] = useState(false);
  const resolvedThumbnail = user?.thumbnail ?? thumbnail;
  useEffect(() => { setLoadError(false); }, [resolvedThumbnail]);
  const resolvedSeed = (user?.avatarSeed ?? user?.name ?? seed ?? DEFAULT_AVATAR_SEED).trim() || DEFAULT_AVATAR_SEED;
  const radius = size / 2;
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
  // When seed is 'auto' or user has no custom avatar (avatarSeed), use Google-style name initial
  const hasCustomAvatar = !!user?.avatarSeed;
  const useLetterAvatar = resolvedSeed === DEFAULT_AVATAR_SEED || (user && !hasCustomAvatar);
  if (useLetterAvatar) {
    const name = (user?.displayName ?? user?.name ?? '').trim() || '?';
    const letter = name[0]?.toUpperCase() || '?';
    return (
      <View style={[containerStyle, { backgroundColor: avatarColor(name), alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#fff', fontSize: size * 0.38, fontFamily: Fonts.bold }}>{letter}</Text>
      </View>
    );
  }
  return <BotttsAvatar key={`bottts-${resolvedSeed}-${size}`} seed={resolvedSeed} size={size} style={[containerStyle, { borderWidth: 1, borderColor: Colors.border }]} />;
}
