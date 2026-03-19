import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { generateBotttsSvg, generateIconsSvg } from '../utils/avatar';

interface AvatarProps {
  seed: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function BotttsAvatar({ seed, size = 256, style }: AvatarProps) {
  const svg = React.useMemo(() => generateBotttsSvg(seed, size), [seed, size]);
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      <SvgXml xml={svg} width={size} height={size} />
    </View>
  );
}

export function IconsAvatar({ seed, size = 256, style }: AvatarProps) {
  const svg = React.useMemo(() => generateIconsSvg(seed, size), [seed, size]);
  return (
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]}>
      <SvgXml xml={svg} width={size} height={size} />
    </View>
  );
}
