import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Colors, Fonts, Radius } from '../constants/theme';
import { AvatarSeedPicker } from './AvatarSeedPicker';

const DEFAULT_AVATAR_SEED = 'auto';

interface GroupAvatarPickerProps {
  visible: boolean;
  onClose: () => void;
  seed: string;
  onSeedChange: (text: string) => void;
  thumbnail: string | null;
  onThumbnailChange: (text: string | null) => void;
  /** When provided, shows Save button that calls this with current values. Only updates backend when Save is pressed. */
  onSave?: (avatarSeed: string, thumbnail: string | null) => void | Promise<void>;
  isSaving?: boolean;
}

export function GroupAvatarPicker({
  visible,
  onClose,
  seed,
  onSeedChange,
  thumbnail,
  onThumbnailChange,
  onSave,
  isSaving,
}: GroupAvatarPickerProps) {
  if (!visible) return null;

  const handleSave = async () => {
    if (!onSave) return;
    try {
      await onSave(seed.trim() || DEFAULT_AVATAR_SEED, thumbnail);
      onClose();
    } catch (e) {
      console.error('Failed to save avatar', e);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose group avatar</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
        <AvatarSeedPicker
          defaultSeed={DEFAULT_AVATAR_SEED}
          value={seed}
          onChangeText={onSeedChange}
          thumbnail={thumbnail}
          onThumbnailChange={onThumbnailChange}
          inputStyle={styles.input}
        />
        </ScrollView>
        {onSave ? (
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.textMuted} />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay:  { backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:    { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, width: '100%', maxWidth: 360, maxHeight: '80%' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title:   { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
  closeBtn:{ fontSize: 20, color: Colors.textMuted, lineHeight: 24 },
  input:   { padding: 10, paddingHorizontal: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  saveBtn: { marginTop: 12, paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.accentFg },
});
