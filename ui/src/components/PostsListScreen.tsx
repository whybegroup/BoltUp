import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { usePathname, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { GroupsService, type GroupPost } from '@moijia/client';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { queryKeys } from '../config/queryClient';
import { COMMENT_THREAD_OPTIONS_MENU_WIDTH } from './ThreadedCommentsSection';
import {
  getGroupColor,
  getDefaultGroupThemeFromName,
} from '../utils/helpers';
import { Pill } from './ui';
import {
  useGroups,
  useNotifications,
  useAllGroupMemberColors,
  useGroupPosts,
  useUsers,
} from '../hooks/api';
import { useCreateGroupPost } from '../hooks/api/useGroupPosts';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { KeyboardSafeScrollView } from './KeyboardSafeScrollView';
import { UserAvatar } from './UserAvatar';
import { GroupAvatar } from './GroupAvatar';
import { formSectionTitleStyle } from './ui';
import { AddImageButton } from './AddImageButton';
import { ResolvableImage } from './ResolvableImage';
import { ImageLightboxModal } from './ImageLightboxModal';
import { ForumPostMarkdownBody, type ForumPostImageLightboxState } from './ForumPostMarkdownBody';
import {
  pickAndUploadCoverPhoto,
  takeAndUploadCoverPhoto,
  pickAndUploadFileFromDevice,
  uploadUrlToDownloadUrl,
} from '../services/pickAndUploadImage';

const POST_ATTACHMENT_MARKER = '[[MOIJIA_POST_ATTACHMENTS]]';

function parseImageLine(trimmedLine: string): { alt: string; url: string } | null {
  const markdownMatch = trimmedLine.match(/^!\[(.*?)\]\(([^)\s]+)\)$/);
  if (markdownMatch) {
    return { alt: markdownMatch[1] || 'Image', url: markdownMatch[2] };
  }
  const plainUrlLike = /^[^\s]+$/.test(trimmedLine);
  if (!plainUrlLike) return null;
  const looksLikeImageUrl = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmedLine);
  if (looksLikeImageUrl) {
    return { alt: 'Image', url: trimmedLine };
  }
  return null;
}

function parseFileLine(trimmedLine: string): { name: string; url: string } | null {
  const m = trimmedLine.match(/^\[(.*?)\]\(([^)\s]+)\)$/);
  if (!m) return null;
  const url = m[2];
  if (!url) return null;
  return { name: m[1] || 'Attachment', url };
}

function parseAttachmentLines(block: string): {
  images: Array<{ alt: string; url: string }>;
  files: Array<{ name: string; url: string }>;
} {
  const images: Array<{ alt: string; url: string }> = [];
  const files: Array<{ name: string; url: string }> = [];
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const img = parseImageLine(trimmed);
    if (img) {
      images.push(img);
      continue;
    }
    const file = parseFileLine(trimmed);
    if (file) files.push(file);
  }
  return { images, files };
}

function splitStoredPostBody(body: string): {
  markdownSource: string;
  attachmentImages: Array<{ alt: string; url: string }>;
  attachmentFiles: Array<{ name: string; url: string }>;
} {
  const markerLine = POST_ATTACHMENT_MARKER;
  const markerSep = `\n${markerLine}\n`;

  if (body.startsWith(`${markerLine}\n`)) {
    const after = body.slice(markerLine.length + 1);
    const parsed = parseAttachmentLines(after);
    return { markdownSource: '', attachmentImages: parsed.images, attachmentFiles: parsed.files };
  }

  const idx = body.indexOf(markerSep);
  if (idx !== -1) {
    const markdownSource = body.slice(0, idx).trimEnd();
    const after = body.slice(idx + markerSep.length);
    const parsed = parseAttachmentLines(after);
    return { markdownSource, attachmentImages: parsed.images, attachmentFiles: parsed.files };
  }

  return { markdownSource: body, attachmentImages: [], attachmentFiles: [] };
}

function formatCreatedAt(value: string | number): string {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function mergeComposerBodyForApi(
  text: string,
  photoUrls: string[],
  fileAttachments: Array<{ name: string; url: string }> = []
): string {
  const t = text.trim();
  const photoLines = photoUrls.map((u) => `![](${u})`);
  const fileLines = fileAttachments.map((f) => {
    const safeName = (f.name || 'Attachment').replace(/\]/g, '');
    return `[${safeName}](${f.url})`;
  });
  const attachmentLines = [...photoLines, ...fileLines];
  const marker = POST_ATTACHMENT_MARKER;
  if (!t && attachmentLines.length === 0) return '';
  if (!t) return `${marker}\n${attachmentLines.join('\n')}`;
  if (attachmentLines.length === 0) return t;
  return `${t}\n\n${marker}\n${attachmentLines.join('\n')}`;
}

