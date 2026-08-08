import { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Linking,
  ActivityIndicator,
  Pressable,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { type Href } from 'expo-router';
import { useAppRouter as useRouter } from '../hooks/useAppRouter';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { Colors, Fonts, Radius, Shadows } from '../constants/theme';
import { KeyboardSafeScrollView } from './KeyboardSafeScrollView';
import { COMMENT_REACTION_EMOJIS } from '../constants/commentReactionEmojis';
import { DEFAULT_COMMENT_QUICK_REACTIONS_LIST } from '../utils/commentQuickReactionsPrefs';
import { ReactionEmojiGlyph } from './ReactionEmojiGlyph';
import { useCommentQuickReactions } from '../hooks/useCommentQuickReactions';
import { useCurrentUserContext } from '../contexts/CurrentUserContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import {
  useGroup,
  useGroupPosts,
  useUsers,
  useCreateGroupPost,
  useUpdateGroupPost,
  useDeleteGroupPost,
  useToggleGroupPostReaction,
  useCreateGroupPostComment,
  useToggleGroupPostCommentReaction,
  useUpdateGroupPostComment,
  useDeleteGroupPostComment,
} from '../hooks/api';
import { EmojiBar } from './EmojiBar';
import { UserAvatar } from './UserAvatar';
import {
  COMMENT_THREAD_OPTIONS_MENU_WIDTH,
  ThreadedCommentsSection,
  type ThreadComment,
} from './ThreadedCommentsSection';
import { ResolvableImage } from './ResolvableImage';
import { ImageLightboxModal } from './ImageLightboxModal';
import { AddImageButton } from './AddImageButton';
import { type GroupPost, type GroupPostComment, type GroupScoped } from '@moijia/client';
import { CommentMentionInput } from './CommentMentionInput';
import { MentionText } from './MentionText';
import {
  computeMentionUserIdsForPost,
  type MentionMemberRow,
} from '../utils/mentionUtils';
import { createScrollAboveKeyboardOnFocus } from '../utils/scrollInputAboveKeyboard';
import {
  pickAndUploadCoverPhoto,
  takeAndUploadCoverPhoto,
  pickAndUploadFileFromDevice,
  uploadUrlToDownloadUrl,
  type CoverPhotoDraft,
  type PickedFileAsset,
  coverPhotoDraftDisplayUri,
  pickDeferredCoverPhotoNative,
  pickDeferredCoverPhotoFromCamera,
  pickFileFromDevice,
  revokeCoverPhotoDraftPreview,
  uploadCoverPhotoDrafts,
  uploadPickedFileAsset,
} from '../services/pickAndUploadImage';
import {
  loadForumGroupDraft,
  saveForumGroupDraft,
  type ForumGroupDraftV1,
  type ForumPostFileAttachment,
} from '../utils/forumPostDrafts';

export type GroupForumViewProps = {
  groupId: string;
  /** Deep-link from mention notification — scroll to this post. */
  focusPostId?: string;
  /** When set with focusPostId, expand comments and highlight this comment. */
  focusCommentId?: string;
};

type ForumPostImageLightboxState = {
  urls: string[];
  index: number;
  alts?: string[];
  ownerName?: string;
  ownerAvatarSeed?: string | null;
  ownerThumbnail?: string | null;
} | null;

type ForumComposerChannel = 'new' | 'edit';

function forumId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function mapGroupCommentsToThread(comments: GroupPostComment[]): ThreadComment[] {
  return comments.map((c) => ({
    id: c.id,
    userId: c.userId,
    body: c.body,
    parentCommentId: c.parentCommentId ?? null,
    createdAt: c.createdAt,
    reactions: c.reactions,
  }));
}

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

function wrapBareUrlsWithMarkdown(text: string): string {
  return text.replace(/(^|[\s\n])(https?:\/\/[^\s)]+)(?=$|[\s\n])/gi, (_match, prefix, rawUrl) => {
    const url = rawUrl.trim();
    const isAlreadyMarkdown = /\]\([^)]+\)$/.test(prefix + url);
    if (isAlreadyMarkdown) return `${prefix}${url}`;
    const isImageUrl = /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
    if (isImageUrl) return `${prefix}![Image](${url})`;
    return `${prefix}[${url}](${url})`;
  });
}

/** Separates composer “Add photo” URLs from markdown source (inline images stay in markdown). */
const POST_ATTACHMENT_MARKER = '[[MOIJIA_POST_ATTACHMENTS]]';

/** Collapsed preview clips to this height; “Read more” when full laid-out body is taller (px). */
const POST_BODY_PREVIEW_MAX_HEIGHT = 250;

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

/**
 * Markdown body + carousel attachments only after [[MOIJIA_POST_ATTACHMENTS]].
 * Bodies without that marker are rendered entirely as markdown (standalone `![](url)` lines stay in the body so image sizing matches inline images).
 */
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

/** Stored body text + marker + attachment lines for API (composer keeps Add-photo URLs out of the editor field). */
function normalizeForumStoredBody(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
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

function mergeCommentBodyForApi(text: string, photoUrls: string[]): string {
  const t = text.trim();
  const photoLines = photoUrls.map((u) => `![](${u})`);
  if (!t && photoLines.length === 0) return '';
  if (!t) return photoLines.join('\n');
  if (photoLines.length === 0) return t;
  return `${t}\n\n${photoLines.join('\n')}`;
}

function appendMarkdownLink(text: string, fileName: string, url: string): string {
  const safeName = (fileName || 'Attachment').replace(/\]/g, '');
  const suffix = `[${safeName}](${url})`;
  const base = text.trimEnd();
  return base ? `${base}\n\n${suffix}` : suffix;
}

function postEditDiffersFromPublished(
  publishedBody: string,
  markdown: string,
  photos: string[],
  files: Array<{ name: string; url: string }>
): boolean {
  const merged = normalizeForumStoredBody(mergeComposerBodyForApi(markdown, photos, files));
  const original = normalizeForumStoredBody(publishedBody);
  return merged !== original;
}

