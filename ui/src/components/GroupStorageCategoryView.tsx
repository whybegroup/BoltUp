import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { usePathname, useLocalSearchParams, type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/theme';
import { useGroup, useGroupStorageFiles, useDeleteGroupStorageFile } from '../hooks/api';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useMissingGroupRedirect } from '../hooks/useMissingResourceAlert';
import { ResolvableImage } from './ResolvableImage';
import { ImageLightboxModal } from './ImageLightboxModal';
import { apiErrorMessage } from '../utils/apiErrors';
import { formatStorageBytes } from '../utils/groupStorage';
import {
  isGroupStorageCategory,
  GROUP_STORAGE_CATEGORY_LABELS,
  type GroupStorageCategory,
} from '../utils/groupStorageCategories';
import { parseFromEventId, buildGroupStorageUrl } from '../utils/breadcrumbUrl';

const COLS = 3;
const GAP = 4;
const PAD = 20;

export function GroupStorageCategoryView({
  groupId,
  category,
}: {
  groupId: string;
  category: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useLocalSearchParams<{ fromEventId?: string | string[] }>();
  const isInEventsTab = pathname.includes('/(tabs)/events/group') || pathname.includes('/events/group');
  const fromEventId = parseFromEventId(searchParams);
  const storageHref = buildGroupStorageUrl(groupId, { isInEventsTab, fromEventId });
  const fallbackHref = (
    isInEventsTab ? `/(tabs)/events/group/${groupId}` : `/(tabs)/groups/${groupId}`
  ) as Href;

  const validCategory = isGroupStorageCategory(category) ? (category as GroupStorageCategory) : null;

  useEffect(() => {
    if (!validCategory) router.replace(storageHref);
  }, [validCategory, router, storageHref]);

  const { userId: currentUserId } = useCurrentUserContext();
  const { data: group, isError, error: groupError, refetch: refetchGroup } = useGroup(
    groupId,
    currentUserId ?? ''
  );
  const canManage = group?.membershipStatus === 'admin';
  const { data: list, refetch: refetchFiles } = useGroupStorageFiles(
    groupId,
    validCategory ?? '',
    currentUserId ?? '',
    !!validCategory && canManage
  );
  const deleteFile = useDeleteGroupStorageFile(groupId, currentUserId ?? '');
  const { refreshControl } = usePullToRefresh([refetchGroup, refetchFiles]);
  const { width: winW } = useWindowDimensions();
  const tile = Math.max(72, Math.floor((winW - PAD * 2 - GAP * (COLS - 1)) / COLS));

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useMissingGroupRedirect(isError, groupError, group?.membershipStatus, fallbackHref);

  useEffect(() => {
    if (group && !canManage) router.replace(fallbackHref);
  }, [group, canManage, router, fallbackHref]);

  const files = list?.files ?? [];
  const urls = useMemo(() => files.map((f) => f.url), [files]);

  const confirmDelete = useCallback(
    (url: string) => {
      const run = async () => {
        try {
          await deleteFile.mutateAsync(url);
          setLightboxIndex((idx) => {
            if (idx == null) return null;
            const remaining = urls.filter((u) => u !== url);
            if (remaining.length === 0) return null;
            return Math.min(idx, remaining.length - 1);
          });
        } catch (e) {
          const msg = apiErrorMessage(e, 'Could not delete photo');
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Error', msg);
        }
      };
      if (Platform.OS === 'web') {
        if (window.confirm('Delete this photo from the group?')) void run();
        return;
      }
      Alert.alert('Delete photo', 'This photo will be removed from the group and deleted from storage.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void run() },
      ]);
    },
    [deleteFile, urls]
  );

  if (!group || !canManage || !validCategory) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.textSub} />
      </View>
    );
  }

  const label = GROUP_STORAGE_CATEGORY_LABELS[validCategory];

  return (
    <View style={styles.page}>
      <ScrollView style={styles.scroll} refreshControl={refreshControl} contentContainerStyle={styles.content}>
        {files.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No photos in {label.toLowerCase()}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {files.map((file, i) => (
              <View key={`${file.url}-${i}`} style={[styles.tileWrap, { width: tile, height: tile }]}>
                <TouchableOpacity
                  onPress={() => setLightboxIndex(i)}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={file.sourceLabel ? `${file.sourceLabel} photo` : 'Photo'}
                >
                  <ResolvableImage
                    storedUrl={file.url}
                    style={{ width: tile, height: tile, backgroundColor: Colors.bg }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(file.url)}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Delete photo"
                  disabled={deleteFile.isPending}
                >
                  <Ionicons name="close" size={11} color="#fff" />
                </TouchableOpacity>
                {file.byteSize > 0 ? (
                  <View style={styles.sizeBadge} pointerEvents="none">
                    <Text style={styles.sizeText}>{formatStorageBytes(file.byteSize)}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <ImageLightboxModal
        visible={lightboxIndex != null && urls.length > 0}
        urls={urls}
        index={lightboxIndex ?? 0}
        onChangeIndex={(i) => setLightboxIndex(i)}
        onClose={() => setLightboxIndex(null)}
        title={lightboxIndex != null ? files[lightboxIndex]?.sourceLabel || label : label}
        showCounter
        onDelete={confirmDelete}
        deleting={deleteFile.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: PAD, paddingTop: 16, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tileWrap: { position: 'relative', borderRadius: Radius.lg, overflow: 'hidden' },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sizeText: { color: '#fff', fontSize: 10, fontFamily: Fonts.semiBold },
  empty: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.textSub },
});
