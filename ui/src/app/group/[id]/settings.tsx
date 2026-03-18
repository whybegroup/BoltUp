import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Fonts, Radius, Shadows } from '../../../constants/theme';
import { getGroupColor } from '../../../utils/helpers';
import { Avatar, NavBar } from '../../../components/ui';
import { useGroup, useUsers } from '../../../hooks/api';

const ME_ID = 'u1';

export default function GroupSettingsScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const router     = useRouter();
  
  const groupId = Array.isArray(id) ? id[0] : id;

  if (!groupId) {
    return null;
  }

  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: users = [] } = useUsers();
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

        {/* Group info card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <View style={[styles.groupIcon, { backgroundColor: p.row, borderColor: p.cal }]}>
              <Text style={{ fontSize: 26 }}>{group.emoji}</Text>
            </View>
            <View>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupMeta}>{group.memberIds.length} members</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push(`/group/${groupId}/invite`)} style={styles.inviteBtn}>
            <Text style={styles.inviteBtnText}>🔗 Invite People</Text>
          </TouchableOpacity>
        </View>

        {/* Pending requests */}
        {pendingReqs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>PENDING REQUESTS · {pendingReqs.length}</Text>
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
        <Text style={styles.sectionLabel}>MEMBERS · {group.memberIds.length}</Text>
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

        {/* Danger zone */}
        <Text style={styles.sectionLabel}>DANGER ZONE</Text>
        <View style={[styles.card, { borderColor: '#FECACA' }]}>
          <TouchableOpacity onPress={() => setShowDelete(true)} style={styles.row}>
            <Text style={{ fontSize: 18 }}>🗑️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerTitle}>Delete Group</Text>
              <Text style={styles.dangerDesc}>Permanently delete this group and all events</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete confirm */}
      {showDelete && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDelete(false)}>
          <TouchableOpacity
            style={styles.overlay}
            onPress={() => setShowDelete(false)}
            activeOpacity={1}
          >
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Delete "{group.name}"?</Text>
              <Text style={styles.confirmBody}>
                This will permanently delete the group and all its events. This cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowDelete(false)}
                  style={[styles.confirmBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}
                >
                  <Text style={{ fontFamily: Fonts.semiBold, color: Colors.text, fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setShowDelete(false); router.push('/(tabs)/groups'); }}
                  style={[styles.confirmBtn, { backgroundColor: Colors.notGoing, borderColor: Colors.notGoing }]}
                >
                  <Text style={{ fontFamily: Fonts.bold, color: '#fff', fontSize: 14 }}>Delete</Text>
                </TouchableOpacity>
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
  sectionLabel:    { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  card:            { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 20 },
  pendingCard:     { borderColor: '#FDE68A' },
  row:             { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowBorder:       { borderBottomWidth: 1, borderBottomColor: Colors.border },
  groupIcon:       { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupName:       { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  groupMeta:       { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular },
  inviteBtn:       { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 10, alignItems: 'center' },
  inviteBtnText:   { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.text },
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
  dangerTitle:     { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.notGoing },
  dangerDesc:      { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 1 },
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  confirmCard:     { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, ...Shadows.lg },
  confirmTitle:    { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text, marginBottom: 8 },
  confirmBody:     { fontSize: 14, color: Colors.textSub, fontFamily: Fonts.regular, lineHeight: 22, marginBottom: 20 },
  confirmBtn:      { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
});