export function GroupForumView({ groupId, focusPostId, focusCommentId }: GroupForumViewProps) {
  const router = useRouter();
  const { userId: currentUserId } = useCurrentUserContext();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollViewportYRef = useRef(0);
  const scrollOffsetYRef = useRef(0);
  const newPostComposerRef = useRef<View>(null);
  const editPostComposerRef = useRef<View>(null);
  const scrollNewPostComposerIntoView = useMemo(
    () =>
      createScrollAboveKeyboardOnFocus({
        scrollRef,
        scrollOffsetYRef,
        targetRef: newPostComposerRef,
      }),
    []
  );
  const scrollEditPostComposerIntoView = useMemo(
    () =>
      createScrollAboveKeyboardOnFocus({
        scrollRef,
        scrollOffsetYRef,
        targetRef: editPostComposerRef,
      }),
    []
  );
  const postTopByIdRef = useRef<Record<string, number>>({});
  /** After hiding the top composer, scroll once the edited post has laid out at its new offset. */
  const pendingScrollToEditPostIdRef = useRef<string | null>(null);
  /** Scroll to post from mention notification deep link. */
  const pendingScrollToFocusPostIdRef = useRef<string | null>(null);
  /** Persisted edit drafts per post id (survives reloads). */
  const postEditsRef = useRef<ForumGroupDraftV1['postEdits']>({});
  const editingPostIdRef = useRef<string | null>(null);
  const [forumDraftsReady, setForumDraftsReady] = useState(false);
  /** Bumped whenever `postEditsRef` changes so draft badges can recompute (refs don’t rerender). */
  const [draftBadgeTick, setDraftBadgeTick] = useState(0);
  const bumpDraftBadgeTick = useCallback(() => setDraftBadgeTick((n) => n + 1), []);
  /** Inline edit draft when `editingPostId` is set. */
  const [postBody, setPostBody] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  /** Top “new post” composer — independent of inline edit state. */
  const [newPostBody, setNewPostBody] = useState('');
  const [postMenuTarget, setPostMenuTarget] = useState<{
    postId: string;
    anchor: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const postMenuButtonRefs = useRef<Record<string, View | null>>({});
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [composerPhotoUrls, setComposerPhotoUrls] = useState<string[]>([]);
  const [newPostPhotoUrls, setNewPostPhotoUrls] = useState<string[]>([]);
  const [composerFileAttachments, setComposerFileAttachments] = useState<ForumPostFileAttachment[]>([]);
  const [newPostFileAttachments, setNewPostFileAttachments] = useState<ForumPostFileAttachment[]>([]);
  /** Remount TextInput after clear so grown multiline height resets to minHeight. */
  const [newPostInputKey, setNewPostInputKey] = useState(0);
  const [composerSelection, setComposerSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [newPostSelection, setNewPostSelection] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [composerLinkPopover, setComposerLinkPopover] = useState<{
    mode: 'link' | 'image';
    text: string;
    url: string;
    replaceStart?: number;
    replaceEnd?: number;
    channel: ForumComposerChannel;
  } | null>(null);
  const [expandedPostBodyById, setExpandedPostBodyById] = useState<Record<string, boolean>>({});
  /** Natural size of rendered markdown (uncollapsed pass); used to collapse tall posts into a square preview. */
  const [postMarkdownMeasureById, setPostMarkdownMeasureById] = useState<
    Record<string, { w: number; h: number; bodyKey: string }>
  >({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});
  const [draftCommentPhotoDraftsByPost, setDraftCommentPhotoDraftsByPost] = useState<
    Record<string, CoverPhotoDraft[]>
  >({});
  const [draftCommentPendingFilesByPost, setDraftCommentPendingFilesByPost] = useState<
    Record<string, Array<{ id: string; name: string; asset: PickedFileAsset }>>
  >({});
  const [uploadingCommentPhotoPostId, setUploadingCommentPhotoPostId] = useState<string | null>(null);
  const [replyTargetByPost, setReplyTargetByPost] = useState<Record<string, string | null>>({});
  const [expandedCommentsByPost, setExpandedCommentsByPost] = useState<Record<string, boolean>>({});
  const [reactionQuickPickerTarget, setReactionQuickPickerTarget] = useState<
    { kind: 'post' | 'comment'; id: string } | null
  >(null);
  const [reactionQuickPickerAnchor, setReactionQuickPickerAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [reactionPickerTarget, setReactionPickerTarget] = useState<
    { kind: 'post' | 'comment'; id: string } | null
  >(null);
  const [reactionDetailModal, setReactionDetailModal] = useState<{
    emoji: string;
    userIds: string[];
  } | null>(null);
  const [imageLightbox, setImageLightbox] = useState<ForumPostImageLightboxState>(null);
  const reactionButtonRefs = useRef<Record<string, View | null>>({});
  const [commentEdit, setCommentEdit] = useState<{ postId: string; commentId: string } | null>(null);
  const [commentEditText, setCommentEditText] = useState('');
  /** Draft reply parent while editing; `null` = top-level comment. */
  const [commentEditParentId, setCommentEditParentId] = useState<string | null>(null);

  const { data: group, isError, refetch: refetchGroup } = useGroup(groupId, currentUserId ?? '');
  const { data: allUsers = [], refetch: refetchUsers } = useUsers();
  const { data: posts = [], isLoading: postsLoading, refetch: refetchPosts } = useGroupPosts(
    groupId,
    currentUserId ?? ''
  );
  const { refreshControl } = usePullToRefresh([refetchGroup, refetchUsers, refetchPosts]);
  const createPostMutation = useCreateGroupPost(groupId, currentUserId ?? '');
  const updatePostMutation = useUpdateGroupPost(groupId, currentUserId ?? '');
  const deletePostMutation = useDeleteGroupPost(groupId, currentUserId ?? '');
  const togglePostReactionMutation = useToggleGroupPostReaction(groupId, currentUserId ?? '');
  const createCommentMutation = useCreateGroupPostComment(groupId, currentUserId ?? '');
  const toggleCommentReactionMutation = useToggleGroupPostCommentReaction(groupId, currentUserId ?? '');
  const updateCommentMutation = useUpdateGroupPostComment(groupId, currentUserId ?? '');
  const deleteCommentMutation = useDeleteGroupPostComment(groupId, currentUserId ?? '');
  const { data: commentQuickReactions = [...DEFAULT_COMMENT_QUICK_REACTIONS_LIST] } =
    useCommentQuickReactions(currentUserId);

  useEffect(() => {
    if (isError || (group && group.membershipStatus === 'none')) {
      router.replace('/(tabs)/groups');
    }
  }, [group, isError, router]);

  useEffect(() => {
    if (group?.membershipStatus === 'pending') {
      router.replace(`/(tabs)/groups/${groupId}` as Href);
    }
  }, [group?.membershipStatus, groupId, router]);

  useEffect(() => {
    if (!focusPostId) return;
    pendingScrollToFocusPostIdRef.current = focusPostId;
    if (focusCommentId) {
      setExpandedCommentsByPost((prev) => ({ ...prev, [focusPostId]: true }));
    }
  }, [focusPostId, focusCommentId]);

  useEffect(() => {
    editingPostIdRef.current = editingPostId;
  }, [editingPostId]);

  useEffect(() => {
    if (!currentUserId) {
      setForumDraftsReady(false);
      return;
    }
    let cancelled = false;
    setForumDraftsReady(false);
    pendingScrollToEditPostIdRef.current = null;
    setEditingPostId(null);
    setPostBody('');
    setComposerPhotoUrls([]);
    setComposerFileAttachments([]);
    setComposerSelection({ start: 0, end: 0 });
    (async () => {
      const loaded = await loadForumGroupDraft(currentUserId, groupId);
      if (cancelled) return;
      postEditsRef.current = loaded?.postEdits ? { ...loaded.postEdits } : {};
      setNewPostBody(loaded?.newPost?.markdown ?? '');
      setNewPostPhotoUrls(Array.isArray(loaded?.newPost?.photos) ? [...loaded.newPost.photos] : []);
      setNewPostFileAttachments(
        Array.isArray(loaded?.newPost?.files) ? [...(loaded.newPost.files ?? [])] : []
      );
      setNewPostSelection({ start: 0, end: 0 });
      setForumDraftsReady(true);
      bumpDraftBadgeTick();
    })();
    return () => {
      cancelled = true;
    };
  }, [bumpDraftBadgeTick, currentUserId, groupId]);

  useEffect(() => {
    if (!forumDraftsReady || !currentUserId || postsLoading) return;
    const next: ForumGroupDraftV1['postEdits'] = { ...postEditsRef.current };
    let changed = false;
    for (const k of Object.keys(next)) {
      const e = next[k];
      const files = e.files ?? [];
      if (!e.markdown.trim() && e.photos.length === 0 && files.length === 0) {
        delete next[k];
        changed = true;
        continue;
      }
      const p = posts.find((x) => x.id === k);
      if (p && !postEditDiffersFromPublished(p.body, e.markdown, e.photos, files)) {
        delete next[k];
        changed = true;
      }
    }
    if (changed) {
      postEditsRef.current = next;
      bumpDraftBadgeTick();
      void (async () => {
        const newPost =
          newPostBody.trim() || newPostPhotoUrls.length > 0 || newPostFileAttachments.length > 0
            ? {
                markdown: newPostBody,
                photos: [...newPostPhotoUrls],
                files: [...newPostFileAttachments],
              }
            : null;
        await saveForumGroupDraft(currentUserId, groupId, { v: 1, newPost, postEdits: next });
      })();
    }
  }, [
    bumpDraftBadgeTick,
    currentUserId,
    forumDraftsReady,
    groupId,
    newPostBody,
    newPostPhotoUrls,
    newPostFileAttachments,
    posts,
    postsLoading,
  ]);

  useEffect(() => {
    if (!forumDraftsReady || !currentUserId) return;
    const t = setTimeout(() => {
      void (async () => {
        const eid = editingPostIdRef.current;
        const postEdits: ForumGroupDraftV1['postEdits'] = { ...postEditsRef.current };
        if (
          eid &&
          (postBody.trim() ||
            composerPhotoUrls.length > 0 ||
            composerFileAttachments.length > 0)
        ) {
          const p = posts.find((x) => x.id === eid);
          if (
            p &&
            postEditDiffersFromPublished(p.body, postBody, composerPhotoUrls, composerFileAttachments)
          ) {
            postEdits[eid] = {
              markdown: postBody,
              photos: [...composerPhotoUrls],
              files: [...composerFileAttachments],
            };
          } else if (p) {
            delete postEdits[eid];
          } else {
            postEdits[eid] = {
              markdown: postBody,
              photos: [...composerPhotoUrls],
              files: [...composerFileAttachments],
            };
          }
        }
        for (const k of Object.keys(postEdits)) {
          const e = postEdits[k];
          const files = e.files ?? [];
          if (!e.markdown.trim() && e.photos.length === 0 && files.length === 0) delete postEdits[k];
          else {
            const p = posts.find((x) => x.id === k);
            if (p && !postEditDiffersFromPublished(p.body, e.markdown, e.photos, files))
              delete postEdits[k];
          }
        }
        postEditsRef.current = postEdits;
        const newPost: ForumGroupDraftV1['newPost'] =
          newPostBody.trim() || newPostPhotoUrls.length > 0 || newPostFileAttachments.length > 0
            ? {
                markdown: newPostBody,
                photos: [...newPostPhotoUrls],
                files: [...newPostFileAttachments],
              }
            : null;
        await saveForumGroupDraft(currentUserId, groupId, { v: 1, newPost, postEdits });
        bumpDraftBadgeTick();
      })();
    }, 450);
    return () => clearTimeout(t);
  }, [
    forumDraftsReady,
    currentUserId,
    groupId,
    newPostBody,
    newPostPhotoUrls,
    newPostFileAttachments,
    editingPostId,
    postBody,
    composerPhotoUrls,
    composerFileAttachments,
    bumpDraftBadgeTick,
    posts,
  ]);

  const replaceComposerSelection = useCallback(
    (
      channel: ForumComposerChannel,
      transform: (selectedText: string) => {
        insert: string;
        selectionStart: number;
        selectionEnd: number;
      }
    ) => {
      const selection = channel === 'new' ? newPostSelection : composerSelection;
      const setBody = channel === 'new' ? setNewPostBody : setPostBody;
      const setSelection = channel === 'new' ? setNewPostSelection : setComposerSelection;
      setBody((prev) => {
        const start = Math.max(0, Math.min(selection.start, prev.length));
        const end = Math.max(start, Math.min(selection.end, prev.length));
        const before = prev.slice(0, start);
        const selected = prev.slice(start, end);
        const after = prev.slice(end);
        const next = transform(selected);
        const nextBody = `${before}${next.insert}${after}`;
        setSelection({
          start: start + next.selectionStart,
          end: start + next.selectionEnd,
        });
        return nextBody;
      });
    },
    [composerSelection.end, composerSelection.start, newPostSelection.end, newPostSelection.start]
  );

  const addComposerPhotoFor = useCallback((channel: ForumComposerChannel, url: string) => {
    if (channel === 'new') setNewPostPhotoUrls((prev) => [...prev, url]);
    else setComposerPhotoUrls((prev) => [...prev, url]);
  }, []);

  const removeComposerPhotoAtFor = useCallback((channel: ForumComposerChannel, index: number) => {
    if (channel === 'new') setNewPostPhotoUrls((prev) => prev.filter((_, i) => i !== index));
    else setComposerPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadComposerPhoto = useCallback(
    async (channel: ForumComposerChannel) => {
      if (!currentUserId || isUploadingAttachment) return;
      try {
        setIsUploadingAttachment(true);
        const publicUrl = await pickAndUploadCoverPhoto(currentUserId);
        if (!publicUrl) return;
        addComposerPhotoFor(channel, publicUrl);
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [addComposerPhotoFor, currentUserId, isUploadingAttachment]
  );

  const attachFileToComposer = useCallback(
    async (channel: ForumComposerChannel) => {
      if (!currentUserId || isUploadingAttachment) return;
      try {
        setIsUploadingAttachment(true);
        const uploaded = await pickAndUploadFileFromDevice(currentUserId);
        if (!uploaded?.publicUrl) return;
        const fileEntry: ForumPostFileAttachment = {
          name: uploaded.fileName || 'Attachment',
          url: uploadUrlToDownloadUrl(uploaded.publicUrl),
        };
        const setFiles = channel === 'new' ? setNewPostFileAttachments : setComposerFileAttachments;
        setFiles((prev) => [...prev, fileEntry]);
      } catch (e) {
        if (e instanceof Error && e.message === 'cancelled') return;
        Alert.alert('Upload', e instanceof Error ? e.message : 'Could not attach file');
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [currentUserId, isUploadingAttachment]
  );

  const removeComposerFileAtFor = useCallback((channel: ForumComposerChannel, index: number) => {
    if (channel === 'new') setNewPostFileAttachments((prev) => prev.filter((_, i) => i !== index));
    else setComposerFileAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const takePhotoAndAddComposerPhoto = useCallback(
    async (channel: ForumComposerChannel) => {
      if (!currentUserId || isUploadingAttachment) return;
      try {
        setIsUploadingAttachment(true);
        const publicUrl = await takeAndUploadCoverPhoto(currentUserId);
        if (!publicUrl) return;
        addComposerPhotoFor(channel, publicUrl);
      } catch (e) {
        Alert.alert('Upload', e instanceof Error ? e.message : 'Could not upload photo');
      } finally {
        setIsUploadingAttachment(false);
      }
    },
    [addComposerPhotoFor, currentUserId, isUploadingAttachment]
  );

  const applyTool = useCallback(
    (tool: 'bold' | 'italic' | 'bullet' | 'link' | 'image') => {
      if (tool === 'bold') {
        replaceComposerSelection('new', (selected) => {
          const inner = selected || 'bold text';
          const insert = `**${inner}**`;
          return { insert, selectionStart: 2, selectionEnd: 2 + inner.length };
        });
        return;
      }
      if (tool === 'italic') {
        replaceComposerSelection('new', (selected) => {
          const inner = selected || 'italic text';
          const insert = `*${inner}*`;
          return { insert, selectionStart: 1, selectionEnd: 1 + inner.length };
        });
        return;
      }
      if (tool === 'link') {
        replaceComposerSelection('new', (selected) => {
          const inner = selected || 'link text';
          const insert = `[${inner}](https://example.com)`;
          return { insert, selectionStart: 1, selectionEnd: 1 + inner.length };
        });
        return;
      }
      if (tool === 'image') {
        replaceComposerSelection('new', (selected) => {
          const inner = selected || ' ';
          const insert = `![${inner}](https://example.com/image.jpg)`;
          return { insert, selectionStart: 2, selectionEnd: 2 + inner.length };
        });
        return;
      }
      replaceComposerSelection('new', (selected) => {
        if (!selected) {
          const insert = '- bullet item';
          return { insert, selectionStart: 2, selectionEnd: insert.length };
        }
        const lines = selected.split(/\r?\n/);
        const bulleted = lines.map((line) => (line.trim().startsWith('- ') ? line : `- ${line}`)).join('\n');
        return { insert: bulleted, selectionStart: 0, selectionEnd: bulleted.length };
      });
    },
    [replaceComposerSelection]
  );

  const detectHeadingLevelAtSelection = useCallback(() => {
    const start = Math.max(0, Math.min(composerSelection.start, postBody.length));
    const end = Math.max(start, Math.min(composerSelection.end, postBody.length));
    const lineStart = postBody.lastIndexOf('\n', start - 1) + 1;
    const lineEndIdx = postBody.indexOf('\n', end);
    const lineEnd = lineEndIdx === -1 ? postBody.length : lineEndIdx;
    const activeSegment = postBody.slice(lineStart, lineEnd);
    const match = activeSegment.match(/^\s*(#{1,6})\s+/);
    return match ? Math.max(1, Math.min(6, match[1].length)) : 0;
  }, [composerSelection.end, composerSelection.start, postBody]);

  const applyHeadingLevel = useCallback(
    (level: number) => {
    const safeLevel = Math.max(1, Math.min(6, level));
    const marker = `${'#'.repeat(safeLevel)} `;
    setPostBody((prev) => {
      const start = Math.max(0, Math.min(composerSelection.start, prev.length));
      const end = Math.max(start, Math.min(composerSelection.end, prev.length));
      const hasSelection = end > start;
      if (hasSelection) {
        const before = prev.slice(0, start);
        const selected = prev.slice(start, end);
        const after = prev.slice(end);
        const headed = selected
          .split(/\r?\n/)
          .map((line) => {
            if (!line.trim()) return line;
            const stripped = line.replace(/^(\s*)(#{1,6}\s+)?/, '$1');
            return `${marker}${stripped.trimStart()}`;
          })
          .join('\n');
        setComposerSelection({ start, end: start + headed.length });
        return `${before}${headed}${after}`;
      }

      const lineStart = prev.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = prev.indexOf('\n', start);
      const lineEnd = lineEndIdx === -1 ? prev.length : lineEndIdx;
      const line = prev.slice(lineStart, lineEnd);
      const linePrefixMatch = line.match(/^(\s*)/);
      const indent = linePrefixMatch?.[1] ?? '';
      const content = line.replace(/^(\s*)(#{1,6}\s+)?/, '$1').slice(indent.length);
      const nextLine = `${indent}${marker}${content.trimStart()}`;
      const before = prev.slice(0, lineStart);
      const after = prev.slice(lineEnd);
      const cursorOffsetInLine = start - lineStart;
      const nextCursor = Math.min(lineStart + nextLine.length, lineStart + marker.length + Math.max(0, cursorOffsetInLine));
      setComposerSelection({ start: nextCursor, end: nextCursor });
      return `${before}${nextLine}${after}`;
    });
    },
    [composerSelection.end, composerSelection.start]
  );

  const increaseTextSize = useCallback(() => {
    const current = detectHeadingLevelAtSelection();
    const next = current === 0 ? 4 : Math.max(1, current - 1);
    applyHeadingLevel(next);
  }, [applyHeadingLevel, detectHeadingLevelAtSelection]);

  const decreaseTextSize = useCallback(() => {
    const current = detectHeadingLevelAtSelection();
    const next = current === 0 ? 5 : Math.min(6, current + 1);
    applyHeadingLevel(next);
  }, [applyHeadingLevel, detectHeadingLevelAtSelection]);

  const openComposerLinkPopover = useCallback(
    (mode: 'link' | 'image', channel: ForumComposerChannel) => {
      const body = channel === 'new' ? newPostBody : postBody;
      const sel = channel === 'new' ? newPostSelection : composerSelection;
      const start = Math.max(0, Math.min(sel.start, body.length));
      const end = Math.max(start, Math.min(sel.end, body.length));
      const selected = body.slice(start, end).trim();
      let matchedText = selected;
      let matchedUrl = '';
      let replaceStart: number | undefined;
      let replaceEnd: number | undefined;

      const tokenRegex = /(!?)\[(.*?)\]\(([^)\s]+)\)/g;
      let match: RegExpExecArray | null;
      while ((match = tokenRegex.exec(body)) !== null) {
        const isImageToken = match[1] === '!';
        const tokenMode = isImageToken ? 'image' : 'link';
        if (tokenMode !== mode) continue;
        const tokenStart = match.index;
        const tokenEnd = tokenStart + match[0].length;
        const intersectsSelection = start < tokenEnd && end > tokenStart;
        const cursorInside = start === end && start >= tokenStart && start <= tokenEnd;
        if (!intersectsSelection && !cursorInside) continue;
        matchedText = match[2] ?? '';
        matchedUrl = match[3] ?? '';
        replaceStart = tokenStart;
        replaceEnd = tokenEnd;
        break;
      }

      setComposerLinkPopover({
        mode,
        text: matchedText,
        url: matchedUrl,
        replaceStart,
        replaceEnd,
        channel,
      });
    },
    [composerSelection.end, composerSelection.start, newPostBody, newPostSelection.end, newPostSelection.start, postBody]
  );

  const applyComposerLinkPopover = useCallback(() => {
    if (!composerLinkPopover) return;
    const channel = composerLinkPopover.channel;
    const bodyNow = channel === 'new' ? newPostBody : postBody;
    const setBody = channel === 'new' ? setNewPostBody : setPostBody;
    const setSelection = channel === 'new' ? setNewPostSelection : setComposerSelection;

    const cleanUrl = composerLinkPopover.url.trim();
    if (!cleanUrl) return;
    const cleanText = composerLinkPopover.text.trim();
    const hasReplaceRange =
      typeof composerLinkPopover.replaceStart === 'number' &&
      typeof composerLinkPopover.replaceEnd === 'number' &&
      composerLinkPopover.replaceEnd >= composerLinkPopover.replaceStart;
    if (hasReplaceRange) {
      const replaceStart = Math.max(0, Math.min(composerLinkPopover.replaceStart ?? 0, bodyNow.length));
      const replaceEnd = Math.max(
        replaceStart,
        Math.min(composerLinkPopover.replaceEnd ?? replaceStart, bodyNow.length)
      );
      const before = bodyNow.slice(0, replaceStart);
      const after = bodyNow.slice(replaceEnd);
      if (composerLinkPopover.mode === 'link') {
        const inner = cleanText || 'link text';
        const insert = `[${inner}](${cleanUrl})`;
        setBody(`${before}${insert}${after}`);
        setSelection({ start: replaceStart + 1, end: replaceStart + 1 + inner.length });
      } else {
        const inner = cleanText || ' ';
        const insert = `![${inner}](${cleanUrl})`;
        setBody(`${before}${insert}${after}`);
        setSelection({ start: replaceStart + 2, end: replaceStart + 2 + inner.length });
      }
      setComposerLinkPopover(null);
      return;
    }
    if (composerLinkPopover.mode === 'link') {
      replaceComposerSelection(channel, (selected) => {
        const inner = cleanText || selected || 'link text';
        const insert = `[${inner}](${cleanUrl})`;
        return { insert, selectionStart: 1, selectionEnd: 1 + inner.length };
      });
    } else {
      replaceComposerSelection(channel, (selected) => {
        const inner = cleanText || selected || ' ';
        const insert = `![${inner}](${cleanUrl})`;
        return { insert, selectionStart: 2, selectionEnd: 2 + inner.length };
      });
    }
    setComposerLinkPopover(null);
  }, [composerLinkPopover, newPostBody, postBody, replaceComposerSelection]);

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

  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers]);

  const mentionMemberRows: MentionMemberRow[] = useMemo(() => {
    const g = group as GroupScoped | undefined;
    const ids = g?.memberIds;
    if (!ids?.length) return [];
    return ids.map((uid) => {
      const u = usersById.get(uid);
      return {
        userId: uid,
        displayName: u?.displayName || u?.name || 'Member',
        name: u?.name || '',
      };
    });
  }, [group, usersById]);

  const mentionMembersForInput = useMemo(
    () => mentionMemberRows.map((m) => ({ id: m.userId, displayName: m.displayName, name: m.name })),
    [mentionMemberRows]
  );

  const getUserDisplayName = useCallback(
    (userId: string) => {
      const user = usersById.get(userId);
      return user?.displayName || user?.name || 'Member';
    },
    [usersById]
  );

  const postMenuTargetPost = useMemo(
    () => (postMenuTarget ? posts.find((p) => p.id === postMenuTarget.postId) ?? null : null),
    [postMenuTarget, posts]
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

  const cancelEditPost = useCallback(() => {
    const id = editingPostId;
    pendingScrollToEditPostIdRef.current = null;
    if (id) delete postEditsRef.current[id];
    bumpDraftBadgeTick();
    setEditingPostId(null);
    setPostBody('');
    setComposerPhotoUrls([]);
    setComposerFileAttachments([]);
    setComposerSelection({ start: 0, end: 0 });
    void (async () => {
      if (!currentUserId || !forumDraftsReady) return;
      const postEdits = { ...postEditsRef.current };
      const newPost =
        newPostBody.trim() || newPostPhotoUrls.length > 0 || newPostFileAttachments.length > 0
          ? {
              markdown: newPostBody,
              photos: [...newPostPhotoUrls],
              files: [...newPostFileAttachments],
            }
          : null;
      await saveForumGroupDraft(currentUserId, groupId, { v: 1, newPost, postEdits });
    })();
  }, [
    bumpDraftBadgeTick,
    currentUserId,
    editingPostId,
    forumDraftsReady,
    groupId,
    newPostBody,
    newPostPhotoUrls,
    newPostFileAttachments,
  ]);

  const discardNewPostDraft = useCallback(() => {
    setNewPostBody('');
    setNewPostPhotoUrls([]);
    setNewPostFileAttachments([]);
    setNewPostSelection({ start: 0, end: 0 });
    setNewPostInputKey((k) => k + 1);
    void (async () => {
      if (!currentUserId || !forumDraftsReady) return;
      const postEdits = { ...postEditsRef.current };
      await saveForumGroupDraft(currentUserId, groupId, { v: 1, newPost: null, postEdits });
    })();
  }, [currentUserId, forumDraftsReady, groupId]);

  const beginEditPost = useCallback(
    (post: GroupPost) => {
      if (!currentUserId) return;
      const persisted = postEditsRef.current[post.id];
      setEditingPostId(post.id);
      const persistedFiles = persisted?.files ?? [];
      if (
        persisted &&
        (persisted.markdown.trim() || persisted.photos.length > 0 || persistedFiles.length > 0)
      ) {
        setPostBody(persisted.markdown);
        setComposerPhotoUrls([...persisted.photos]);
        setComposerFileAttachments(persistedFiles.map((f) => ({ name: f.name, url: f.url })));
      } else {
        const split = splitStoredPostBody(post.body);
        setPostBody(split.markdownSource);
        setComposerPhotoUrls(split.attachmentImages.map((img) => img.url));
        setComposerFileAttachments(split.attachmentFiles.map((f) => ({ name: f.name, url: f.url })));
      }
      setComposerSelection({ start: 0, end: 0 });
      setPostMenuTarget(null);
      pendingScrollToEditPostIdRef.current = post.id;
    },
    [currentUserId]
  );

  const openPostMenu = useCallback((post: GroupPost) => {
    const node = postMenuButtonRefs.current[post.id] as
      | (View & {
          measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
        })
      | null;
    node?.measureInWindow?.((x, y, width, height) => {
      setPostMenuTarget({ postId: post.id, anchor: { x, y, width, height } });
    });
  }, []);

  const submitNewPost = useCallback(async () => {
    const body = mergeComposerBodyForApi(newPostBody, newPostPhotoUrls, newPostFileAttachments).trim();
    if (!body || !currentUserId) return;
    const title =
      newPostBody
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean)
        ?.slice(0, 80) || 'Post';
    const mids = computeMentionUserIdsForPost(newPostBody, mentionMemberRows, currentUserId);
    await createPostMutation.mutateAsync({
      id: forumId('post'),
      userId: currentUserId,
      title,
      body,
      ...(mids.length > 0 ? { mentionedUserIds: mids } : {}),
    });
    setNewPostBody('');
    setNewPostPhotoUrls([]);
    setNewPostFileAttachments([]);
    setNewPostSelection({ start: 0, end: 0 });
    setNewPostInputKey((k) => k + 1);
    void (async () => {
      if (!currentUserId) return;
      const postEdits = { ...postEditsRef.current };
      await saveForumGroupDraft(currentUserId, groupId, { v: 1, newPost: null, postEdits });
    })();
  }, [
    createPostMutation,
    currentUserId,
    groupId,
    mentionMemberRows,
    newPostBody,
    newPostPhotoUrls,
    newPostFileAttachments,
  ]);

  const submitEditPost = useCallback(async () => {
    if (!editingPostId) return;
    const body = mergeComposerBodyForApi(postBody, composerPhotoUrls, composerFileAttachments).trim();
    if (!body || !currentUserId) return;
    const title =
      postBody
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean)
        ?.slice(0, 80) || 'Post';
    try {
      const pid = editingPostId;
      const mids = computeMentionUserIdsForPost(postBody, mentionMemberRows, currentUserId);
      await updatePostMutation.mutateAsync({
        postId: pid,
        title,
        body,
        ...(mids.length > 0 ? { mentionedUserIds: mids } : {}),
      });
      delete postEditsRef.current[pid];
      bumpDraftBadgeTick();
      setEditingPostId(null);
      setPostBody('');
      setComposerPhotoUrls([]);
      setComposerFileAttachments([]);
      setComposerSelection({ start: 0, end: 0 });
      void (async () => {
        if (!currentUserId) return;
        const postEdits = { ...postEditsRef.current };
        const newPost =
          newPostBody.trim() || newPostPhotoUrls.length > 0 || newPostFileAttachments.length > 0
            ? {
                markdown: newPostBody,
                photos: [...newPostPhotoUrls],
                files: [...newPostFileAttachments],
              }
            : null;
        await saveForumGroupDraft(currentUserId, groupId, { v: 1, newPost, postEdits });
      })();
    } catch {
      if (Platform.OS === 'web') window.alert('Failed to update post');
      else Alert.alert('Error', 'Failed to update post');
    }
  }, [
    bumpDraftBadgeTick,
    composerPhotoUrls,
    composerFileAttachments,
    currentUserId,
    editingPostId,
    groupId,
    mentionMemberRows,
    newPostBody,
    newPostPhotoUrls,
    newPostFileAttachments,
    postBody,
    updatePostMutation,
  ]);

  const confirmDeletePost = useCallback(
    (postId: string) => {
      const run = () => {
        delete postEditsRef.current[postId];
        bumpDraftBadgeTick();
        if (editingPostId === postId) {
          setEditingPostId(null);
          setPostBody('');
          setComposerPhotoUrls([]);
          setComposerFileAttachments([]);
          setComposerSelection({ start: 0, end: 0 });
        }
        void (async () => {
          if (!currentUserId || !forumDraftsReady) return;
          const postEdits = { ...postEditsRef.current };
          const newPost =
            newPostBody.trim() || newPostPhotoUrls.length > 0 || newPostFileAttachments.length > 0
              ? {
                  markdown: newPostBody,
                  photos: [...newPostPhotoUrls],
                  files: [...newPostFileAttachments],
                }
              : null;
          await saveForumGroupDraft(currentUserId, groupId, { v: 1, newPost, postEdits });
        })();
        void deletePostMutation.mutateAsync(postId).catch(() => {
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
    },
    [
      bumpDraftBadgeTick,
      currentUserId,
      deletePostMutation,
      editingPostId,
      forumDraftsReady,
      groupId,
      newPostBody,
      newPostPhotoUrls,
      newPostFileAttachments,
    ]
  );

  const handleEditPostChangeText = useCallback(
    (nextBody: string) => {
      const prevBody = postBody;
      if (!nextBody.includes('http') || nextBody === prevBody) {
        setPostBody(nextBody);
        return;
      }

      let prefix = 0;
      while (prefix < prevBody.length && prefix < nextBody.length && prevBody[prefix] === nextBody[prefix]) {
        prefix += 1;
      }
      let suffix = 0;
      while (
        suffix < prevBody.length - prefix &&
        suffix < nextBody.length - prefix &&
        prevBody[prevBody.length - 1 - suffix] === nextBody[nextBody.length - 1 - suffix]
      ) {
        suffix += 1;
      }

      const inserted = nextBody.slice(prefix, nextBody.length - suffix);
      if (inserted.length <= 1) {
        setPostBody(nextBody);
        return;
      }

      const convertedInserted = wrapBareUrlsWithMarkdown(inserted);
      if (convertedInserted === inserted) {
        setPostBody(nextBody);
        return;
      }

      const convertedBody = `${nextBody.slice(0, prefix)}${convertedInserted}${nextBody.slice(nextBody.length - suffix)}`;
      setPostBody(convertedBody);
      const delta = convertedInserted.length - inserted.length;
      const nextCaret = Math.max(0, Math.min(convertedBody.length, composerSelection.end + delta));
      setComposerSelection({ start: nextCaret, end: nextCaret });
    },
    [composerSelection.end, postBody]
  );

  const handleNewPostChangeText = useCallback(
    (nextBody: string) => {
      const prevBody = newPostBody;
      if (!nextBody.includes('http') || nextBody === prevBody) {
        setNewPostBody(nextBody);
        return;
      }

      let prefix = 0;
      while (prefix < prevBody.length && prefix < nextBody.length && prevBody[prefix] === nextBody[prefix]) {
        prefix += 1;
      }
      let suffix = 0;
      while (
        suffix < prevBody.length - prefix &&
        suffix < nextBody.length - prefix &&
        prevBody[prevBody.length - 1 - suffix] === nextBody[nextBody.length - 1 - suffix]
      ) {
        suffix += 1;
      }

      const inserted = nextBody.slice(prefix, nextBody.length - suffix);
      if (inserted.length <= 1) {
        setNewPostBody(nextBody);
        return;
      }

      const convertedInserted = wrapBareUrlsWithMarkdown(inserted);
      if (convertedInserted === inserted) {
        setNewPostBody(nextBody);
        return;
      }

      const convertedBody = `${nextBody.slice(0, prefix)}${convertedInserted}${nextBody.slice(nextBody.length - suffix)}`;
      setNewPostBody(convertedBody);
      const delta = convertedInserted.length - inserted.length;
      const nextCaret = Math.max(0, Math.min(convertedBody.length, newPostSelection.end + delta));
      setNewPostSelection({ start: nextCaret, end: nextCaret });
    },
    [newPostBody, newPostSelection.end]
  );

  const addComment = useCallback(
    async (postId: string) => {
      if (!currentUserId || uploadingCommentPhotoPostId === postId) return;
      const raw = draftComments[postId] ?? '';
      const photoDrafts = draftCommentPhotoDraftsByPost[postId] ?? [];
      const pendingFiles = draftCommentPendingFilesByPost[postId] ?? [];
      const hasContent =
        raw.trim().length > 0 || photoDrafts.length > 0 || pendingFiles.length > 0;
      if (!hasContent) return;
      try {
        setUploadingCommentPhotoPostId(postId);
        const photoUrls = await uploadCoverPhotoDrafts(currentUserId, photoDrafts);
        let merged = mergeCommentBodyForApi(raw, photoUrls);
        for (const f of pendingFiles) {
          const publicUrl = await uploadPickedFileAsset(currentUserId, f.asset);
          merged = appendMarkdownLink(merged, f.name, uploadUrlToDownloadUrl(publicUrl));
        }
        const body = merged.trim();
        if (!body) return;
        const mids = computeMentionUserIdsForPost(raw, mentionMemberRows, currentUserId);
        await createCommentMutation.mutateAsync({
          postId,
          input: {
            id: forumId('comment'),
            userId: currentUserId,
            body,
            parentCommentId: replyTargetByPost[postId] ?? undefined,
            ...(mids.length > 0 ? { mentionedUserIds: mids } : {}),
          },
        });
        setDraftComments((prev) => ({ ...prev, [postId]: '' }));
        setDraftCommentPhotoDraftsByPost((prev) => ({ ...prev, [postId]: [] }));
        setDraftCommentPendingFilesByPost((prev) => ({ ...prev, [postId]: [] }));
        setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
      } catch (e) {
        Alert.alert('Comment', e instanceof Error ? e.message : 'Failed to post comment');
      } finally {
        setUploadingCommentPhotoPostId((cur) => (cur === postId ? null : cur));
      }
    },
    [
      createCommentMutation,
      currentUserId,
      draftCommentPendingFilesByPost,
      draftCommentPhotoDraftsByPost,
      draftComments,
      mentionMemberRows,
      replyTargetByPost,
      uploadingCommentPhotoPostId,
    ]
  );

  const addCommentPhotoDraftForPost = useCallback((postId: string, draft: CoverPhotoDraft) => {
    setDraftCommentPhotoDraftsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] ?? []), draft],
    }));
  }, []);

  const removeCommentPhotoDraftAtPost = useCallback((postId: string, index: number) => {
    setDraftCommentPhotoDraftsByPost((prev) => {
      const list = prev[postId] ?? [];
      const removed = list[index];
      if (removed) revokeCoverPhotoDraftPreview(removed);
      return { ...prev, [postId]: list.filter((_, i) => i !== index) };
    });
  }, []);

  const pickCommentPhotoForPost = useCallback(
    async (postId: string) => {
      if (uploadingCommentPhotoPostId === postId) return;
      const picked = await pickDeferredCoverPhotoNative();
      if (!picked) return;
      addCommentPhotoDraftForPost(postId, {
        kind: 'pending',
        previewUri: picked.previewUri,
        pending: picked.pending,
      });
    },
    [addCommentPhotoDraftForPost, uploadingCommentPhotoPostId]
  );

  const takeCommentPhotoForPost = useCallback(
    async (postId: string) => {
      if (uploadingCommentPhotoPostId === postId) return;
      const picked = await pickDeferredCoverPhotoFromCamera();
      if (!picked) return;
      addCommentPhotoDraftForPost(postId, {
        kind: 'pending',
        previewUri: picked.previewUri,
        pending: picked.pending,
      });
    },
    [addCommentPhotoDraftForPost, uploadingCommentPhotoPostId]
  );

  const attachCommentFileForPost = useCallback(
    async (postId: string) => {
      if (uploadingCommentPhotoPostId === postId) return;
      try {
        const asset = await pickFileFromDevice();
        setDraftCommentPendingFilesByPost((prev) => ({
          ...prev,
          [postId]: [
            ...(prev[postId] ?? []),
            { id: forumId('comment-file'), name: asset.fileName, asset },
          ],
        }));
      } catch (e) {
        if (e instanceof Error && e.message === 'cancelled') return;
        Alert.alert('Attach file', e instanceof Error ? e.message : 'Could not attach file');
      }
    },
    [uploadingCommentPhotoPostId]
  );

  const beginEditComment = useCallback((postId: string, c: GroupPostComment) => {
    setCommentEdit({ postId, commentId: c.id });
    setCommentEditText(c.body);
    setCommentEditParentId(c.parentCommentId ?? null);
    setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
  }, []);

  const cancelEditComment = useCallback(() => {
    setCommentEdit(null);
    setCommentEditText('');
    setCommentEditParentId(null);
  }, []);

  const saveEditedComment = useCallback(async () => {
    if (!currentUserId || !commentEdit) return;
    const body = commentEditText.trim();
    if (!body) {
      if (Platform.OS === 'web') window.alert('Comment cannot be empty');
      else Alert.alert('Error', 'Comment cannot be empty');
      return;
    }
    try {
      const mids = computeMentionUserIdsForPost(commentEditText, mentionMemberRows, currentUserId);
      await updateCommentMutation.mutateAsync({
        commentId: commentEdit.commentId,
        body,
        parentCommentId: commentEditParentId,
        ...(mids.length > 0 ? { mentionedUserIds: mids } : {}),
      });
      cancelEditComment();
    } catch {
      if (Platform.OS === 'web') window.alert('Failed to update comment');
      else Alert.alert('Error', 'Failed to update comment');
    }
  }, [
    currentUserId,
    commentEdit,
    commentEditText,
    commentEditParentId,
    mentionMemberRows,
    updateCommentMutation,
    cancelEditComment,
  ]);

  const confirmDeleteComment = useCallback(
    (postId: string, commentId: string) => {
      const run = () => {
        if (replyTargetByPost[postId] === commentId) {
          setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
        }
        if (commentEdit?.commentId === commentId) {
          cancelEditComment();
        }
        void deleteCommentMutation.mutateAsync(commentId).catch(() => {
          if (Platform.OS === 'web') window.alert('Failed to delete comment');
          else Alert.alert('Error', 'Failed to delete comment');
        });
      };
      const msg = 'Delete this comment?';
      if (Platform.OS === 'web') {
        if (window.confirm(msg)) run();
      } else {
        Alert.alert('Delete comment?', msg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: run },
        ]);
      }
    },
    [replyTargetByPost, commentEdit, cancelEditComment, deleteCommentMutation]
  );

  const applyReactionAndDismiss = (emoji: string) => {
    const target = reactionQuickPickerTarget ?? reactionPickerTarget;
    if (!target) return;
    if (target.kind === 'post') {
      togglePostReactionMutation.mutate({ postId: target.id, emoji });
    } else {
      toggleCommentReactionMutation.mutate({ commentId: target.id, emoji });
    }
    setReactionQuickPickerTarget(null);
    setReactionQuickPickerAnchor(null);
    setReactionPickerTarget(null);
  };

  const openReactionQuickPicker = useCallback((target: { kind: 'post' | 'comment'; id: string }) => {
    const key = `${target.kind}:${target.id}`;
    const node = reactionButtonRefs.current[key] as
      | (View & { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void })
      | null;
    if (!node?.measureInWindow) {
      setReactionQuickPickerAnchor(null);
      setReactionQuickPickerTarget(target);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      setReactionQuickPickerAnchor({ x, y, width, height });
      setReactionQuickPickerTarget(target);
    });
  }, []);

  const quickPickerStyle = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = 316;
    const cardHeight = 62;
    const margin = 10;
    if (!reactionQuickPickerAnchor) return { top: 120, left: (screenWidth - cardWidth) / 2 };
    const centeredLeft = reactionQuickPickerAnchor.x + reactionQuickPickerAnchor.width / 2 - cardWidth / 2;
    const left = Math.max(margin, Math.min(screenWidth - cardWidth - margin, centeredLeft));
    const top = Math.max(12, reactionQuickPickerAnchor.y - cardHeight - 8);
    return { top, left };
  }, [reactionQuickPickerAnchor]);

  const openReactionDetailModal = useCallback((payload: { emoji: string; userIds: string[] }) => {
    setReactionDetailModal(payload);
  }, []);

  const newPostDraftDirty = useMemo(
    () =>
      newPostBody.trim().length > 0 ||
      newPostPhotoUrls.length > 0 ||
      newPostFileAttachments.length > 0,
    [newPostBody, newPostPhotoUrls, newPostFileAttachments]
  );

  const postIdsWithUnsavedDraft = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, e] of Object.entries(postEditsRef.current)) {
      const p = posts.find((x) => x.id === id);
      if (p && postEditDiffersFromPublished(p.body, e.markdown, e.photos, e.files ?? []))
        ids.add(id);
    }
    return ids;
  }, [draftBadgeTick, posts]);

  const forumComposerFields = (channel: ForumComposerChannel) => {
    const isNew = channel === 'new';
    const body = isNew ? newPostBody : postBody;
    const photos = isNew ? newPostPhotoUrls : composerPhotoUrls;
    const fileAttachments = isNew ? newPostFileAttachments : composerFileAttachments;
    const selection = isNew ? newPostSelection : composerSelection;
    const setSelection = isNew ? setNewPostSelection : setComposerSelection;
    const onChangeText = isNew ? handleNewPostChangeText : handleEditPostChangeText;
    const submitBusy = isNew ? createPostMutation.isPending : updatePostMutation.isPending;
    const canSubmit = body.trim().length > 0 || photos.length > 0 || fileAttachments.length > 0;
    const postComposerRef = isNew ? newPostComposerRef : editPostComposerRef;
    const scrollPostComposerIntoView = isNew
      ? scrollNewPostComposerIntoView
      : scrollEditPostComposerIntoView;

    return (
      <>
        {isNew && newPostDraftDirty ? (
          <View style={styles.forumDraftBar}>
            <Text style={styles.forumDraftBarHint}>Draft saved on this device</Text>
            <TouchableOpacity
              onPress={discardNewPostDraft}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Discard new post draft"
            >
              <Text style={styles.forumDraftBarDiscard}>Discard draft</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {!isNew ? (
          <View style={styles.forumDraftBar}>
            <Text style={styles.forumDraftBarHint}>Draft saved on this device</Text>
            <TouchableOpacity
              onPress={cancelEditPost}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Discard draft"
            >
              <Text style={styles.forumDraftBarDiscard}>Discard draft</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View ref={postComposerRef} collapsable={false}>
          <CommentMentionInput
            key={isNew ? `new-post-${newPostInputKey}` : `edit-post-${editingPostId ?? 'none'}`}
            value={body}
            onChangeText={onChangeText}
            onFocus={scrollPostComposerIntoView}
            members={mentionMembersForInput}
            currentUserId={currentUserId}
            selection={selection}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder="Write your post - use markdown for advanced formatting"
            placeholderTextColor={Colors.textMuted}
            style={styles.bodyInput}
            multiline
            textAlignVertical="top"
            wrapperStyle={styles.postMentionInputWrap}
          />
        </View>
        {photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.composerPhotosScroll}
            contentContainerStyle={styles.composerPhotosScrollContent}
          >
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.composerPhotoThumbWrap}>
                <TouchableOpacity
                  onPress={() =>
                    setImageLightbox({
                      urls: photos,
                      index: i,
                      alts: photos.map(() => ''),
                      ownerName: currentUserId ? getUserDisplayName(currentUserId) : group?.name,
                    })
                  }
                  activeOpacity={0.9}
                >
                  <ResolvableImage storedUrl={uri} style={styles.composerPhotoThumb} resizeMode="cover" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeComposerPhotoAtFor(channel, i)}
                  style={styles.composerPhotoRemoveBtn}
                  accessibilityLabel="Remove photo"
                >
                  <Ionicons name="close" size={11} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {fileAttachments.length > 0 ? (
          <View style={styles.composerFileChipsList}>
            {fileAttachments.map((file, i) => (
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
                  onPress={() => removeComposerFileAtFor(channel, i)}
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
        <View style={styles.attachToolbarRow}>
          <AddImageButton
            iconOnly
            label="Add photo"
            triggerIconName="camera-outline"
            optionsModalTitle="Add photo"
            linkModalTitle="Photo URL"
            disabled={isUploadingAttachment}
            busy={isUploadingAttachment}
            onTakePhoto={() => void takePhotoAndAddComposerPhoto(channel)}
            onChooseFromLibrary={() => void uploadComposerPhoto(channel)}
            onInsertLink={async (url) => {
              addComposerPhotoFor(channel, url.trim());
            }}
          />
          <TouchableOpacity
            style={[styles.attachFileBtn, isUploadingAttachment && styles.postBtnDisabled]}
            onPress={() => void attachFileToComposer(channel)}
            disabled={isUploadingAttachment}
            accessibilityLabel="Attach file"
          >
            <Ionicons name="attach-outline" size={16} color={Colors.textSub} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.postBtn, (!canSubmit || submitBusy) && styles.postBtnDisabled]}
          onPress={() => void (isNew ? submitNewPost() : submitEditPost())}
          disabled={!canSubmit || submitBusy}
        >
          {submitBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postBtnText}>{isNew ? 'Post' : 'Save changes'}</Text>
          )}
        </TouchableOpacity>
      </>
    );
  };

  if (!group) return null;

  return (
    <View style={styles.page}>
      <KeyboardSafeScrollView
        ref={(node) => {
          scrollRef.current = node;
          if (!node) return;
          const measurable = node as ScrollView & {
            measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
          };
          measurable.measureInWindow?.((_x, y) => {
            scrollViewportYRef.current = y;
          });
        }}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => {
          scrollOffsetYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={refreshControl}
      >
        <View style={styles.card}>
          <View style={styles.cardPad}>{forumComposerFields('new')}</View>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>POSTS</Text>
        {postsLoading ? (
          <View style={styles.card}>
            <View style={styles.cardPad}>
              <ActivityIndicator color={Colors.textSub} />
            </View>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.card}>
            <View style={styles.cardPad}>
              <Text style={styles.emptyText}>
                No posts yet.
              </Text>
            </View>
          </View>
        ) : (
          posts.map((post) => (
            <View
              key={post.id}
              style={[styles.card, { marginBottom: 14 }]}
              onLayout={(e) => {
                const top = e.nativeEvent.layout.y;
                postTopByIdRef.current[post.id] = top;
                if (pendingScrollToEditPostIdRef.current === post.id) {
                  pendingScrollToEditPostIdRef.current = null;
                  requestAnimationFrame(() => {
                    scrollRef.current?.scrollTo({ y: Math.max(0, top - 12), animated: true });
                  });
                }
                if (pendingScrollToFocusPostIdRef.current === post.id) {
                  pendingScrollToFocusPostIdRef.current = null;
                  requestAnimationFrame(() => {
                    scrollRef.current?.scrollTo({ y: Math.max(0, top - 12), animated: true });
                  });
                }
              }}
            >
              <View style={styles.cardPad}>
                <View style={styles.postMetaHeaderRow}>
                  <View style={styles.postMetaTitleColumn}>
                    <View style={styles.postMetaAuthorRow}>
                      <UserAvatar
                        seed={getUserDisplayName(post.userId)}
                        backgroundColor={[usersById.get(post.userId)?.avatarSeed ?? '']}
                        thumbnail={usersById.get(post.userId)?.thumbnail}
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
                    {post.userId === currentUserId &&
                    editingPostId !== post.id &&
                    postIdsWithUnsavedDraft.has(post.id) ? (
                      <TouchableOpacity
                        style={styles.postDraftBadge}
                        onPress={() => beginEditPost(post)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Open draft editor"
                      >
                        <Ionicons name="document-text-outline" size={12} color={Colors.maybe} />
                        <Text style={styles.postDraftBadgeText}>Unsaved draft</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {post.userId === currentUserId ? (
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
                {editingPostId === post.id ? (
                  forumComposerFields('edit')
                ) : (
                  (() => {
                    const { markdownSource, attachmentImages, attachmentFiles } = splitStoredPostBody(
                      post.body
                    );
                    const joined = markdownSource.trim();
                    const hasText = joined.length > 0;
                    const expanded = !!expandedPostBodyById[post.id];
                    const storedMeasure = postMarkdownMeasureById[post.id];
                    const measureOk = storedMeasure?.bodyKey === post.body;
                    const natural = measureOk ? storedMeasure : null;
                    const shouldCollapse = !!(natural && natural.h > POST_BODY_PREVIEW_MAX_HEIGHT);
                    const showClamp = shouldCollapse && !expanded;
                    const postOwner = usersById.get(post.userId);
                    return (
                      <>
                        {hasText ? (
                          <>
                            <View
                              onLayout={(e) => {
                                const { width, height } = e.nativeEvent.layout;
                                if (width < 1 || height < 1) return;
                                const clampedLayout = !!(
                                  natural &&
                                  natural.h > POST_BODY_PREVIEW_MAX_HEIGHT &&
                                  !expanded
                                );
                                if (clampedLayout) return;
                                setPostMarkdownMeasureById((prev) => ({
                                  ...prev,
                                  [post.id]: { w: width, h: height, bodyKey: post.body },
                                }));
                              }}
                              style={
                                showClamp
                                  ? {
                                      maxHeight: POST_BODY_PREVIEW_MAX_HEIGHT,
                                      overflow: 'hidden' as const,
                                    }
                                  : undefined
                              }
                            >
                              <ForumPostMarkdownBody
                                markdownBody={joined}
                                markdownStyles={markdownStyles}
                                posterDisplayName={getUserDisplayName(post.userId)}
                                ownerAvatarSeed={postOwner?.avatarSeed ?? null}
                                ownerThumbnail={postOwner?.thumbnail ?? null}
                                setImageLightbox={setImageLightbox}
                              />
                            </View>
                            {shouldCollapse ? (
                              <TouchableOpacity
                                onPress={() =>
                                  setExpandedPostBodyById((prev) => ({
                                    ...prev,
                                    [post.id]: !prev[post.id],
                                  }))
                                }
                                style={styles.readMoreBtn}
                              >
                                <Text style={styles.readMoreText}>
                                  {expanded ? 'Read less' : 'Read more'}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </>
                        ) : null}
                        {attachmentImages.length > 0 ? (
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
                        {attachmentFiles.length > 0 ? (
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
                      </>
                    );
                  })()
                )}

                {post.reactions.length > 0 ? (
                  <View style={styles.reactionRow}>
                    {post.reactions.map((entry) => (
                      <TouchableOpacity
                        key={`${post.id}-existing-${entry.emoji}`}
                        style={styles.reactionBtn}
                        onPress={() =>
                          togglePostReactionMutation.mutate({ postId: post.id, emoji: entry.emoji })
                        }
                        onLongPress={() =>
                          openReactionDetailModal({ emoji: entry.emoji, userIds: entry.userIds })
                        }
                      >
                        <Text style={styles.reactionLabel}>
                          {entry.emoji} {entry.count}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={styles.reactionRow}>
                  <TouchableOpacity
                    ref={(node) => {
                      reactionButtonRefs.current[`post:${post.id}`] = node;
                    }}
                    style={styles.iconActionBtn}
                    onPress={() => openReactionQuickPicker({ kind: 'post', id: post.id })}
                    onLongPress={() => openReactionQuickPicker({ kind: 'post', id: post.id })}
                    accessibilityLabel="Add reaction"
                    activeOpacity={0.75}
                  >
                    <Ionicons name="happy-outline" size={15} color={Colors.textSub} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() =>
                      setExpandedCommentsByPost((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                    }
                  >
                    <Ionicons name="chatbubble-outline" size={15} color={Colors.textSub} />
                    <Text style={styles.iconActionText}>Comments ({post.comments.length})</Text>
                  </TouchableOpacity>
                </View>
                {expandedCommentsByPost[post.id] ? (
                  <ThreadedCommentsSection
                    comments={mapGroupCommentsToThread(post.comments)}
                    mentionMembers={mentionMembersForInput}
                    focusCommentId={focusPostId === post.id ? focusCommentId : undefined}
                    ancestorTopPx={postTopByIdRef.current[post.id] ?? 0}
                    scrollRef={scrollRef}
                    scrollViewportYRef={scrollViewportYRef}
                    scrollOffsetYRef={scrollOffsetYRef}
                    currentUserId={currentUserId}
                    getUserDisplayName={getUserDisplayName}
                    formatCommentTime={formatCreatedAt}
                    draftText={draftComments[post.id] ?? ''}
                    onDraftTextChange={(v) =>
                      setDraftComments((prev) => ({ ...prev, [post.id]: v }))
                    }
                    draftPhotoUrls={(draftCommentPhotoDraftsByPost[post.id] ?? []).map(
                      coverPhotoDraftDisplayUri
                    )}
                    onRemoveDraftPhotoAtIndex={(index) =>
                      removeCommentPhotoDraftAtPost(post.id, index)
                    }
                    draftPendingFiles={(draftCommentPendingFilesByPost[post.id] ?? []).map((f) => ({
                      id: f.id,
                      name: f.name,
                    }))}
                    onRemoveDraftPendingFile={(fileId) =>
                      setDraftCommentPendingFilesByPost((prev) => ({
                        ...prev,
                        [post.id]: (prev[post.id] ?? []).filter((f) => f.id !== fileId),
                      }))
                    }
                    onUploadDraftPhoto={() => pickCommentPhotoForPost(post.id)}
                    onTakeDraftPhoto={() => takeCommentPhotoForPost(post.id)}
                    onAddDraftPhotoByUrl={(url) =>
                      addCommentPhotoDraftForPost(post.id, { kind: 'remote', url: url.trim() })
                    }
                    draftPhotoBusy={uploadingCommentPhotoPostId === post.id}
                    onAttachDraftFile={() => attachCommentFileForPost(post.id)}
                    onOpenDraftPhoto={({ urls, index }) =>
                      setImageLightbox({
                        urls,
                        index,
                        alts: urls.map(() => ''),
                        ownerName: currentUserId ? getUserDisplayName(currentUserId) : group?.name,
                      })
                    }
                    replyTargetId={replyTargetByPost[post.id] ?? null}
                    onReplyTargetChange={(id) =>
                      setReplyTargetByPost((prev) => ({ ...prev, [post.id]: id }))
                    }
                    onSubmitDraft={() => void addComment(post.id)}
                    commentEdit={
                      commentEdit?.postId === post.id ? { commentId: commentEdit.commentId } : null
                    }
                    commentEditText={commentEditText}
                    onCommentEditTextChange={setCommentEditText}
                    commentEditParentId={commentEditParentId}
                    onCommentEditParentIdChange={setCommentEditParentId}
                    onCancelEdit={cancelEditComment}
                    onSaveEdit={() => void saveEditedComment()}
                    saveEditBusy={updateCommentMutation.isPending}
                    onToggleReaction={(commentId, emoji) =>
                      toggleCommentReactionMutation.mutate({ commentId, emoji })
                    }
                    onReactionChipLongPress={openReactionDetailModal}
                    onOpenReactionQuickPicker={(commentId) =>
                      openReactionQuickPicker({ kind: 'comment', id: commentId })
                    }
                    onBeginEdit={(commentId) => {
                      const c = post.comments.find((x) => x.id === commentId);
                      if (c) beginEditComment(post.id, c);
                    }}
                    confirmDeleteComment={(commentId) =>
                      confirmDeleteComment(post.id, commentId)
                    }
                    containerStyle={styles.postCommentsSection}
                    reactionButtonRefs={reactionButtonRefs}
                    renderAvatar={(userId, displayName) => {
                      const u = usersById.get(userId);
                      return (
                        <UserAvatar
                          seed={displayName}
                          backgroundColor={[u?.avatarSeed ?? '']}
                          thumbnail={u?.thumbnail}
                          size={18}
                        />
                      );
                    }}
                    renderCommentBody={(comment) => {
                      const owner = usersById.get(comment.userId);
                      return (
                        <ForumPostMarkdownBody
                          markdownBody={comment.body || ''}
                          markdownStyles={markdownStyles}
                          posterDisplayName={getUserDisplayName(comment.userId)}
                          ownerAvatarSeed={owner?.avatarSeed ?? null}
                          ownerThumbnail={owner?.thumbnail ?? null}
                          setImageLightbox={setImageLightbox}
                        />
                      );
                    }}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </KeyboardSafeScrollView>

      {postMenuTarget && postMenuPopoverLayout ? (
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
                <TouchableOpacity
                  style={styles.postOptionsRow}
                  onPress={() => {
                    setPostMenuTarget(null);
                    if (postMenuTargetPost) beginEditPost(postMenuTargetPost);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={Colors.text} />
                  <Text style={styles.postOptionsLabel}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.postOptionsRow, styles.postOptionsRowLast]}
                  onPress={() => {
                    const id = postMenuTarget.postId;
                    setPostMenuTarget(null);
                    confirmDeletePost(id);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.notGoing} />
                  <Text style={[styles.postOptionsLabel, styles.postOptionsLabelDanger]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {reactionQuickPickerTarget && currentUserId ? (
        <Modal
          visible
          transparent
          animationType="fade"
          presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
          onRequestClose={() => setReactionQuickPickerTarget(null)}
          statusBarTranslucent
        >
          <View style={styles.commentReactionPickerRoot}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setReactionQuickPickerTarget(null);
                setReactionQuickPickerAnchor(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close quick reactions"
            />
            <View style={styles.commentReactionQuickPickerRoot} pointerEvents="box-none">
              <View style={[styles.commentReactionQuickPickerCard, quickPickerStyle]} pointerEvents="auto">
                <EmojiBar
                  quickReactions={commentQuickReactions}
                  onPressReaction={applyReactionAndDismiss}
                  onPressViewAll={() => {
                    setReactionPickerTarget(reactionQuickPickerTarget);
                    setReactionQuickPickerTarget(null);
                    setReactionQuickPickerAnchor(null);
                  }}
                  disabled={togglePostReactionMutation.isPending || toggleCommentReactionMutation.isPending}
                  viewAllAccessibilityLabel="View all emojis"
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {reactionPickerTarget && currentUserId ? (
        <Modal
          visible
          transparent
          animationType="fade"
          presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
          onRequestClose={() => setReactionPickerTarget(null)}
          statusBarTranslucent
        >
          <View style={styles.commentReactionPickerRoot}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlay }]}
              onPress={() => setReactionPickerTarget(null)}
              accessibilityRole="button"
              accessibilityLabel="Close emoji picker"
            />
            <View style={styles.commentReactionPickerCenter} pointerEvents="box-none">
              <View style={styles.commentReactionPickerCard} pointerEvents="auto">
                <Text style={styles.commentReactionPickerTitle}>Choose a reaction</Text>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.commentReactionPickerScroll}
                  contentContainerStyle={styles.commentReactionPickerGrid}
                >
                  {COMMENT_REACTION_EMOJIS.map((emoji, emojiIdx) => (
                    <TouchableOpacity
                      key={`${emoji}-${emojiIdx}`}
                      onPress={() => applyReactionAndDismiss(emoji)}
                      disabled={
                        togglePostReactionMutation.isPending || toggleCommentReactionMutation.isPending
                      }
                      style={styles.commentActionEmojiHit}
                      accessibilityLabel={`React with ${emoji}`}
                    >
                      <ReactionEmojiGlyph emoji={emoji} size={22} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {reactionDetailModal ? (
        <Modal
          visible
          transparent
          animationType="fade"
          presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
          onRequestClose={() => setReactionDetailModal(null)}
          statusBarTranslucent
        >
          <View style={styles.commentReactionPickerRoot}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlay }]}
              onPress={() => setReactionDetailModal(null)}
              accessibilityRole="button"
              accessibilityLabel="Close reaction details"
            />
            <View style={styles.commentReactionPickerCenter} pointerEvents="box-none">
              <View style={styles.reactionDetailCard} pointerEvents="auto">
                <Text style={styles.reactionDetailTitle}>
                  {reactionDetailModal.emoji} Reactions ({reactionDetailModal.userIds.length})
                </Text>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={styles.reactionDetailScroll}
                >
                  {reactionDetailModal.userIds.map((uid) => {
                    const user = usersById.get(uid);
                    return (
                      <View key={`${reactionDetailModal.emoji}-${uid}`} style={styles.reactionDetailRow}>
                        <UserAvatar
                          seed={getUserDisplayName(uid)}
                          backgroundColor={[user?.avatarSeed ?? '']}
                          thumbnail={user?.thumbnail}
                          size={28}
                        />
                        <Text style={styles.reactionDetailName}>
                          {uid === currentUserId
                            ? `${getUserDisplayName(uid)} (you)`
                            : getUserDisplayName(uid)}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      <ImageLightboxModal
        visible={imageLightbox !== null}
        urls={imageLightbox?.urls ?? []}
        index={imageLightbox?.index ?? 0}
        onChangeIndex={(nextIndex) => setImageLightbox((prev) => (prev ? { ...prev, index: nextIndex } : prev))}
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

      {composerLinkPopover ? (
        <Modal
          visible
          transparent
          animationType="fade"
          presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
          onRequestClose={() => setComposerLinkPopover(null)}
          statusBarTranslucent
        >
          <View style={styles.commentReactionPickerRoot}>
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: Colors.overlay }]}
              onPress={() => setComposerLinkPopover(null)}
              accessibilityRole="button"
              accessibilityLabel="Close link editor"
            />
            <View style={styles.commentReactionPickerCenter} pointerEvents="box-none">
              <View style={styles.composerLinkPopoverCard} pointerEvents="auto">
                <Text style={styles.composerLinkPopoverTitle}>Insert link</Text>
                <TextInput
                  value={composerLinkPopover.text}
                  onChangeText={(text) => setComposerLinkPopover((prev) => (prev ? { ...prev, text } : prev))}
                  placeholder="Displayed text"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.composerLinkPopoverInput}
                />
                <TextInput
                  value={composerLinkPopover.url}
                  onChangeText={(url) => setComposerLinkPopover((prev) => (prev ? { ...prev, url } : prev))}
                  placeholder="https://example.com"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.composerLinkPopoverInput}
                />
                <View style={styles.composerLinkPopoverActions}>
                  <TouchableOpacity
                    style={styles.composerLinkPopoverCancelBtn}
                    onPress={() => setComposerLinkPopover(null)}
                  >
                    <Text style={styles.composerLinkPopoverCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.composerLinkPopoverApplyBtn,
                      !composerLinkPopover.url.trim() && styles.postBtnDisabled,
                    ]}
                    disabled={!composerLinkPopover.url.trim()}
                    onPress={applyComposerLinkPopover}
                  >
                    <Text style={styles.composerLinkPopoverApplyText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
  },
  cardPad: { padding: 14 },
  attachToolbarRow: {
    marginTop: 2,
    marginBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachFileBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    borderRadius: 9,
  },
  attachToolbarBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markdownSupportText: {
    marginTop: 10,
    marginBottom: 8,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  markdownSupportLink: {
    color: Colors.accent,
    textDecorationLine: 'underline',
    fontFamily: Fonts.medium,
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
    marginBottom: 6,
  },
  composerPhotosScroll: {
    marginBottom: 10,
    marginTop: -2,
  },
  /** Published post attachment strip — same 80×80 thumbs as composer preview */
  postAttachmentPhotosScroll: {
    marginTop: 8,
    marginBottom: 8,
  },
  composerPhotosScrollContent: {
    gap: 4,
    paddingVertical: 4,
  },
  postAttachmentFilesList: {
    marginTop: 6,
    marginBottom: 6,
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
  composerFileChipsList: {
    marginTop: 2,
    marginBottom: 8,
    gap: 6,
  },
  composerFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  composerFileChipIcon: {
    flexShrink: 0,
  },
  composerFileChipText: {
    flexShrink: 1,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 13,
  },
  composerFileChipRemove: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: Colors.surface,
    flexShrink: 0,
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
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.text,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
  },
  postBtnDisabled: { opacity: 0.45 },
  postBtnText: { color: '#fff', fontFamily: Fonts.semiBold, fontSize: 13 },
  emptyText: { color: Colors.textMuted, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
  metaText: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, marginBottom: 12 },
  metaPostMe: { color: Colors.going, fontFamily: Fonts.semiBold },
  postMetaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  postMetaTitleColumn: { flex: 1, minWidth: 0 },
  postMetaAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  postDraftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.maybeBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.maybeBorder,
  },
  postDraftBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.maybe,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  postMetaTextGrow: { flex: 1, marginBottom: 0 },
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
  commentComposerWrap: {
    marginTop: 8,
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
  },
  commentComposerAttachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentComposerInput: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.bg,
  },
  commentComposerSubmitBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentComposerSubmitBtnText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#fff' },
  commentComposerReplyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  commentComposerReplyCard: {
    flex: 1,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  commentComposerReplyAuthor: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  commentComposerReplyPreview: {
    fontSize: 14,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
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
  readMoreBtn: { alignSelf: 'flex-start', marginTop: 4 },
  readMoreText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSub },
  inlineImage: {
    width: '100%',
    height: 180,
    borderRadius: Radius.lg,
    backgroundColor: Colors.border,
  },
  markdownParagraphColumn: { flexDirection: 'column', alignItems: 'stretch' },
  markdownImageWrap: { width: '100%', alignSelf: 'stretch', marginVertical: 6 },
  groupPhotoLightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupPhotoLightboxHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  groupPhotoLightboxName: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#fff' },
  groupPhotoLightboxSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Fonts.regular,
  },
  groupPhotoLightboxClose: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  groupPhotoLightboxImg: { width: '100%', height: '100%' },
  groupPhotoLightboxImageWrap: {
    flex: 1,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupPhotoLightboxTapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '40%',
  },
  groupPhotoLightboxTapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '40%',
  },
  groupPhotoLightboxNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    zIndex: 6,
    elevation: 6,
  },
  groupPhotoLightboxNavBtnDisabled: { opacity: 0.28 },
  groupPhotoLightboxNavPrev: { left: 10 },
  groupPhotoLightboxNavNext: { right: 10 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
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
  commentActionEmojiHit: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentReactionPickerRoot: {
    flex: 1,
  },
  commentReactionPickerCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  commentReactionQuickPickerRoot: {
    ...StyleSheet.absoluteFillObject,
  },
  commentReactionQuickPickerCard: {
    position: 'absolute',
    width: 316,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    ...Shadows.md,
  },
  commentReactionPickerCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: Dimensions.get('window').height * 0.62,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 10,
    ...Shadows.md,
  },
  commentReactionPickerTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  commentReactionPickerScroll: {
    maxHeight: Dimensions.get('window').height * 0.48,
  },
  commentReactionPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 4,
    paddingBottom: 8,
  },
  reactionDetailCard: {
    width: '100%',
    maxWidth: 340,
    maxHeight: Dimensions.get('window').height * 0.62,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    ...Shadows.md,
  },
  reactionDetailTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  reactionDetailScroll: {
    maxHeight: Dimensions.get('window').height * 0.46,
  },
  reactionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  reactionDetailName: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  composerLinkPopoverCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: 14,
    ...Shadows.md,
  },
  composerLinkPopoverTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 10,
  },
  composerLinkPopoverInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.bg,
    marginBottom: 8,
  },
  composerLinkPopoverActions: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  composerLinkPopoverCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  composerLinkPopoverCancelText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSub,
  },
  composerLinkPopoverApplyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  composerLinkPopoverApplyText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#fff',
  },
  iconActionText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textSub },
  reactionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  reactionLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSub },
  postCommentsSection: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
  },
  commentComposer: {
    marginTop: 8,
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  replyComposer: { marginTop: 10, gap: 8 },
  replyingBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  replyingBadgeText: { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.medium },
  composerReplyPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  composerReplyQuoteStrip: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
  },
  commentEditReplyComposer: {
    gap: 8,
    marginTop: 4,
  },
  commentEditStaleHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: 8,
    marginTop: 2,
  },
  commentEditInput: {
    marginTop: 8,
    minHeight: 72,
  },
  commentEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  commentEditSecondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  commentEditSecondaryBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textSub,
  },
  commentEditPrimaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentEditPrimaryBtnDisabled: { opacity: 0.45 },
  commentEditPrimaryBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#fff',
  },
  commentOptionsModalRoot: {
    flex: 1,
  },
  commentOptionsDismiss: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  commentOptionsPopoverWrap: {
    position: 'absolute',
    zIndex: 20,
    elevation: 20,
  },
  commentOptionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    ...Shadows.lg,
  },
  commentOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  commentOptionsRowLast: { borderBottomWidth: 0 },
  commentOptionsLabel: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.text, flex: 1 },
  commentOptionsLabelDanger: { color: Colors.notGoing },
  commentInput: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.bg,
  },
  replyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  replyBtnText: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textSub },
  commentRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  commentRowHighlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff7cc',
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentHeaderTitleCluster: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  /** Wraps nested Text so name + timestamp stay inline and ellipsize together. */
  commentHeaderInlineRoot: {
    width: '100%',
  },
  commentName: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.text },
  commentNameMe: { color: Colors.going },
  commentMenuBtn: { padding: 2 },
  commentTime: { fontSize: 11, color: Colors.textMuted, fontFamily: Fonts.regular, flexShrink: 0 },
  commentTimeInline: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    flexShrink: 0,
    marginLeft: 8,
  },
  commentText: { fontSize: 14, color: Colors.text, fontFamily: Fonts.regular, lineHeight: 20 },
  replyQuoteStrip: {
    marginTop: 4,
    marginBottom: 4,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  replyQuotePressed: {
    opacity: 0.9,
  },
  replyQuoteAuthor: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  replyQuotePreview: {
    fontSize: 14,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
  reactionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  reactionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reactionChipInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reactionChipCount: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.text },
  replyCard: {
    marginTop: 10,
    marginLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
    paddingLeft: 8,
  },
  commentMeta: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textMuted, marginBottom: 4 },
  commentBody: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 20 },
  postMentionInputWrap: { alignSelf: 'stretch', width: '100%' },
  mentionInBody: { color: Colors.accent, fontFamily: Fonts.semiBold },
});

type ForumPostMarkdownBodyProps = {
  markdownBody: string;
  markdownStyles: NonNullable<ComponentProps<typeof Markdown>['style']>;
  posterDisplayName: string;
  ownerAvatarSeed: string | null;
  ownerThumbnail: string | null;
  setImageLightbox: Dispatch<SetStateAction<ForumPostImageLightboxState>>;
};

const ForumPostMarkdownBody = memo(function ForumPostMarkdownBody({
  markdownBody,
  markdownStyles,
  posterDisplayName,
  ownerAvatarSeed,
  ownerThumbnail,
  setImageLightbox,
}: ForumPostMarkdownBodyProps) {
  const rules = useMemo(
    () => ({
      paragraph: (node: any, children: any, _parent: any, mdStyles: any) => (
        <View key={node.key} style={[mdStyles._VIEW_SAFE_paragraph, styles.markdownParagraphColumn]}>
          {children}
        </View>
      ),
      text: (node: any, _children: any, _parent: any, mdStyles: any, inheritedStyles: Record<string, unknown> = {}) => {
        const content = typeof node.content === 'string' ? node.content : '';
        return (
          <MentionText
            key={node.key}
            text={content}
            style={[inheritedStyles, mdStyles.text]}
            mentionStyle={styles.mentionInBody}
          />
        );
      },
      image: (node: any, _children: any, _parent: any, _mdStyles: any) => {
        const rawSrc = node.attributes?.src;
        const src = typeof rawSrc === 'string' ? rawSrc.trim() : '';
        if (!src) return null;
        const alt = typeof node.attributes?.alt === 'string' ? node.attributes.alt : '';
        return (
          <View key={node.key} style={styles.markdownImageWrap}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                setImageLightbox({
                  urls: [src],
                  index: 0,
                  alts: [alt],
                  ownerName: posterDisplayName,
                  ownerAvatarSeed,
                  ownerThumbnail,
                })
              }
            >
              <ResolvableImage storedUrl={src} style={styles.inlineImage} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        );
      },
    }),
    [posterDisplayName, ownerAvatarSeed, ownerThumbnail, setImageLightbox]
  );

  const onLinkPress = useCallback((url: string) => {
    Linking.openURL(uploadUrlToDownloadUrl(url));
    return false;
  }, []);

  return (
    <Markdown style={markdownStyles} mergeStyle rules={rules} onLinkPress={onLinkPress}>
      {markdownBody}
    </Markdown>
  );
});
