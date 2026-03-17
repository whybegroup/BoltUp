import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, Modal, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Fonts, Radius } from '../../../constants/theme';
import { paletteOf } from '../../../utils/helpers';
import { GROUPS, MY_NAME, deleteGroup, saveGroup } from '../../../data/mock';
import { NavBar } from '../../../components/ui';
import * as ImagePicker from 'expo-image-picker';

function defaultGroupAvatarUri(groupId: string): string {
  // "Random alien thing" default that is stable per group.
  return `https://api.dicebear.com/8.x/bottts/png?seed=${encodeURIComponent(groupId)}&size=256&backgroundType=gradientLinear`;
}

const DEFAULT_GROUP_AVATARS = [
  // Bold, icon-like defaults that read well at small sizes.
  'https://api.dicebear.com/8.x/icons/png?seed=ktown-hangout&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=sgv-foodies&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=la-hiking&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=running-club&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=watch-party&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=entrepreneurs&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=volleyball&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=coffee&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=brunch&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=karaoke&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=basketball&size=256&backgroundType=gradientLinear',
  'https://api.dicebear.com/8.x/icons/png?seed=book-club&size=256&backgroundType=gradientLinear',
] as const;

export default function GroupSettingsScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const router     = useRouter();
  const initGroup  = GROUPS.find(g => g.id === id)!;

  const [group,          setGroup]          = useState({ ...initGroup });
  const [draftName, setDraftName] = useState(group.name);
  const [draftDesc, setDraftDesc] = useState(group.desc);
  const [draftThumbnail, setDraftThumbnail] = useState<string | null>(group.thumbnail ?? null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const setName = (name: string) => { setDraftName(name); setGroup(g => ({ ...g, name })); };
  const setDesc = (desc: string) => { setDraftDesc(desc); setGroup(g => ({ ...g, desc })); };

  const saveGroupInfo = () => {
    const name = draftName.trim();
    const desc = draftDesc.trim();
    if (!name) return;
    const nextGroup = { ...group, name, desc, thumbnail: draftThumbnail };
    saveGroup(nextGroup);
    setGroup(nextGroup);
    setDraftName(name);
    setDraftDesc(desc);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1400);
  };

  const p = paletteOf(group);
  const superAdmin = group.superAdmin || group.members[0];
  const isSuperAdminMe = superAdmin === MY_NAME;

  const uploadThumbnail = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    setDraftThumbnail(uri);
  };

  const displayThumb = draftThumbnail || defaultGroupAvatarUri(group.id);

  return (
    <SafeAreaView style={styles.safe}>
      <NavBar title="Group Settings" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        <View style={styles.card}>
          <View style={styles.logoBlock}>
            <Image source={{ uri: displayThumb }} style={styles.logo} />
            <View style={styles.logoActions}>
              <TouchableOpacity onPress={uploadThumbnail} style={styles.secondaryBtn} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>Upload</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowIconPicker(true)} style={styles.secondaryBtn} activeOpacity={0.8}>
                <Text style={styles.secondaryBtnText}>Defaults</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDraftThumbnail(null)} style={styles.secondaryBtn} activeOpacity={0.8}>
                <Text style={[styles.secondaryBtnText, { color: Colors.textSub }]}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <Text style={styles.fieldLabel}>Group name</Text>
            <TextInput
              value={draftName}
              onChangeText={setName}
              placeholder="Group name"
              placeholderTextColor={Colors.textMuted}
              style={styles.inlineInput}
            />
            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Description</Text>
            <TextInput
              value={draftDesc}
              onChangeText={setDesc}
              placeholder="Description"
              placeholderTextColor={Colors.textMuted}
              style={[styles.inlineInput, { height: 90, textAlignVertical: 'top' }]}
              multiline
            />
          </View>

          <TouchableOpacity onPress={saveGroupInfo} style={styles.saveBtn} activeOpacity={0.8}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {isSuperAdminMe && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>DANGER ZONE</Text>
            <View style={[styles.dangerCard]}>
              <TouchableOpacity onPress={() => setShowDelete(true)} style={styles.dangerRow} activeOpacity={0.8}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerTitle}>Delete Group</Text>
                  <Text style={styles.dangerDesc}>Permanently delete this group and all events</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {savedToast && (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={styles.toast}>
            <Text style={styles.toastText}>Saved</Text>
          </View>
        </View>
      )}

      {/* Delete confirm */}
      {showDelete && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDelete(false)}>
          <TouchableOpacity style={styles.overlay} onPress={() => setShowDelete(false)} activeOpacity={1}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Delete {group.name}?</Text>
              <Text style={styles.confirmBody}>
                This will permanently delete the group and all its events. This cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setShowDelete(false)} style={[styles.confirmBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
                  <Text style={{ fontFamily: Fonts.semiBold, color: Colors.text, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowDelete(false);
                    deleteGroup(group.id);
                    router.replace('/(tabs)/groups');
                  }}
                  style={[styles.confirmBtn, { backgroundColor: Colors.notGoing, borderColor: Colors.notGoing }]}
                >
                  <Text style={{ fontFamily: Fonts.bold, color: '#fff', fontSize: 14 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Icon picker */}
      {showIconPicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowIconPicker(false)}>
          <TouchableOpacity style={styles.overlay} onPress={() => setShowIconPicker(false)} activeOpacity={1}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Choose a default avatar</Text>
              <View style={styles.iconGrid}>
                {DEFAULT_GROUP_AVATARS.map((uri) => (
                  <TouchableOpacity
                    key={uri}
                    onPress={() => { setDraftThumbnail(uri); setShowIconPicker(false); }}
                    style={[styles.iconCell, uri === draftThumbnail && styles.iconCellActive]}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri }} style={styles.iconImg} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.bg },
  card:            { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  groupIcon:       { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumb:           { width: 52, height: 52, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  logoBlock:       { alignItems: 'center' },
  logo:            { width: 104, height: 104, borderRadius: 28, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  logoActions:     { flexDirection: 'row', gap: 8, marginTop: 12 },
  fieldLabel:      { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.semiBold, marginBottom: 6 },
  inlineInput:     { padding: 10, paddingHorizontal: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  secondaryBtn:    { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  secondaryBtnText:{ fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.text },
  saveBtn:         { marginTop: 14, paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center' },
  saveBtnText:     { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.accentFg },
  sectionLabel:    { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  dangerCard:      { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', overflow: 'hidden' },
  dangerRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  dangerTitle:     { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.notGoing },
  dangerDesc:      { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 1 },
  toastWrap:       { position: 'absolute', left: 0, right: 0, bottom: 26, alignItems: 'center' },
  toast:           { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.78)' },
  toastText:       { color: '#fff', fontFamily: Fonts.semiBold, fontSize: 12 },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard:     { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, width: '100%', maxWidth: 360 },
  confirmTitle:    { fontSize: 16, fontFamily: Fonts.extraBold, color: Colors.text, marginBottom: 8 },
  confirmBody:     { fontSize: 14, color: Colors.textSub, fontFamily: Fonts.regular, lineHeight: 20, marginBottom: 16 },
  confirmBtn:      { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
  pickerCard:      { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16, width: '100%', maxWidth: 360 },
  pickerTitle:     { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text, marginBottom: 12 },
  iconGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconCell:        { width: 72, height: 72, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg, overflow: 'hidden' },
  iconCellActive:  { borderColor: Colors.accent },
  iconImg:         { width: '100%', height: '100%' },
});