export function PostsListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId: currentUserId } = useCurrentUserContext();
  const scrollRef = useRef<ScrollView | null>(null);

  const { data: allGroups = [], refetch: refetchGroups } = useGroups(currentUserId ?? '');
  const { refetch: refetchNotifications } = useNotifications(currentUserId || '');
  const { data: groupColors = {}, refetch: refetchGroupColors } = useAllGroupMemberColors(
    currentUserId || ''
  );
  const { data: allUsers = [], refetch: refetchUsers } = useUsers();
  
  const groups = allGroups.filter(g => g.membershipStatus === 'member' || g.membershipStatus === 'admin');
  
  // Filter state
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // New post state
  const [newPostBody, setNewPostBody] = useState('');
  const [newPostInputKey, setNewPostInputKey] = useState(0);
  const [selectedGroupForPost, setSelectedGroupForPost] = useState<string | null>(null);
  const [showGroupSelectModal, setShowGroupSelectModal] = useState(false);
  const [newPostPhotoUrls, setNewPostPhotoUrls] = useState<string[]>([]);
  const [newPostFileAttachments, setNewPostFileAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<ForumPostImageLightboxState>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostBody, setEditPostBody] = useState('');
  const [editPostPhotoUrls, setEditPostPhotoUrls] = useState<string[]>([]);
  const [editPostFileAttachments, setEditPostFileAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [postMenuTarget, setPostMenuTarget] = useState<{
    postId: string;
    groupId: string;
    anchor: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const postMenuButtonRefs = useRef<Record<string, View | null>>({});
  const queryClient = useQueryClient();

  // Fetch posts from all groups
  const groupPostsQueries = groups.map(g => 
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useGroupPosts(g.id, currentUserId ?? '')
  );

  // Combine all posts from all groups
  const allPosts = useMemo(() => {
    const posts: (GroupPost & { groupId: string })[] = [];
    groups.forEach((group, index) => {
      const groupPosts = groupPostsQueries[index]?.data || [];
      groupPosts.forEach(post => {
        posts.push({ ...post, groupId: group.id });
      });
    });
    // Sort by creation date, newest first
    return posts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [groups, ...groupPostsQueries.map(q => q.data)]);

  const { refreshControl } = usePullToRefresh([
    refetchGroups,
    refetchNotifications,
    refetchGroupColors,
    refetchUsers,
    ...groupPostsQueries.map(q => q.refetch),
  ]);

  const filtered = useMemo(() => {
    return allPosts.filter(post => {
      if (!groups.some(g => g.id === post.groupId)) return false;
      if (selectedGroupIds.length > 0 && !selectedGroupIds.includes(post.groupId)) return false;
      return true;
    });
  }, [
    groups,
    selectedGroupIds,
    allPosts,
  ]);

  const usersById = useMemo(() => {
    const map = new Map();
    allUsers.forEach(u => map.set(u.id, u));
    return map;
  }, [allUsers]);

  const getUserDisplayName = useCallback((userId: string) => {
    const u = usersById.get(userId);
    return u?.displayName || u?.name || 'Unknown';
  }, [usersById]);

  const markdownStyles = useMemo(
    () => ({
      body: { color: Colors.text, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
      paragraph: { marginTop: 0, marginBottom: 0, color: Colors.text, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
      strong: { fontFamily: Fonts.semiBold },
      em: { fontStyle: 'italic' as const },
      link: { color: Colors.accent, textDecorationLine: 'underline' as const },
      heading1: { fontFamily: Fonts.semiBold, fontSize: 24, lineHeight: 30, marginTop: 0, marginBottom: 4, color: Colors.text },
      heading2: { fontFamily: Fonts.semiBold, fontSize: 20, lineHeight: 26, marginTop: 0, marginBottom: 4, color: Colors.text },
      heading3: { fontFamily: Fonts.semiBold, fontSize: 17, lineHeight: 23, marginTop: 0, marginBottom: 4, color: Colors.text },
      bullet_list: { marginTop: 0, marginBottom: 0 },
      ordered_list: { marginTop: 0, marginBottom: 0 },
      list_item: { marginTop: 0, marginBottom: 0 },
    }),
    []
  );

  const openGroupPost = useCallback((groupId: string, postId: string) => {
    router.push(`/(tabs)/groups/${groupId}/forum?postId=${encodeURIComponent(postId)}` as Href);
  }, [router]);

  const hasFilters = !!(selectedGroupIds.length);
  const postsLoading = groupPostsQueries.some(q => q.isLoading);
  
  const selectedGroup = groups.find(g => g.id === selectedGroupForPost);
  const selectedGroupTheme = selectedGroup
    ? getGroupColor(
        groupColors[selectedGroup.id] || getDefaultGroupThemeFromName(selectedGroup.name)
      )
    : null;

  const addComposerPhoto = useCallback((url: string, target: 'new' | 'edit') => {
    if (target === 'edit') setEditPostPhotoUrls((prev) => [...prev, url]);
    else setNewPostPhotoUrls((prev) => [...prev, url]);
  }, []);

  const uploadComposerPhoto = useCallback(async (target: 'new' | 'edit' = 'new') => {
    if (!currentUserId || isUploadingAttachment) return;
    try {
      setIsUploadingAttachment(true);
      const publicUrl = await pickAndUploadCoverPhoto(currentUserId);
      if (!publicUrl) return;
      addComposerPhoto(publicUrl, target);
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [addComposerPhoto, currentUserId, isUploadingAttachment]);

  const takePhotoAndAddComposerPhoto = useCallback(async (target: 'new' | 'edit' = 'new') => {
    if (!currentUserId || isUploadingAttachment) return;
    try {
      setIsUploadingAttachment(true);
      const publicUrl = await takeAndUploadCoverPhoto(currentUserId);
      if (!publicUrl) return;
      addComposerPhoto(publicUrl, target);
    } catch (e) {
      Alert.alert('Upload', e instanceof Error ? e.message : 'Could not upload photo');
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [addComposerPhoto, currentUserId, isUploadingAttachment]);

  const attachFileToComposer = useCallback(async (target: 'new' | 'edit' = 'new') => {
    if (!currentUserId || isUploadingAttachment) return;
    try {
      setIsUploadingAttachment(true);
      const uploaded = await pickAndUploadFileFromDevice(currentUserId);
      if (!uploaded?.publicUrl) return;
      const fileEntry = {
        name: uploaded.fileName || 'Attachment',
        url: uploadUrlToDownloadUrl(uploaded.publicUrl),
      };
      if (target === 'edit') setEditPostFileAttachments((prev) => [...prev, fileEntry]);
      else setNewPostFileAttachments((prev) => [...prev, fileEntry]);
    } catch (e) {
      if (e instanceof Error && e.message === 'cancelled') return;
      Alert.alert('Upload', e instanceof Error ? e.message : 'Could not attach file');
    } finally {
      setIsUploadingAttachment(false);
    }
  }, [currentUserId, isUploadingAttachment]);

  const canPost = (newPostBody.trim() || newPostPhotoUrls.length > 0 || newPostFileAttachments.length > 0) && selectedGroupForPost;

  // Create post mutation - dynamically created for selected group
  const createPostMutation = useCreateGroupPost(
    selectedGroupForPost || '',
    currentUserId || ''
  );

  // Helper function to generate IDs
  const generatePostId = () => {
    return `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  // Handler to create post
  const handleCreatePost = useCallback(async () => {
    if (!canPost || !selectedGroupForPost || !currentUserId) return;
    
    const body = mergeComposerBodyForApi(newPostBody, newPostPhotoUrls, newPostFileAttachments).trim();
    const title = newPostBody
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
      ?.slice(0, 80) || 'Post';

    try {
      await createPostMutation.mutateAsync({
        id: generatePostId(),
        userId: currentUserId,
        title,
        body,
      });
      
      // Reset state after successful creation
      setNewPostBody('');
      setNewPostPhotoUrls([]);
      setNewPostFileAttachments([]);
      setNewPostInputKey((k) => k + 1);
      setSelectedGroupForPost(null);
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  }, [canPost, selectedGroupForPost, currentUserId, newPostBody, newPostPhotoUrls, newPostFileAttachments, createPostMutation]);

  const invalidatePostsForGroup = useCallback((groupId: string) => {
    if (!currentUserId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.posts(groupId, currentUserId) });
  }, [currentUserId, queryClient]);

  const canManagePost = useCallback((post: { userId: string }) => {
    return !!currentUserId && post.userId === currentUserId;
  }, [currentUserId]);

  const openPostMenu = useCallback((post: GroupPost & { groupId: string }) => {
    const node = postMenuButtonRefs.current[post.id] as
      | (View & {
          measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
        })
      | null;
    node?.measureInWindow?.((x, y, width, height) => {
      setPostMenuTarget({ postId: post.id, groupId: post.groupId, anchor: { x, y, width, height } });
    });
  }, []);

  const beginEditPost = useCallback((post: GroupPost) => {
    const split = splitStoredPostBody(post.body || '');
    setEditingPostId(post.id);
    setEditPostBody(split.markdownSource);
    setEditPostPhotoUrls(split.attachmentImages.map((img) => img.url));
    setEditPostFileAttachments(split.attachmentFiles.map((f) => ({ name: f.name, url: f.url })));
    setPostMenuTarget(null);
  }, []);

  const cancelEditPost = useCallback(() => {
    setEditingPostId(null);
    setEditPostBody('');
    setEditPostPhotoUrls([]);
    setEditPostFileAttachments([]);
  }, []);

  const submitEditPost = useCallback(async (groupId: string) => {
    if (!editingPostId || !currentUserId) return;
    const body = mergeComposerBodyForApi(editPostBody, editPostPhotoUrls, editPostFileAttachments).trim();
    if (!body) return;
    const title =
      editPostBody
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean)
        ?.slice(0, 80) || 'Post';
    try {
      setEditSaving(true);
      await GroupsService.updateGroupPost(editingPostId, {
        userId: currentUserId,
        title,
        body,
      });
      invalidatePostsForGroup(groupId);
      cancelEditPost();
    } catch {
      if (Platform.OS === 'web') window.alert('Failed to update post');
      else Alert.alert('Error', 'Failed to update post');
    } finally {
      setEditSaving(false);
    }
  }, [cancelEditPost, currentUserId, editPostBody, editPostFileAttachments, editPostPhotoUrls, editingPostId, invalidatePostsForGroup]);

  const confirmDeletePost = useCallback((postId: string, groupId: string) => {
    const run = () => {
      if (!currentUserId) return;
      if (editingPostId === postId) cancelEditPost();
      void GroupsService.deleteGroupPost(postId, currentUserId)
        .then(() => invalidatePostsForGroup(groupId))
        .catch(() => {
          if (Platform.OS === 'web') window.alert('Failed to delete post');
          else Alert.alert('Error', 'Failed to delete post');
        });
    };
    const msg = 'Delete this post and all of its comments?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) run();
    } else {
      Alert.alert('Delete post?', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
    }
  }, [cancelEditPost, currentUserId, editingPostId, invalidatePostsForGroup]);

  const postMenuTargetPost = useMemo(
    () => (postMenuTarget ? filtered.find((p) => p.id === postMenuTarget.postId) ?? null : null),
    [filtered, postMenuTarget]
  );

  const postMenuPopoverLayout = useMemo(() => {
    if (!postMenuTarget) return null;
    const aw = Dimensions.get('window').width;
    const { anchor } = postMenuTarget;
    let left = anchor.x + anchor.width - COMMENT_THREAD_OPTIONS_MENU_WIDTH;
    left = Math.max(8, Math.min(left, aw - COMMENT_THREAD_OPTIONS_MENU_WIDTH - 8));
    const top = anchor.y + anchor.height + 4;
    return { left, top };
  }, [postMenuTarget]);

  const canEditMenuPost = !!(postMenuTargetPost && postMenuTargetPost.userId === currentUserId);
  const canDeleteMenuPost = !!(postMenuTargetPost && canManagePost(postMenuTargetPost));

  return (
    <View style={styles.safe}>
      {/* Filters container */}
      <View style={styles.filtersContainer}>
        {/* Group filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={{ gap: 6, paddingRight: 20 }}>
          <Pill
            label="All"
            selected={selectedGroupIds.length === 0}
            onPress={() => setSelectedGroupIds([])}
          />
          {groups.map(g => {
            const userColorHex = groupColors[g.id] || getDefaultGroupThemeFromName(g.name);
            const p = getGroupColor(userColorHex);
            const isSelected = selectedGroupIds.includes(g.id);
            return (
              <Pill
                key={g.id}
                label={g.name}
                selected={isSelected}
                activeColor={p.dot}
                activeBg={p.label}
                activeText={p.text}
                inactiveBorderColor={p.dot}
                onPress={() => {
                  const next = isSelected
                    ? selectedGroupIds.filter(id => id !== g.id)
                    : [...selectedGroupIds, g.id];
                  setSelectedGroupIds(next);
                }}
                onLongPress={() => setSelectedGroupIds([g.id])}
              />
            );
          })}
        </ScrollView>

        {/* Advanced filters toggle */}
        <View style={styles.filterPanel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 20, paddingVertical: 8 }}
          >
            <TouchableOpacity
              onPress={() => setShowAdvancedFilters(p => !p)}
              style={[styles.filterIconBtn, showAdvancedFilters && { borderColor: Colors.text, backgroundColor: Colors.text }]}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={showAdvancedFilters ? Colors.surface : Colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </Svg>
            </TouchableOpacity>
          </ScrollView>

          {showAdvancedFilters && (
            <View style={styles.filterExpandedRow}>
              <Text style={styles.filterExpandedHeader}>SORT BY</Text>
              <Pill label="Newest" selected onPress={() => {}} />
              <Pill label="Most Reactions" selected={false} onPress={() => {}} />
              <Pill label="Most Comments" selected={false} onPress={() => {}} />
            </View>
          )}
        </View>
      </View>

      {/* Posts content */}
      <View style={styles.postsContent}>
        <KeyboardSafeScrollView
          ref={(node) => {
            scrollRef.current = node;
          }}
          contentContainerStyle={styles.scrollContent}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {/* New post composer */}
          <View style={styles.card}>
            <View style={styles.cardPad}>
              <Text style={[formSectionTitleStyle, { marginBottom: 8 }]}>
                GROUP <Text style={{ color: Colors.notGoing }}>*</Text>
              </Text>
              {selectedGroup && selectedGroupTheme ? (
                <View
                  style={[
                    styles.selectedGroupRow,
                    {
                      backgroundColor: selectedGroupTheme.row,
                      borderColor: selectedGroupTheme.dot,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.groupAvatarWrap,
                      {
                        backgroundColor: selectedGroupTheme.cal,
                      },
                    ]}
                  >
                    <GroupAvatar
                      seed={selectedGroup.avatarSeed}
                      thumbnail={selectedGroup.thumbnail}
                      name={selectedGroup.name}
                      size={36}
                    />
                  </View>
                  <Text
                    style={[styles.selectedGroupName, { color: selectedGroupTheme.text }]}
                    numberOfLines={1}
                  >
                    {selectedGroup.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowGroupSelectModal(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Change group"
                  >
                    <Text style={[styles.changeGroupLink, { color: selectedGroupTheme.text }]}>
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.selectGroupButton}
                  onPress={() => setShowGroupSelectModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people-outline" size={20} color={Colors.textSub} />
                  <Text style={styles.selectGroupButtonText}>Select a group</Text>
                  <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
              <TextInput
                key={`new-post-${newPostInputKey}`}
                value={newPostBody}
                onChangeText={setNewPostBody}
                placeholder="Write your post - use markdown for advanced formatting"
                placeholderTextColor={Colors.textMuted}
                style={styles.bodyInput}
                multiline
                textAlignVertical="top"
              />
              {newPostPhotoUrls.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.composerPhotosScroll}
                  contentContainerStyle={styles.composerPhotosScrollContent}
                >
                  {newPostPhotoUrls.map((uri, i) => (
                    <View key={`${uri}-${i}`} style={styles.composerPhotoThumbWrap}>
                      <TouchableOpacity
                        onPress={() => setImageLightbox({ urls: newPostPhotoUrls, index: i })}
                        activeOpacity={0.9}
                      >
                        <ResolvableImage storedUrl={uri} style={styles.composerPhotoThumb} resizeMode="cover" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setNewPostPhotoUrls((prev) => prev.filter((_, idx) => idx !== i))}
                        style={styles.composerPhotoRemoveBtn}
                        accessibilityLabel="Remove photo"
                      >
                        <Ionicons name="close" size={11} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
              {newPostFileAttachments.length > 0 ? (
                <View style={styles.composerFileChipsList}>
                  {newPostFileAttachments.map((file, i) => (
                    <View key={`${file.url}-${i}`} style={styles.composerFileChip}>
                      <Ionicons
                        name="document-outline"
                        size={14}
                        color={Colors.textSub}
                        style={styles.composerFileChipIcon}
                      />
                      <Text style={styles.composerFileChipText} numberOfLines={1}>
                        {file.name || 'Attachment'}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setNewPostFileAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityLabel="Remove attached file"
                        style={styles.composerFileChipRemove}
                      >
                        <Ionicons name="close" size={12} color={Colors.textSub} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.composerToolbar}>
                <View style={styles.composerActions}>
                  <AddImageButton
                    iconOnly
                    label="Add photo"
                    triggerIconName="camera-outline"
                    optionsModalTitle="Add photo"
                    linkModalTitle="Photo URL"
                    disabled={isUploadingAttachment}
                    busy={isUploadingAttachment}
                    onTakePhoto={() => void takePhotoAndAddComposerPhoto()}
                    onChooseFromLibrary={() => void uploadComposerPhoto()}
                    onInsertLink={async (url) => {
                      setNewPostPhotoUrls((prev) => [...prev, url.trim()]);
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.composerIconBtn, isUploadingAttachment && styles.postBtnDisabled]}
                    onPress={() => void attachFileToComposer()}
                    disabled={isUploadingAttachment}
                    accessibilityLabel="Attach file"
                  >
                    <Ionicons name="attach-outline" size={16} color={Colors.textSub} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.postBtn, (!canPost || createPostMutation.isPending) && styles.postBtnDisabled]}
                  disabled={!canPost || createPostMutation.isPending}
                  onPress={handleCreatePost}
                >
                  <Text style={[styles.postBtnText, (!canPost || createPostMutation.isPending) && styles.postBtnTextDisabled]}>
                    {createPostMutation.isPending ? 'Posting...' : 'Post'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>POSTS</Text>
          
          {postsLoading ? (
            <View style={styles.card}>
              <View style={styles.cardPad}>
                <ActivityIndicator color={Colors.textSub} />
              </View>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.cardPad}>
                <Text style={styles.emptyText}>
                  {hasFilters ? 'No posts match your filters' : 'No posts yet'}
                </Text>
              </View>
            </View>
          ) : (
            filtered.map((post) => {
              const group = groups.find(g => g.id === post.groupId);
              const userColorHex = groupColors[post.groupId] || getDefaultGroupThemeFromName(group?.name || '');
              const p = getGroupColor(userColorHex);
              const postOwner = usersById.get(post.userId);
              const { markdownSource, attachmentImages, attachmentFiles } =
                splitStoredPostBody(post.body || '');
              const joined = markdownSource.trim();
              const isEditing = editingPostId === post.id;
              const canManage = canManagePost(post);
              
              return (
                <View key={post.id} style={[styles.card, { marginBottom: 14 }]}>
                  <View style={styles.cardPad}>
                    <View style={styles.postMetaHeaderRow}>
                      <View style={styles.postMetaTitleColumn}>
                        <View style={styles.postMetaAuthorRow}>
                          <UserAvatar
                            seed={getUserDisplayName(post.userId)}
                            backgroundColor={[postOwner?.avatarSeed ?? '']}
                            thumbnail={postOwner?.thumbnail}
                            size={18}
                          />
                          <Text style={[styles.metaText, styles.postMetaTextGrow]} numberOfLines={1}>
                            {post.userId === currentUserId ? (
                              <Text style={[styles.metaText, styles.metaPostMe]}>{getUserDisplayName(post.userId)}</Text>
                            ) : (
                              getUserDisplayName(post.userId)
                            )}
                            {post.userId === currentUserId ? (
                              <Text style={[styles.metaText, styles.metaPostMe]}> (me)</Text>
                            ) : null}{' '}
                            · {formatCreatedAt(post.createdAt)}
                          </Text>
                        </View>
                        <View style={styles.postGroupBadge}>
                          <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
                          <Text style={styles.postGroupName} numberOfLines={1}>
                            {group?.name || 'Unknown'}
                          </Text>
                          <View style={[styles.postGroupDot, { backgroundColor: p.dot }]} />
                        </View>
                      </View>
                      {canManage ? (
                        <TouchableOpacity
                          ref={(node) => {
                            postMenuButtonRefs.current[post.id] = node;
                          }}
                          onPress={() => openPostMenu(post)}
                          style={styles.postMenuBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Post options"
                        >
                          <Ionicons name="ellipsis-vertical" size={18} color={Colors.textSub} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {isEditing ? (
                      <>
                        <View style={styles.forumDraftBar}>
                          <Text style={styles.forumDraftBarHint}>Editing post</Text>
                          <TouchableOpacity
                            onPress={cancelEditPost}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Discard draft"
                          >
                            <Text style={styles.forumDraftBarDiscard}>Discard</Text>
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          value={editPostBody}
                          onChangeText={setEditPostBody}
                          placeholder="Write your post - use markdown for advanced formatting"
                          placeholderTextColor={Colors.textMuted}
                          style={styles.bodyInput}
                          multiline
                          textAlignVertical="top"
                        />
                        {editPostPhotoUrls.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.composerPhotosScroll}
                            contentContainerStyle={styles.composerPhotosScrollContent}
                          >
                            {editPostPhotoUrls.map((uri, i) => (
                              <View key={`${uri}-${i}`} style={styles.composerPhotoThumbWrap}>
                                <TouchableOpacity
                                  onPress={() =>
                                    setImageLightbox({
                                      urls: editPostPhotoUrls,
                                      index: i,
                                      alts: editPostPhotoUrls.map(() => ''),
                                      ownerName: getUserDisplayName(post.userId),
                                      ownerAvatarSeed: postOwner?.avatarSeed ?? null,
                                      ownerThumbnail: postOwner?.thumbnail ?? null,
                                    })
                                  }
                                  activeOpacity={0.9}
                                >
                                  <ResolvableImage storedUrl={uri} style={styles.composerPhotoThumb} resizeMode="cover" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => setEditPostPhotoUrls((prev) => prev.filter((_, idx) => idx !== i))}
                                  style={styles.composerPhotoRemoveBtn}
                                  accessibilityLabel="Remove photo"
                                >
                                  <Ionicons name="close" size={11} color="#fff" />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </ScrollView>
                        ) : null}
                        {editPostFileAttachments.length > 0 ? (
                          <View style={styles.composerFileChipsList}>
                            {editPostFileAttachments.map((file, i) => (
                              <View key={`${file.url}-${i}`} style={styles.composerFileChip}>
                                <Ionicons
                                  name="document-outline"
                                  size={14}
                                  color={Colors.textSub}
                                  style={styles.composerFileChipIcon}
                                />
                                <Text style={styles.composerFileChipText} numberOfLines={1}>
                                  {file.name || 'Attachment'}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => setEditPostFileAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  accessibilityLabel="Remove attached file"
                                  style={styles.composerFileChipRemove}
                                >
                                  <Ionicons name="close" size={12} color={Colors.textSub} />
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        ) : null}
                        <View style={styles.composerToolbar}>
                          <View style={styles.composerActions}>
                            <AddImageButton
                              iconOnly
                              label="Add photo"
                              triggerIconName="camera-outline"
                              optionsModalTitle="Add photo"
                              linkModalTitle="Photo URL"
                              disabled={isUploadingAttachment}
                              busy={isUploadingAttachment}
                              onTakePhoto={() => void takePhotoAndAddComposerPhoto('edit')}
                              onChooseFromLibrary={() => void uploadComposerPhoto('edit')}
                              onInsertLink={async (url) => {
                                addComposerPhoto(url.trim(), 'edit');
                              }}
                            />
                            <TouchableOpacity
                              style={[styles.composerIconBtn, isUploadingAttachment && styles.postBtnDisabled]}
                              onPress={() => void attachFileToComposer('edit')}
                              disabled={isUploadingAttachment}
                              accessibilityLabel="Attach file"
                            >
                              <Ionicons name="attach-outline" size={16} color={Colors.textSub} />
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.postBtn,
                              (!(editPostBody.trim() || editPostPhotoUrls.length || editPostFileAttachments.length) || editSaving) &&
                                styles.postBtnDisabled,
                            ]}
                            disabled={
                              !(editPostBody.trim() || editPostPhotoUrls.length || editPostFileAttachments.length) ||
                              editSaving
                            }
                            onPress={() => void submitEditPost(post.groupId)}
                          >
                            {editSaving ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.postBtnText}>Save changes</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : joined ? (
                      <ForumPostMarkdownBody
                        markdownBody={joined}
                        markdownStyles={markdownStyles}
                        posterDisplayName={getUserDisplayName(post.userId)}
                        ownerAvatarSeed={postOwner?.avatarSeed ?? null}
                        ownerThumbnail={postOwner?.thumbnail ?? null}
                        setImageLightbox={setImageLightbox}
                      />
                    ) : null}
                    {!isEditing && attachmentImages.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.postAttachmentPhotosScroll}
                        contentContainerStyle={styles.composerPhotosScrollContent}
                      >
                        {attachmentImages.map((image, idx) => (
                          <View key={`${post.id}-att-${idx}`} style={styles.composerPhotoThumbWrap}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() =>
                                setImageLightbox({
                                  urls: attachmentImages.map((img) => img.url),
                                  index: idx,
                                  alts: attachmentImages.map((img) => img.alt || ''),
                                  ownerName: getUserDisplayName(post.userId),
                                  ownerAvatarSeed: postOwner?.avatarSeed ?? null,
                                  ownerThumbnail: postOwner?.thumbnail ?? null,
                                })
                              }
                            >
                              <ResolvableImage
                                storedUrl={image.url}
                                style={styles.composerPhotoThumb}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                    ) : null}
                    {!isEditing && attachmentFiles.length > 0 ? (
                      <View style={styles.postAttachmentFilesList}>
                        {attachmentFiles.map((file, idx) => (
                          <TouchableOpacity
                            key={`${post.id}-file-${idx}`}
                            style={styles.postAttachmentFileLink}
                            activeOpacity={0.7}
                            onPress={() => Linking.openURL(uploadUrlToDownloadUrl(file.url))}
                            accessibilityRole="link"
                            accessibilityLabel={`Open attached file ${file.name || 'Attachment'}`}
                          >
                            <Ionicons
                              name="document-outline"
                              size={14}
                              color={Colors.accent}
                              style={styles.postAttachmentFileIcon}
                            />
                            <Text
                              style={styles.postAttachmentFileText}
                              numberOfLines={1}
                              ellipsizeMode="middle"
                            >
                              {file.name || 'Attachment'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    {post.reactions?.length > 0 ? (
                      <View style={styles.reactionRow}>
                        {post.reactions.map((entry) => (
                          <View key={`${post.id}-existing-${entry.emoji}`} style={styles.reactionBtn}>
                            <Text style={styles.reactionLabel}>
                              {entry.emoji} {entry.count}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.reactionRow}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => openGroupPost(post.groupId, post.id)}
                        accessibilityLabel="Add reaction"
                        activeOpacity={0.75}
                      >
                        <Ionicons name="happy-outline" size={15} color={Colors.textSub} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => openGroupPost(post.groupId, post.id)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="chatbubble-outline" size={15} color={Colors.textSub} />
                        <Text style={styles.iconActionText}>
                          Comments ({post.comments?.length || 0})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </KeyboardSafeScrollView>
      </View>

      {/* Group selection modal */}
      <Modal
        visible={showGroupSelectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupSelectModal(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowGroupSelectModal(false)}
          />
          <View style={styles.modalCardOuter}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose group</Text>
                <TouchableOpacity
                  onPress={() => setShowGroupSelectModal(false)}
                  style={styles.modalClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalSubtitle}>Which group is this post for?</Text>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {groups.map((group) => {
                    const userColorHex = groupColors[group.id] || getDefaultGroupThemeFromName(group.name);
                    const p = getGroupColor(userColorHex);
                    
                    return (
                      <TouchableOpacity
                        key={group.id}
                        style={styles.modalGroupRow}
                        onPress={() => {
                          setSelectedGroupForPost(group.id);
                          setShowGroupSelectModal(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.modalGroupAvatarWrap, { backgroundColor: p.cal }]}>
                          <GroupAvatar
                            seed={group.avatarSeed}
                            thumbnail={group.thumbnail}
                            name={group.name}
                            size={44}
                          />
                        </View>
                        <View style={styles.modalGroupTextCol}>
                          <Text style={styles.modalGroupName}>{group.name}</Text>
                          {group.memberCount != null ? (
                            <Text style={styles.modalGroupMeta}>
                              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {postMenuTarget && postMenuPopoverLayout && (canEditMenuPost || canDeleteMenuPost) ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPostMenuTarget(null)}
        >
          <View style={styles.postOptionsModalRoot} pointerEvents="box-none">
            <Pressable
              style={styles.postOptionsDismiss}
              onPress={() => setPostMenuTarget(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss menu"
            />
            <View
              style={[
                styles.postOptionsPopoverWrap,
                {
                  left: postMenuPopoverLayout.left,
                  top: postMenuPopoverLayout.top,
                  width: COMMENT_THREAD_OPTIONS_MENU_WIDTH,
                },
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.postOptionsCard}>
                {canEditMenuPost ? (
                  <TouchableOpacity
                    style={[styles.postOptionsRow, !canDeleteMenuPost && styles.postOptionsRowLast]}
                    onPress={() => {
                      setPostMenuTarget(null);
                      if (postMenuTargetPost) beginEditPost(postMenuTargetPost);
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.text} />
                    <Text style={styles.postOptionsLabel}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
                {canDeleteMenuPost ? (
                  <TouchableOpacity
                    style={[styles.postOptionsRow, styles.postOptionsRowLast]}
                    onPress={() => {
                      const { postId, groupId } = postMenuTarget;
                      setPostMenuTarget(null);
                      confirmDeletePost(postId, groupId);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.notGoing} />
                    <Text style={[styles.postOptionsLabel, styles.postOptionsLabelDanger]}>Delete</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <ImageLightboxModal
        visible={imageLightbox !== null}
        urls={imageLightbox?.urls ?? []}
        index={imageLightbox?.index ?? 0}
        onChangeIndex={(nextIndex) =>
          setImageLightbox((prev) => (prev ? { ...prev, index: nextIndex } : prev))
        }
        onClose={() => setImageLightbox(null)}
        headerAvatar={
          imageLightbox ? (
            <UserAvatar
              seed={imageLightbox.ownerName || 'Image'}
              backgroundColor={[imageLightbox.ownerAvatarSeed ?? '']}
              thumbnail={imageLightbox.ownerThumbnail ?? null}
              size={28}
            />
          ) : undefined
        }
        title={imageLightbox?.ownerName}
        subtitle={
          imageLightbox
            ? imageLightbox.urls.length > 1
              ? `${
                  (imageLightbox.alts?.[imageLightbox.index] || '').trim() || 'Image'
                } · ${imageLightbox.index + 1} of ${imageLightbox.urls.length}`
              : (imageLightbox.alts?.[imageLightbox.index] || '').trim() || 'Image'
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  filtersContainer: { 
    backgroundColor: Colors.surface, 
    borderBottomWidth: 1, 
    borderBottomColor: Colors.border,
  },
  pillsRow: { 
    flexGrow: 0, 
    paddingLeft: 20, 
    paddingVertical: 8,
  },
  filterPanel: { paddingBottom: 6 },
  filterIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterExpandedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.bg,
  },
  filterExpandedHeader: {
    width: '100%',
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  postsContent: { 
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
  },
  cardPad: {
    padding: 14,
  },
  selectGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    marginBottom: 12,
  },
  selectGroupButtonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
  },
  selectedGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: 12,
  },
  groupAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectedGroupName: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  changeGroupLink: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  bodyInput: {
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  composerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 6,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerIconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    borderRadius: 9,
  },
  composerPhotosScroll: {
    marginTop: 12,
    marginBottom: 8,
  },
  composerPhotosScrollContent: {
    gap: 4,
    paddingVertical: 4,
  },
  composerPhotoThumbWrap: {
    position: 'relative',
  },
  composerPhotoThumb: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  composerPhotoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerFileChipsList: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  composerFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  composerFileChipIcon: {
    flexShrink: 0,
  },
  composerFileChipText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.text,
    flexShrink: 1,
  },
  composerFileChipRemove: {
    marginLeft: 4,
    flexShrink: 0,
  },
  postBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
  },
  postBtnDisabled: {
    opacity: 0.45,
  },
  postBtnText: {
    color: '#fff',
    fontFamily: Fonts.semiBold,
    fontSize: 13,
  },
  postBtnTextDisabled: {
    color: Colors.textMuted,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  emptyText: {
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  postMetaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  postMetaTitleColumn: {
    flex: 1,
    minWidth: 0,
  },
  postMetaAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  metaText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  metaPostMe: {
    color: Colors.going,
    fontFamily: Fonts.semiBold,
  },
  postMetaTextGrow: {
    flex: 1,
    marginBottom: 0,
  },
  postMenuBtn: { padding: 2, marginTop: -2 },
  forumDraftBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.bg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  forumDraftBarHint: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, flex: 1, marginRight: 8 },
  forumDraftBarDiscard: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.notGoing },
  postOptionsModalRoot: { flex: 1 },
  postOptionsDismiss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  postOptionsPopoverWrap: {
    position: 'absolute',
    zIndex: 20,
    elevation: 20,
  },
  postOptionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    ...Shadows.lg,
  },
  postOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  postOptionsRowLast: { borderBottomWidth: 0 },
  postOptionsLabel: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.text, flex: 1 },
  postOptionsLabelDanger: { color: Colors.notGoing },
  postGroupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  postGroupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  postGroupName: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    flexShrink: 1,
  },
  postAttachmentPhotosScroll: {
    marginTop: 8,
    marginBottom: 8,
  },
  postAttachmentFilesList: {
    marginTop: 6,
    marginBottom: 8,
    gap: 6,
  },
  postAttachmentFileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  postAttachmentFileIcon: {
    flexShrink: 0,
  },
  postAttachmentFileText: {
    flexShrink: 1,
    color: Colors.accent,
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textDecorationLine: 'underline',
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  reactionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  reactionLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  iconActionText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCardOuter: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: Colors.text,
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    paddingTop: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSub,
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalScrollContent: {
    gap: 8,
  },
  modalGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
  },
  modalGroupAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  modalGroupTextCol: {
    flex: 1,
    minWidth: 0,
  },
  modalGroupName: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 2,
  },
  modalGroupMeta: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
});
