import React, { useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Modal, TextInput, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Fonts, Radius, Shadows } from '../../constants/theme';
import { paletteOf, dDiff } from '../../utils/helpers';
import { GROUPS, ALL_EVENTS, MY_NAME, deleteGroup, saveGroup } from '../../data/mock';
import { Avatar, AvatarStack, NavBar } from '../../components/ui';
import { ListView } from '../../components/ListView';

function defaultGroupAvatarUri(groupId: string): string {
  return `https://api.dicebear.com/8.x/bottts/png?seed=${encodeURIComponent(groupId)}&size=256&backgroundType=gradientLinear`;
}

export default function GroupDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const initGroup = GROUPS.find(g => g.id === id)!;

  const [group,       setGroup]       = useState({ ...initGroup });
  const [tab,         setTab]         = useState<'events' | 'members'>('events');
  const [admins,      setAdmins]      = useState([group.superAdmin, MY_NAME].filter((v, i, a) => v && a.indexOf(v) === i));
  const [memberMenu,  setMemberMenu]  = useState<{ name: string } | null>(null);
  const [showLeave,   setShowLeave]   = useState(false);
  const pendingReqs = group.pendingReqs ?? [];
  const [newMember, setNewMember] = useState('');

  const p = paletteOf(group);
  const groupEvents = ALL_EVENTS.filter(e => e.groupId === group.id);
  const superAdmin  = group.superAdmin || group.members[0];
  const hasPendingApprovals = pendingReqs.length > 0;

  useFocusEffect(
    useCallback(() => {
      const next = GROUPS.find(g => g.id === id);
      if (next) setGroup({ ...next });
    }, [id])
  );

  const leaveGroup = () => {
    const remainingAdmins = admins.filter(a => a !== MY_NAME);
    if (remainingAdmins.length === 0) {
      deleteGroup(group.id);
      router.replace('/(tabs)/groups');
      return;
    }

    const nextSuperAdmin = superAdmin === MY_NAME ? remainingAdmins[0] : superAdmin;
    const nextGroup = {
      ...group,
      superAdmin: nextSuperAdmin,
      members: group.members.filter(m => m !== MY_NAME),
    };
    saveGroup(nextGroup);
    setGroup(nextGroup);
    router.replace('/(tabs)/groups');
  };

  const approveReq = (name: string) => {
    setGroup(g => {
      const nextPending = (g.pendingReqs ?? []).filter(r => r.name !== name);
      const nextGroup = { ...g, members: [...g.members, name], pendingReqs: nextPending };
      saveGroup(nextGroup);
      return nextGroup;
    });
  };

  const declineReq = (name: string) => {
    setGroup(g => {
      const nextPending = (g.pendingReqs ?? []).filter(r => r.name !== name);
      const nextGroup = { ...g, pendingReqs: nextPending };
      saveGroup(nextGroup);
      return nextGroup;
    });
  };

  const removeMemberAdmin = (name: string) => {
    if (name === superAdmin) return;
    setGroup(g => {
      const nextGroup = { ...g, members: g.members.filter(m => m !== name) };
      saveGroup(nextGroup);
      return nextGroup;
    });
    setAdmins(a => a.filter(x => x !== name));
  };

  const toggleAdmin = (name: string) => {
    if (name === superAdmin) return;
    setAdmins(a => a.includes(name) ? a.filter(x => x !== name) : [...a, name]);
    setMemberMenu(null);
  };

  const removeMember = (name: string) => {
    if (name === MY_NAME || name === superAdmin) return;
    removeMemberAdmin(name);
    setMemberMenu(null);
  };

  const addMemberAdmin = () => {
    const n = newMember.trim();
    if (!n || group.members.includes(n)) return;
    setGroup(g => {
      const nextGroup = { ...g, members: [...g.members, n] };
      saveGroup(nextGroup);
      return nextGroup;
    });
    setNewMember('');
  };

  // Admin management actions are handled in the Members tab for admins.

  return (
    <SafeAreaView style={styles.safe}>
      <NavBar
        title={group.name}
        onBack={() => router.back()}
        right={
          group.isAdmin
            ? (
              <TouchableOpacity
                onPress={() => router.push(`/group/${id}/settings`)}
                style={styles.settingsIconBtn}
                accessibilityLabel="Group settings"
              >
                <Text style={styles.settingsIcon}>⚙︎</Text>
              </TouchableOpacity>
            )
            : null
        }
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Group header */}
        <View style={[styles.headerBlock, { borderBottomColor: Colors.border }]}>
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
            <Image source={{ uri: group.thumbnail || defaultGroupAvatarUri(group.id) }} style={styles.groupThumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupDesc}>{group.desc}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AvatarStack names={group.members} size={24} max={5} />
              <Text style={styles.memberCount}>{group.members.length} members</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => router.push(`/group/${id}/invite`)} style={styles.inviteBtn}>
                <Text style={styles.inviteBtnText}>Invite</Text>
              </TouchableOpacity>
              {group.isAdmin && (
                <TouchableOpacity onPress={() => router.push('/create-event')} style={styles.createBtn}>
                  <Text style={styles.createBtnText}>+ Event</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['events', 'members'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
                {t === 'members' && hasPendingApprovals && <View style={styles.tabDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ padding: 16, paddingBottom: 100 }}>
          {tab === 'events' && (
            groupEvents.length === 0
              ? <View style={{ alignItems: 'center', paddingTop: 60 }}>
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}>No events yet</Text>
                </View>
              : <ListView events={groupEvents} onSelect={ev => router.push(`/event/${ev.id}`)} showGroup={false} />
          )}

          {tab === 'members' && (
            group.isAdmin
              ? (
                <>
                  {/* Pending requests */}
                  {pendingReqs.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>PENDING REQUESTS · {pendingReqs.length}</Text>
                      <View style={[styles.card, styles.pendingCard]}>
                        {pendingReqs.map((req, i) => (
                          <View key={i} style={[styles.memberRow, i < pendingReqs.length - 1 && styles.rowBorder]}>
                            <Avatar name={req.name} size={38} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.memberName}>{req.name}</Text>
                              <Text style={styles.memberHandle}>@{req.handle} · wants to join</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <TouchableOpacity onPress={() => approveReq(req.name)} style={styles.approveBtn}>
                                <Text style={styles.approveBtnText}>Approve</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => declineReq(req.name)} style={styles.declineBtn}>
                                <Text style={styles.declineBtnText}>Decline</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Members */}
                  <Text style={styles.sectionLabel}>MEMBERS · {group.members.length}</Text>
                  <View style={[styles.card, { marginBottom: 16 }]}>
                    {group.members.map((name, i) => {
                      const isSuperAdmin = name === superAdmin;
                      const isAdmin      = admins.includes(name);
                      const isMe         = name === MY_NAME;
                      const canAction    = !isMe && !isSuperAdmin;
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => canAction && setMemberMenu({ name })}
                          style={[styles.memberRow, i < group.members.length - 1 && styles.rowBorder]}
                          activeOpacity={canAction ? 0.7 : 1}
                        >
                          <Avatar name={name} size={38} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberName}>{name}</Text>
                            <Text style={styles.memberRole}>{isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Member'}</Text>
                          </View>
                          {isSuperAdmin && <Text style={{ fontSize: 14 }}>👑</Text>}
                          {canAction && <Text style={{ color: Colors.textMuted, fontSize: 16 }}>›</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Add member */}
                  <Text style={styles.sectionLabel}>ADD MEMBER</Text>
                  <View style={[styles.card, { padding: 14 }]}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        value={newMember}
                        onChangeText={setNewMember}
                        onSubmitEditing={addMemberAdmin}
                        placeholder="@handle or username"
                        placeholderTextColor={Colors.textMuted}
                        style={styles.addInput}
                      />
                      <TouchableOpacity
                        onPress={addMemberAdmin}
                        style={[styles.addBtn, !newMember.trim() && { backgroundColor: Colors.border }]}
                        disabled={!newMember.trim()}
                      >
                        <Text style={[styles.addBtnText, !newMember.trim() && { color: Colors.textMuted }]}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Leave group */}
                  <Text style={[styles.sectionLabel, { marginTop: 20 }]}>LEAVE</Text>
                  <View style={[styles.card, { borderColor: '#FECACA' }]}>
                    <TouchableOpacity onPress={() => setShowLeave(true)} style={styles.memberRow} activeOpacity={0.8}>
                      <Text style={{ fontSize: 18 }}>🚪</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leaveTitle}>Leave Group</Text>
                        <Text style={styles.leaveDesc}>You’ll need an invite to rejoin</Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Context menu */}
                  {memberMenu && (
                    <Modal visible transparent animationType="fade" onRequestClose={() => setMemberMenu(null)}>
                      <TouchableOpacity style={styles.menuOverlay} onPress={() => setMemberMenu(null)} activeOpacity={1}>
                        <View style={styles.menuCard}>
                          <View style={styles.menuHeader}>
                            <Text style={styles.menuHeaderText} numberOfLines={1}>{memberMenu.name}</Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => toggleAdmin(memberMenu.name)}
                            style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: Colors.border }]}
                          >
                            <Text style={{ fontSize: 16 }}>{admins.includes(memberMenu.name) ? '👤' : '⭐'}</Text>
                            <Text style={styles.menuItemText}>{admins.includes(memberMenu.name) ? 'Remove admin' : 'Add to admin'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removeMember(memberMenu.name)} style={styles.menuItem}>
                            <Text style={{ fontSize: 16 }}>🚫</Text>
                            <Text style={[styles.menuItemText, { color: Colors.notGoing }]}>Remove from group</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  )}
                </>
              )
              : (
                <View style={styles.card}>
                  {group.members.map((name, i) => {
                    const isSuperAdmin = name === superAdmin;
                    return (
                      <View key={i} style={[styles.memberRow, i < group.members.length - 1 && styles.rowBorder]}>
                        <Avatar name={name} size={38} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{name}</Text>
                          <Text style={styles.memberRole}>{isSuperAdmin ? 'Super Admin' : 'Member'}</Text>
                        </View>
                        {isSuperAdmin && <Text style={{ fontSize: 14 }}>👑</Text>}
                      </View>
                    );
                  })}
                </View>
              )
          )}

          {tab === 'members' && !group.isAdmin && (
            <>
              <View style={{ height: 16 }} />
              <Text style={styles.sectionLabel}>LEAVE</Text>
              <View style={[styles.card, { borderColor: '#FECACA' }]}>
                <TouchableOpacity onPress={() => setShowLeave(true)} style={styles.memberRow} activeOpacity={0.8}>
                  <Text style={{ fontSize: 18 }}>🚪</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaveTitle}>Leave Group</Text>
                    <Text style={styles.leaveDesc}>You’ll need an invite to rejoin</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Leave confirm */}
      {showLeave && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowLeave(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowLeave(false)} activeOpacity={1}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Leave {group.name}?</Text>
              <Text style={styles.confirmBody}>
                {superAdmin === MY_NAME
                  ? admins.filter(a => a !== MY_NAME).length > 0
                    ? "You're the Super Admin. The next admin will take over."
                    : "You're the only admin. Leaving will dissolve this group."
                  : "You'll need an invite to rejoin."
                }
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setShowLeave(false)} style={[styles.confirmBtn, { borderColor: Colors.border, backgroundColor: Colors.surface }]}>
                  <Text style={{ fontFamily: Fonts.semiBold, color: Colors.text }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setShowLeave(false); leaveGroup(); }} style={[styles.confirmBtn, { backgroundColor: Colors.notGoing, borderColor: Colors.notGoing }]}>
                  <Text style={{ fontFamily: Fonts.bold, color: '#fff' }}>Leave</Text>
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
  safe:             { flex: 1, backgroundColor: Colors.bg },
  settingsIconBtn:  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  settingsIcon:     { fontSize: 18, color: Colors.textSub },
  headerBlock:      { backgroundColor: Colors.surface, padding: 20, borderBottomWidth: 1 },
  groupIcon:        { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  groupThumb:       { width: 56, height: 56, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg },
  groupName:        { fontSize: 19, fontFamily: Fonts.extraBold, color: Colors.text, marginBottom: 4 },
  groupDesc:        { fontSize: 13, color: Colors.textSub, fontFamily: Fonts.regular, lineHeight: 18 },
  memberCount:      { fontSize: 13, color: Colors.textSub, fontFamily: Fonts.regular },
  inviteBtn:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  inviteBtnText:    { fontSize: 13, fontFamily: Fonts.medium, color: Colors.text },
  createBtn:        { paddingHorizontal: 16, paddingVertical: 7, borderRadius: Radius.lg, backgroundColor: Colors.accent },
  createBtnText:    { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.accentFg },
  tabs:             { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab:              { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:        { borderBottomColor: Colors.text },
  tabText:          { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textMuted },
  tabTextActive:    { fontFamily: Fonts.bold, color: Colors.text },
  tabDot:           { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444', marginTop: 1 },
  card:             { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  sectionLabel:     { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  pendingCard:      { borderColor: '#FDE68A' },
  memberRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowBorder:        { borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberName:       { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },
  memberHandle:     { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular },
  youLabel:         { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular },
  memberRole:       { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 1 },
  adminBadge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  adminBadgeText:   { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSub },
  approveBtn:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, backgroundColor: Colors.going },
  approveBtnText:   { fontSize: 12, fontFamily: Fonts.semiBold, color: '#fff' },
  declineBtn:       { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  declineBtnText:   { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSub },
  removeBtn:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, borderWidth: 1, borderColor: '#FECACA', backgroundColor: Colors.notGoingBg },
  removeBtnText:    { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.notGoing },
  addInput:         { flex: 1, padding: 9, paddingHorizontal: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  addBtn:           { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.lg, backgroundColor: Colors.accent },
  addBtnText:       { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.accentFg },
  leaveTitle:       { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.notGoing },
  leaveDesc:        { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 1 },
  menuOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  menuCard:         { backgroundColor: Colors.surface, borderRadius: 16, width: 220, overflow: 'hidden', ...Shadows.lg },
  menuHeader:       { padding: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuHeaderText:   { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textMuted },
  menuItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 16 },
  menuItemText:     { fontSize: 14, color: Colors.text, fontFamily: Fonts.regular },
  confirmCard:      { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, ...Shadows.lg },
  confirmTitle:     { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.text, marginBottom: 8 },
  confirmBody:      { fontSize: 14, color: Colors.textSub, fontFamily: Fonts.regular, lineHeight: 22, marginBottom: 20 },
  confirmBtn:       { flex: 1, paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
});
