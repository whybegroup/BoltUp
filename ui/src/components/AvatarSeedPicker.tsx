import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Fonts, Radius } from '../constants/theme';
import { GroupAvatar } from './GroupAvatar';
import { UserAvatar } from './UserAvatar';
import { getGroupColor, getDefaultGroupThemeFromName, groupAvatarBorderRadius, avatarColor } from '../utils/helpers';
import { IconsAvatar, BotttsAvatar } from './Avatar';
import { ICON_OPTIONS, BOTTT_PRESETS } from '../utils/avatar';

type AvatarVariant = 'group' | 'user';

interface AvatarSeedPickerProps {
  variant?: AvatarVariant;
  defaultSeed: string;
  value: string;
  onChangeText: (text: string) => void;
  /** When provided, shows URL input. Avatar uses thumbnail if valid URL, otherwise seed. */
  thumbnail?: string | null;
  onThumbnailChange?: (text: string | null) => void;
  /** For user variant: when provided, shows "Use initial" option to clear to letter avatar. */
  userName?: string;
  disabled?: boolean;
  loading?: boolean;
  inputStyle?: object;
  buttonStyle?: object;
  buttonTextStyle?: object;
}

export function AvatarSeedPicker({
  variant = 'group',
  defaultSeed,
  value,
  onChangeText,
  thumbnail,
  onThumbnailChange,
  userName,
  inputStyle,
}: AvatarSeedPickerProps) {
  const baseInputStyle = [{ padding: 10, paddingHorizontal: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular, flex: 1 }, inputStyle];
  const effectiveSeed = value.trim() || defaultSeed;
  const isUser = variant === 'user';

  const presetOptions = isUser ? BOTTT_PRESETS : ICON_OPTIONS;
  const previewRadius = isUser ? 28 : groupAvatarBorderRadius(56);

  return (
    <View>
      {onThumbnailChange != null ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textMuted, marginBottom: 6 }}>Add from URL</Text>
          <TextInput
            value={thumbnail ?? ''}
            onChangeText={(t) => onThumbnailChange(t.trim() || null)}
            placeholder="https://example.com/image.jpg"
            placeholderTextColor={Colors.textMuted}
            style={[baseInputStyle, { flex: 1 }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 4 }}>
            Use this image when a valid URL is provided; otherwise it uses the seed below.
          </Text>
        </View>
      ) : null}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textMuted, marginBottom: 6 }}>
          {isUser ? 'Choose style' : 'Choose icon'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {isUser && userName ? (
            <TouchableOpacity
              onPress={() => {
                onChangeText('');
                onThumbnailChange?.(null);
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderWidth: 2,
                borderColor: !value.trim() && !thumbnail ? Colors.accent : Colors.border,
                backgroundColor: avatarColor(userName),
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 20, fontFamily: Fonts.bold, color: '#fff' }}>{userName[0]?.toUpperCase() || '?'}</Text>
            </TouchableOpacity>
          ) : null}
          {presetOptions.map((preset) => (
            <TouchableOpacity
              key={preset}
              onPress={() => onChangeText(preset)}
              style={{
                width: 44,
                height: 44,
                borderRadius: isUser ? 22 : groupAvatarBorderRadius(44),
                borderWidth: 2,
                borderColor: effectiveSeed === preset ? Colors.accent : Colors.border,
                backgroundColor: Colors.bg,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
              activeOpacity={0.8}
            >
              {isUser ? (
                <BotttsAvatar seed={preset} size={36} style={{ width: 36, height: 36 }} />
              ) : (
                <IconsAvatar seed={preset} size={36} style={{ width: 36, height: 36 }} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textMuted, marginBottom: 6 }}>
          {isUser ? 'Avatar seed (or type custom)' : 'Avatar seed (or type custom)'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={defaultSeed}
            placeholderTextColor={Colors.textMuted}
            style={baseInputStyle}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
      <View style={{ marginTop: 8, alignItems: 'center' }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: previewRadius,
            borderWidth: 1,
            backgroundColor: getGroupColor(getDefaultGroupThemeFromName('Group')).row,
            borderColor: getGroupColor(getDefaultGroupThemeFromName('Group')).cal,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {isUser && userName && !value.trim() && !thumbnail ? (
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: avatarColor(userName), alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, fontFamily: Fonts.bold, color: '#fff' }}>{userName[0]?.toUpperCase() || '?'}</Text>
            </View>
          ) : isUser ? (
            <UserAvatar seed={effectiveSeed} thumbnail={thumbnail} size={56} style={{ width: 56, height: 56 }} />
          ) : (
            <GroupAvatar seed={effectiveSeed} thumbnail={thumbnail} size={56} style={{ width: 56, height: 56 }} />
          )}
        </View>
      </View>
    </View>
  );
}
