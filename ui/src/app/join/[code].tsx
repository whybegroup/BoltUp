import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../../hooks/useAppRouter';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Colors, Fonts } from '../../constants/theme';
import { useJoinByInviteCode } from '../../hooks/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrentUserContext } from '../../contexts/CurrentUserContext';
import { firstSearchParam } from '../../utils/navigationReturn';

export default function JoinByInviteCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = (firstSearchParam(params.code) ?? '').trim();
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const { userId } = useCurrentUserContext();
  const joinByCode = useJoinByInviteCode();
  const [error, setError] = useState<string | null>(null);
  const attemptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError('This invite link is missing a code.');
      return;
    }
    if (authLoading || !firebaseUser || !userId) return;

    const key = `${userId}:${code.toUpperCase()}`;
    if (attemptKeyRef.current === key) return;
    attemptKeyRef.current = key;
    setError(null);

    joinByCode.mutate(
      { inviteCode: code, userId },
      {
        onSuccess: (data: { groupId?: string; groupName?: string; status?: string }) => {
          const msg =
            data?.status === 'joined'
              ? `Joined ${data.groupName || 'the group'}`
              : `Submitted request to join ${data.groupName || 'the group'}`;
          Toast.show({ type: 'success', text1: msg });
          if (data.groupId) {
            router.replace(`/(tabs)/groups/${data.groupId}` as Href);
          } else {
            router.replace('/(tabs)/groups');
          }
        },
        onError: (e: any) => {
          attemptKeyRef.current = null;
          setError(e?.body?.error ?? e?.message ?? 'Invalid invite code');
        },
      }
    );
  }, [authLoading, code, firebaseUser, joinByCode, router, userId]);

  const retry = () => {
    attemptKeyRef.current = null;
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        {error ? (
          <>
            <Text style={styles.title}>Could not join</Text>
            <Text style={styles.bodyText}>{error}</Text>
            <TouchableOpacity onPress={retry} style={styles.btn} accessibilityRole="button">
              <Text style={styles.btnText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.replace('/(tabs)/groups')}
              style={styles.linkBtn}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>Go to groups</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color={Colors.text} />
            <Text style={styles.pending}>
              {!firebaseUser && !authLoading ? 'Redirecting to sign in…' : 'Joining group…'}
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  title: {
    fontSize: 20,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textSub,
    textAlign: 'center',
    marginBottom: 20,
  },
  pending: {
    marginTop: 16,
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  btn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  btnText: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.accentFg },
  linkBtn: { padding: 8 },
  linkText: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.textSub },
});
