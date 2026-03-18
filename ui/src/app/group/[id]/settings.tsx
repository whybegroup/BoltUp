import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Fonts, Radius, Shadows } from '../../../constants/theme';
import { getGroupColor } from '../../../utils/helpers';
import { Avatar, NavBar } from '../../../components/ui';
import { useGroup, useUsers } from '../../../hooks/api';
import * as ImagePicker from 'expo-image-picker';

const ME_ID = 'u1';

function defaultGroupAvatarUri(groupId: string): string {
  return `https://api.dicebear.com/8.x/bottts/png?seed=${encodeURIComponent(groupId)}&size=256&backgroundType=gradientLinear`;
}

const DEFAULT_GROUP_AVATARS = [
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
  
  const groupId = Array.isArray(id) ? id[0] : id;

  if (!groupId) {
    return null;
  }

  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: users = [] } = useUsers();
  
  const [draftName, setDraftName] = useState(group?.name || '');
  const [draftDesc, setDraftDesc] = useState(group?.desc || '');
  const [draftThumbnail, setDraftThumbnail] = useState<string | null>(group?.thumbnail ?? null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [newMember,      setNewMember]      = useState('');
  const [showDelete,     setShowDelete]     = useState(false);
  const [pendingReqs,    setPendingReqs]   = useState([
    { userId: 'u26' },
    { userId: 'u27' },
  ]);

  const usersMap = useMemo(() => {
    const map: Record<string, any> = {};
    users.forEach(u => map[u.id] = u);
    return map;
  }, [users]);

  const getUser = (userId: string) => {
    return usersMap[userId] || { id: userId, name: 'Loading...', displayName: 'Loading...', handle: '' };
  };

  if (!group) {
    return null;
  }

  const admins = group.adminIds;
  const superAdminId = group.superAdminId;
  const isSuperAdmin = superAdminId === ME_ID;

  const approveReq = (userId: string) => {
    // TODO: Call API to approve request
    setPendingReqs(p => p.filter(r => r.userId !== userId));
  };
  
  const declineReq = (userId: string) => {
    // TODO: Call API to decline request
    setPendingReqs(p => p.filter(r => r.userId !== userId));
  };

  const removeMember = (userId: string) => {
    // TODO: Call API to remove member
    console.log('Remove member', userId);
  };

  const addMember = () => {
    const n = newMember.trim().toLowerCase();
    if (!n) return;
    const user = users.find(u => u.handle.toLowerCase() === n || u.displayName.toLowerCase().includes(n));
    if (!user || group.memberIds.includes(user.id)) { setNewMember(''); return; }
    // TODO: Call API to add member
    console.log('Add member', user.id);
    setNewMember('');
  };

  const saveGroupInfo = () => {
    const name = draftName.trim();
    const desc = draftDesc.trim();
    if (!name) return;
    // TODO: Call API to update group info
    console.log('Save group info', { name, desc, thumbnail: draftThumbnail });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1400);
  };

  const deleteGroup = () => {
    // TODO: Call API to delete group
    console.log('Delete group', groupId);
    router.replace('/(tabs)/groups');
  };

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

  const displayThumb = draftThumbnail || group.thumbnail || defaultGroupAvatarUri(group.id);
  const p = getGroupColor(group?.colorHex);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push(`/group/${groupId}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <NavBar title="Group Settings" onBack={handleBack} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* Group Info */}
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
              onChangeText={setDraftName}
              placeholder="Group name"
              placeholderTextColor={Colors.textMuted}
              style={styles.inlineInput}
            />
            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Description</Text>
            <TextInput
              value={draftDesc}
              onChangeText={setDraftDesc}
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

        {/* Invite */}
        <View style={[styles.card, { marginTop: 16 }]}>
          <TouchableOpacity onPress={() => router.push(`/group/${groupId}/invite`)} style={styles.inviteRow}>
            <Text style={{ fontSize: 18 }}>🔗</Text>
            <Text style={styles.inviteText}>Invite People</Text>
          </TouchableOpacity>
        </View>

        {/* Pending requests */}
        {pendingReqs.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>PENDING REQUESTS · {pendingReqs.length}</Text>
            <View style={[styles.card, styles.pendingCard]}>
              {pendingReqs.map((req, i) => (
                <View key={req.userId} style={[styles.row, i < pendingReqs.length - 1 && styles.rowBorder]}>
                  <Avatar name={getUser(req.userId).displayName} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{getUser(req.userId).displayName}</Text>
                    <Text style={styles.memberHandle}>@{getUser(req.userId).handle} · wants to join</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => approveReq(req.userId)} style={styles.approveBtn}>
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => declineReq(req.userId)} style={styles.declineBtn}>
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Members */}
        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>MEMBERS · {group.memberIds.length}</Text>
        <View style={[styles.card, { marginBottom: 16 }]}>
          {group.memberIds.map((memberId, i) => {
            const isSuperAdmin = memberId === superAdminId;
            const isAdmin      = admins.includes(memberId);
            return (
              <View key={memberId} style={[styles.row, i < group.memberIds.length - 1 && styles.rowBorder]}>
                <Avatar name={getUser(memberId).displayName} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{getUser(memberId).displayName}</Text>
                  <Text style={styles.memberRole}>{isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Member'}</Text>
                </View>
                {isSuperAdmin
                  ? <Text style={{ fontSize: 14 }}>👑</Text>
                  : <TouchableOpacity onPress={() => removeMember(memberId)} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                }
              </View>
            );
          })}
        </View>

        {/* Add member */}
        <Text style={styles.sectionLabel}>ADD MEMBER</Text>
        <View style={[styles.card, { padding: 14, marginBottom: 20 }]}>
          <Text style={styles.addMemberDesc}>Add directly without approval</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={newMember}
              onChangeText={setNewMember}
              onSubmitEditing={addMember}
              placeholder="@handle or username"
              placeholderTextColor={Colors.textMuted}
              style={styles.addInput}
            />
            <TouchableOpacity
              onPress={addMember}
              style={[styles.addBtn, !newMember.trim() && { backgroundColor: Colors.border }]}
              disabled={!newMember.trim()}
            >
              <Text style={[styles.addBtnText, !newMember.trim() && { color: Colors.textMuted }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isSuperAdmin && (
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
                    deleteGroup();
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
  logoBlock:       { alignItems: 'center' },
  logo:            { width: 104, height: 104, borderRadius: 28, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  logoActions:     { flexDirection: 'row', gap: 8, marginTop: 12 },
  fieldLabel:      { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.semiBold, marginBottom: 6 },
  inlineInput:     { padding: 10, paddingHorizontal: 12, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  secondaryBtn:    { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  secondaryBtnText:{ fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.text },
  saveBtn:         { marginTop: 14, paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.accent, alignItems: 'center' },
  saveBtnText:     { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.accentFg },
  inviteRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteText:      { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },
  sectionLabel:    { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  pendingCard:     { borderColor: '#FDE68A' },
  row:             { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowBorder:       { borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberName:      { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },
  memberHandle:    { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular },
  memberRole:      { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 1 },
  approveBtn:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, backgroundColor: Colors.going },
  approveBtnText:  { fontSize: 12, fontFamily: Fonts.semiBold, color: '#fff' },
  declineBtn:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  declineBtnText:  { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSub },
  removeBtn:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, borderWidth: 1, borderColor: '#FECACA', backgroundColor: Colors.notGoingBg },
  removeBtnText:   { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.notGoing },
  addMemberDesc:   { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular, marginBottom: 10 },
  addInput:        { flex: 1, padding: 9, paddingHorizontal: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  addBtn:          { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.lg, backgroundColor: Colors.accent },
  addBtnText:      { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.accentFg },
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
