import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Fonts, Radius, Shadows } from '../../constants/theme';
import { paletteOf, dDiff } from '../../utils/helpers';
import { GROUPS, ALL_EVENTS, MY_NAME } from '../../data/mock';
import { Avatar, AvatarStack, NavBar } from '../../components/ui';
import { ListView } from '../../components/ListView';

export default function GroupDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const initGroup = GROUPS.find(g => g.id === id)!;

  const [group,       setGroup]       = useState({ ...initGroup });
  const [tab,         setTab]         = useState<'events' | 'members'>('events');
  const [admins,      setAdmins]      = useState([group.superAdmin, MY_NAME].filter((v, i, a) => v && a.indexOf(v) === i));
  const [memberMenu,  setMemberMenu]  = useState<{ name: string } | null>(null);
  const [showLeave,   setShowLeave]   = useState(false);
  const [pendingReqs] = useState([
    { name: 'Rachel · OC · 91', handle: 'rachel.oc.91' },
    { name: 'Tommy · SGV · 89', handle: 'tommy.sgv.89' },
  ]);

  const p = paletteOf(group);
  const groupEvents = ALL_EVENTS.filter(e => e.groupId === group.id);
  const superAdmin  = group.superAdmin || group.members[0];

  const leaveGroup = () => {
    const remainingAdmins = admins.filter(a => a !== MY_NAME);
    if (remainingAdmins.length === 0) { router.back(); return; }
    if (superAdmin === MY_NAME) setGroup(g => ({ ...g, superAdmin: remainingAdmins[0] }));
    setGroup(g => ({ ...g, members: g.members.filter(m => m !== MY_NAME) }));
    router.back();
  };

  const removeMember = (name: string) => {
    if (name === MY_NAME || name === superAdmin) return;
    const remaining = admins.filter(a => a !== name);
    if (remaining.length === 0) { router.back(); return; }
    setGroup(g => ({ ...g, members: g.members.filter(m => m !== name) }));
    setAdmins(remaining);
    setMemberMenu(null);
  };

  const toggleAdmin = (name: string) => {
    if (name === superAdmin) return;
    setAdmins(a => a.includes(name) ? a.filter(x => x !== name) : [...a, name]);
    setMemberMenu(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <NavBar
        title={group.name}
        onBack={() => router.back()}
        right={
          group.isAdmin
            ? <TouchableOpacity onPress={() => router.push(`/group/${id}/settings`)} style={styles.settingsBtn}>
                <Text style={styles.settingsBtnText}>Settings</Text>
              </TouchableOpacity>
            : null
        }
      />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Group header */}
        <View style={[styles.headerBlock, { borderBottomColor: Colors.border }]}>
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
            <View style={[styles.groupIcon, { backgroundColor: p.row, borderColor: p.cal }]}>
              <Text style={{ fontSize: 28 }}>{group.emoji}</Text>
            </View>
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
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
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
            <View style={styles.card}>
              {group.members.map((name, i) => {
                const isAdmin     = admins.includes(name);
                const isSuperAdmin= name === superAdmin;
                const isMe        = name === MY_NAME;
                const canAction   = group.isAdmin && !isMe && !isSuperAdmin;

                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => canAction && setMemberMenu({ name })}
                    style={[styles.memberRow, i < group.members.length - 1 && styles.rowBorder]}
                    activeOpacity={canAction ? 0.7 : 1}
                  >
                    <Avatar name={name} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>
                        {name}{isMe ? <Text style={styles.youLabel}> · you</Text> : ''}
                      </Text>
                      <Text style={styles.memberRole}>
                        {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Member'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {isSuperAdmin && <Text style={{ fontSize: 14 }}>👑</Text>}
                      {!isSuperAdmin && isAdmin && (
                        <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>Admin</Text></View>
                      )}
                      {isMe && (
                        <TouchableOpacity onPress={() => setShowLeave(true)} style={styles.leaveBtn}>
                          <Text style={styles.leaveBtnText}>Leave</Text>
                        </TouchableOpacity>
                      )}
                      {canAction && <Text style={{ color: Colors.textMuted, fontSize: 16 }}>›</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Context menu */}
              {memberMenu && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setMemberMenu(null)}>
                  <TouchableOpacity style={styles.menuOverlay} onPress={() => setMemberMenu(null)} activeOpacity={1}>
                    <View style={styles.menuCard}>
                      <View style={styles.menuHeader}>
                        <Text style={styles.menuHeaderText} numberOfLines={1}>{memberMenu.name}</Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleAdmin(memberMenu.name)} style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
                        <Text style={{ fontSize: 16 }}>{admins.includes(memberMenu.name) ? '👤' : '⭐'}</Text>
                        <Text style={styles.menuItemText}>{admins.includes(memberMenu.name) ? 'Remove admin' : 'Make admin'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeMember(memberMenu.name)} style={styles.menuItem}>
                        <Text style={{ fontSize: 16 }}>🚫</Text>
                        <Text style={[styles.menuItemText, { color: Colors.notGoing }]}>Remove from group</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              )}
            </View>
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
  settingsBtn:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  settingsBtnText:  { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textSub },
  headerBlock:      { backgroundColor: Colors.surface, padding: 20, borderBottomWidth: 1 },
  groupIcon:        { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
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
  card:             { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  memberRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowBorder:        { borderBottomWidth: 1, borderBottomColor: Colors.border },
  memberName:       { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },
  youLabel:         { fontSize: 12, color: Colors.textMuted, fontFamily: Fonts.regular },
  memberRole:       { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular, marginTop: 1 },
  adminBadge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border },
  adminBadgeText:   { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textSub },
  leaveBtn:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.lg, borderWidth: 1, borderColor: '#FECACA', backgroundColor: Colors.notGoingBg },
  leaveBtnText:     { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.notGoing },
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
